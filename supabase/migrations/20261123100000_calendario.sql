-- Fase 3, passo 3: feed de calendário (.ics).
--
-- Decisão sobre o token: fica guardado EM CLARO (um por utilizador, único), não em hash.
-- Motivo: o utilizador tem de poder ver/copiar o link outra vez no ecrã «Ligar ao calendário»;
-- com hash só se mostraria uma vez (ou o ecrã teria de gerar um link novo, o que invalida as
-- subscrições já feitas). O feed só dá acesso de leitura a datas e títulos de lembretes, e o token
-- tem 256 bits. A RLS limita a leitura ao próprio; o feed (anon) valida o token só dentro de uma
-- função security definer, sem expor a tabela.

create table public.calendar_feeds (
  user_id uuid primary key references auth.users (id) on delete cascade,
  token text not null unique check (length(token) >= 43),
  created_at timestamptz not null default now(),
  last_fetched_at timestamptz
);

alter table public.calendar_feeds enable row level security;

revoke all on public.calendar_feeds from anon, authenticated;
grant select on public.calendar_feeds to authenticated;

create policy "calendar_feeds_select_own" on public.calendar_feeds
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Token: 32 bytes aleatórios em base64url (43 caracteres, sem «=»).
create function public.new_calendar_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
$$;

revoke all on function public.new_calendar_token() from public, anon, authenticated;

-- Devolve o token do utilizador, criando-o no primeiro acesso.
create function public.get_calendar_token()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_token text;
begin
  if v_uid is null then
    raise exception 'Sem sessão.' using errcode = '42501';
  end if;
  insert into public.calendar_feeds (user_id, token)
  values (v_uid, public.new_calendar_token())
  on conflict (user_id) do nothing;
  select token into v_token from public.calendar_feeds where user_id = v_uid;
  return v_token;
end;
$$;

-- Gera um link novo; o anterior deixa de funcionar.
create function public.regenerate_calendar_token()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_token text := public.new_calendar_token();
begin
  if v_uid is null then
    raise exception 'Sem sessão.' using errcode = '42501';
  end if;
  insert into public.calendar_feeds (user_id, token)
  values (v_uid, v_token)
  on conflict (user_id) do update
    set token = excluded.token, created_at = now(), last_fetched_at = null;
  return v_token;
end;
$$;

revoke all on function public.get_calendar_token(), public.regenerate_calendar_token()
  from public, anon;
grant execute on function public.get_calendar_token(), public.regenerate_calendar_token()
  to authenticated;

-- ---------------------------------------------------------------------------
-- calendar_feed(token): os eventos do utilizador dono do token, ou null se o token não existe.
--
-- Lembretes ativos (não terminados) com o canal «calendar», de animais não arquivados de que
-- o utilizador é membro (membros que saem deixam logo de os ver).
-- Recorrências: expandidas em ocorrências (não RRULE no .ics): é o mais fiável no Google e no
-- Calendário do iPhone, e usa a mesma expand_rrule que o envio de lembretes (hora de Lisboa,
-- com DST). Janela: de há 30 dias a +12 meses; a medicação (várias tomas por dia) só +90 dias,
-- para o ficheiro não crescer sem fim.
-- Os `next_due_on` já estão cobertos: cada um tem o seu lembrete de saúde (só não aparece se o
-- utilizador desligou «lembrar»).
-- ---------------------------------------------------------------------------
create function public.calendar_feed(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c_tz constant text := 'Europe/Lisbon';
  v_uid uuid;
  v_from timestamptz := now() - interval '30 days';
  v_events jsonb;
begin
  if p_token is null or length(p_token) < 43 or length(p_token) > 128 then
    return null;
  end if;

  select user_id into v_uid from public.calendar_feeds where token = p_token;
  if v_uid is null then
    return null;
  end if;

  update public.calendar_feeds set last_fetched_at = now() where user_id = v_uid;

  select coalesce(jsonb_agg(e order by e.starts_at, e.uid), '[]'::jsonb) into v_events
  from (
    select
      r.id::text || '-' || to_char(t at time zone 'UTC', 'YYYYMMDD"T"HH24MISS"Z"') as uid,
      r.id as reminder_id,
      p.id as pet_id,
      p.name as pet_name,
      r.title,
      t as starts_at,
      (r.source_type = 'health_event') as all_day,
      to_char(t at time zone c_tz, 'YYYY-MM-DD') as local_date
    from public.reminders r
    join public.pets p on p.id = r.pet_id and p.archived_at is null
    join public.pet_members m on m.pet_id = r.pet_id and m.user_id = v_uid
    cross join lateral (
      select r.due_at as t
      where r.rrule is null and r.due_at >= v_from and r.due_at <= now() + interval '12 months'
      union all
      select x from public.expand_rrule(
        r.rrule, r.due_at, v_from,
        now() + case when r.source_type = 'medication' then interval '90 days' else interval '12 months' end,
        r.ends_on) x
      where r.rrule is not null
    ) occ(t)
    where r.active and r.ended_at is null and 'calendar' = any (r.channels)
  ) e;

  return jsonb_build_object('events', v_events);
end;
$$;

revoke all on function public.calendar_feed(text) from public;
grant execute on function public.calendar_feed(text) to anon, authenticated;
