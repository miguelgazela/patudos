-- Fase 6, passo 3: limites de utilização (travar abusos e custos; uso normal nunca os atinge).
--
-- Tudo na base de dados, nunca só no cliente:
--  * `rate_limit_events` + `take_rate_limit`: contadores por utilizador, ação e janela de tempo;
--  * convites (20/dia), notificação de teste (1/min e 10/dia), exportação (3/hora), feed .ics
--    (60/hora por token);
--  * animais ativos por dono (30) e armazenamento (200 MB por animal, 1 GB por utilizador).
-- Quando um limite é atingido a BD levanta `rate_limited` / `pet_limit` / `storage_pet_limit` /
-- `storage_user_limit` (errcode P0001); `hint` traz a ação. A app traduz para PT-PT.

create table public.rate_limit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);
create index rate_limit_events_lookup_idx
  on public.rate_limit_events (user_id, action, created_at desc);
create index rate_limit_events_created_idx on public.rate_limit_events (created_at);

-- Ninguém lê nem escreve diretamente: só as funções security definer abaixo.
alter table public.rate_limit_events enable row level security;
revoke all on public.rate_limit_events from anon, authenticated;

-- Regista um uso e recusa se algum dos limites (janela i, máximo i) já foi atingido.
create function public.take_rate_limit(
  p_user uuid, p_action text, p_windows interval[], p_maxes int[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  i int;
begin
  -- Serializa pedidos do mesmo utilizador e ação (sem isto, pedidos em paralelo passavam o limite).
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || ':' || p_action, 0));
  for i in 1 .. array_length(p_windows, 1) loop
    if (select count(*) from public.rate_limit_events
        where user_id = p_user and action = p_action and created_at > now() - p_windows[i])
       >= p_maxes[i] then
      raise exception 'rate_limited' using errcode = 'P0001', hint = p_action;
    end if;
  end loop;
  insert into public.rate_limit_events (user_id, action) values (p_user, p_action);
  -- Limpeza ocasional: nenhuma janela passa de 1 dia.
  if random() < 0.02 then
    delete from public.rate_limit_events where created_at < now() - interval '2 days';
  end if;
end;
$$;
revoke all on function public.take_rate_limit(uuid, text, interval[], int[]) from public, anon, authenticated;

-- Exportação de dados: 3 por hora.
create function public.consume_export()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Sem sessão.' using errcode = '42501';
  end if;
  perform public.take_rate_limit(v_uid, 'export', array[interval '1 hour'], array[3]);
end;
$$;
revoke all on function public.consume_export() from public, anon;
grant execute on function public.consume_export() to authenticated;

-- Notificação de teste: 1 por minuto e 10 por dia. Chamada pela Edge Function (service role),
-- depois de validar o JWT; assim o limite vale também para quem chame a função diretamente.
create function public.consume_test_push(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.take_rate_limit(
    p_user, 'test_push', array[interval '1 minute', interval '1 day'], array[1, 10]);
end;
$$;
revoke all on function public.consume_test_push(uuid) from public, anon, authenticated;
grant execute on function public.consume_test_push(uuid) to service_role;

-- Convites: 20 por dia por utilizador (contam criações e reenvios, depois das validações).
create or replace function public.invite_to_pet(p_pet_id uuid, p_email text, p_role text default 'caregiver')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_id uuid;
begin
  if not public.is_pet_owner(p_pet_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_role not in ('owner', 'caregiver') then
    raise exception 'invalid_role' using errcode = '22023';
  end if;
  if position('@' in v_email) <= 1 then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  if exists (
    select 1
    from public.pet_members m
    join public.profiles p on p.id = m.user_id
    where m.pet_id = p_pet_id and lower(p.email) = v_email
  ) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;

  perform public.take_rate_limit(
    (select auth.uid()), 'invite', array[interval '1 day'], array[20]);

  insert into public.pet_invites (pet_id, email, role, invited_by)
  values (p_pet_id, v_email, p_role, (select auth.uid()))
  on conflict (pet_id, email) where accepted_at is null and cancelled_at is null
  do update set role = excluded.role,
                expires_at = now() + interval '14 days',
                invited_by = excluded.invited_by
  returning id into v_id;

  return v_id;
end;
$$;

-- Animais: no máximo 30 ativos (não arquivados) de que a pessoa é dona.
create function public.guard_pet_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null and (
    select count(*) from public.pet_members m
    join public.pets p on p.id = m.pet_id
    where m.user_id = new.created_by and m.role = 'owner' and p.archived_at is null
  ) >= 30 then
    raise exception 'pet_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger pets_limit before insert on public.pets
  for each row execute function public.guard_pet_limit();

-- Armazenamento: 200 MB por animal (fotos + documentos) e 1 GB por utilizador.
-- Calcula-se a partir de `storage.objects`. O ficheiro já está carregado quando se grava o
-- documento; se passar o limite a gravação falha e a app apaga o ficheiro (já o faz).
create function public.guard_document_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_pet constant bigint := 200 * 1024 * 1024;
  c_user constant bigint := 1024 * 1024 * 1024;
  v_user uuid := coalesce(new.created_by, (select auth.uid()));
begin
  if (select coalesce(sum((metadata ->> 'size')::bigint), 0) from storage.objects
      where bucket_id in ('documentos', 'fotos') and name like new.pet_id::text || '/%') > c_pet then
    raise exception 'storage_pet_limit' using errcode = 'P0001';
  end if;
  if v_user is not null and (
      select coalesce(sum((metadata ->> 'size')::bigint), 0) from storage.objects
      where bucket_id in ('documentos', 'fotos')
        and (owner = v_user or owner_id = v_user::text)) > c_user then
    raise exception 'storage_user_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger documents_quota before insert on public.documents
  for each row execute function public.guard_document_quota();

-- Feed .ics: 60 pedidos por hora por token (além da cache de 5 min). Excedido: `{"limited": true}`.
create or replace function public.calendar_feed(p_token text)
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

  begin
    perform public.take_rate_limit(v_uid, 'ics', array[interval '1 hour'], array[60]);
  exception when sqlstate 'P0001' then
    return jsonb_build_object('limited', true);
  end;

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

-- Verificação de saúde (/api/saude): prova que a BD responde, sem tocar em dados.
create function public.health_ping()
returns boolean
language sql
stable
set search_path = ''
as $$ select true $$;
revoke all on function public.health_ping() from public;
grant execute on function public.health_ping() to anon, authenticated;
