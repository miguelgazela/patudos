-- Lembretes (Fase 3, passo 1): motor de ocorrências, criação automática a partir da saúde e «Feito».
--
-- Modelo:
--  * `reminders`: um lembrete por animal. `due_at` é sempre a âncora (a 1.ª ocorrência);
--    `rrule` nulo = acontece uma só vez; com `rrule` repete (subconjunto simples, ver `expand_rrule`).
--  * `reminder_occurrences`: cada vez que o lembrete «toca». É aqui que se marca «Feito»
--    e (passo 2) o envio de push/email.
--  * Lembretes de saúde (`source_type`) são criados/atualizados por triggers em `health_events`
--    e `medications`, por isso funcionam venha o registo da consulta, de um tratamento rápido
--    ou de uma edição posterior.
--
-- A geração de ocorrências vive TODA na base de dados (`generate_reminder_occurrences`),
-- para o cron do passo 2 (pg_cron) a poder chamar diretamente, sem hop HTTP.

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  title text not null check (length(btrim(title)) > 0),
  due_at timestamptz not null,
  rrule text check (rrule is null or length(btrim(rrule)) > 0),
  ends_on date,
  channels text[] not null default array['push', 'email', 'calendar']
    check (channels <@ array['push', 'email', 'calendar']::text[]),
  source_type text check (source_type in ('health_event', 'medication')),
  source_id uuid,
  active boolean not null default true,
  ended_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((source_type is null) = (source_id is null)),
  unique (source_type, source_id)
);

create index reminders_pet_idx on public.reminders (pet_id);

create table public.reminder_occurrences (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.reminders (id) on delete cascade,
  pet_id uuid not null references public.pets (id) on delete cascade,
  scheduled_for timestamptz not null,
  push_sent_at timestamptz,
  email_sent_at timestamptz,
  done_at timestamptz,
  done_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (reminder_id, scheduled_for)
);

create index reminder_occurrences_pet_idx on public.reminder_occurrences (pet_id, scheduled_for);
create index reminder_occurrences_pending_idx on public.reminder_occurrences (scheduled_for)
  where done_at is null;

create trigger reminders_set_updated_at before update on public.reminders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
--  * Membros leem. Membros criam lembretes MANUAIS (os de saúde vêm dos triggers).
--  * Editar/apagar: dono ou quem criou (can_edit_pet_record).
--  * Ocorrências: só leitura direta; «Feito»/«Desfazer» vão por RPC (qualquer membro).
-- ---------------------------------------------------------------------------
alter table public.reminders enable row level security;
alter table public.reminder_occurrences enable row level security;

revoke all on public.reminders, public.reminder_occurrences from anon, authenticated;
grant select, insert, delete on public.reminders to authenticated;
grant update (title, due_at, rrule, ends_on, channels, active) on public.reminders to authenticated;
grant select on public.reminder_occurrences to authenticated;

create policy "reminders_select_member" on public.reminders
  for select to authenticated
  using (public.is_pet_member(pet_id));

create policy "reminders_insert_manual_member" on public.reminders
  for insert to authenticated
  with check (
    public.is_pet_member(pet_id)
    and created_by = (select auth.uid())
    and source_type is null
  );

create policy "reminders_update_owner_or_creator" on public.reminders
  for update to authenticated
  using (public.can_edit_pet_record(pet_id, created_by))
  with check (public.can_edit_pet_record(pet_id, created_by));

create policy "reminders_delete_owner_or_creator" on public.reminders
  for delete to authenticated
  using (public.can_edit_pet_record(pet_id, created_by));

create policy "reminder_occurrences_select_member" on public.reminder_occurrences
  for select to authenticated
  using (public.is_pet_member(pet_id));

-- ---------------------------------------------------------------------------
-- expand_rrule: expande uma RRULE simples em instantes, na hora de Lisboa.
-- Suporta FREQ=DAILY|WEEKLY|MONTHLY|YEARLY, INTERVAL, BYHOUR, BYMINUTE e BYDAY (semanal).
-- É o que a app cria (a medicação usa DAILY + BYHOUR/BYMINUTE; os manuais usam o resto).
-- Mensal/anual: se o dia não existe no mês (31), usa o último dia do mês.
-- ---------------------------------------------------------------------------
create function public.expand_rrule(
  p_rrule text,
  p_start timestamptz,
  p_from timestamptz,
  p_to timestamptz,
  p_until date default null
)
returns setof timestamptz
language plpgsql
immutable
set search_path = ''
as $$
declare
  c_tz constant text := 'Europe/Lisbon';
  v_parts jsonb := '{}'::jsonb;
  v_part text;
  v_freq text;
  v_interval integer;
  v_hours integer[];
  v_minutes integer[];
  v_days integer[];
  v_local_start timestamp := p_start at time zone c_tz;
  v_start_date date := (p_start at time zone c_tz)::date;
  v_d date;
  v_last date := (p_to at time zone c_tz)::date;
  v_h integer;
  v_m integer;
  v_ts timestamptz;
  v_ok boolean;
  v_months integer;
  v_dim integer;
begin
  foreach v_part in array string_to_array(upper(p_rrule), ';') loop
    if position('=' in v_part) > 0 then
      v_parts := v_parts || jsonb_build_object(split_part(v_part, '=', 1), split_part(v_part, '=', 2));
    end if;
  end loop;

  v_freq := v_parts ->> 'FREQ';
  if v_freq is null or v_freq not in ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY') then
    return;
  end if;
  v_interval := greatest(coalesce(nullif(v_parts ->> 'INTERVAL', '')::integer, 1), 1);

  v_hours := coalesce(
    (select array_agg(h::integer order by h::integer) from unnest(string_to_array(v_parts ->> 'BYHOUR', ',')) h),
    array[extract(hour from v_local_start)::integer]);
  v_minutes := coalesce(
    (select array_agg(m::integer order by m::integer) from unnest(string_to_array(v_parts ->> 'BYMINUTE', ',')) m),
    array[extract(minute from v_local_start)::integer]);
  -- BYDAY (semanal): MO..SU → 1..7 (ISO); por omissão, o dia da semana do início.
  v_days := coalesce(
    (select array_agg(
        case d when 'MO' then 1 when 'TU' then 2 when 'WE' then 3 when 'TH' then 4
                    when 'FR' then 5 when 'SA' then 6 when 'SU' then 7 end)
       from unnest(string_to_array(v_parts ->> 'BYDAY', ',')) d),
    array[extract(isodow from v_start_date)::integer]);

  v_d := greatest(v_start_date, (p_from at time zone c_tz)::date);
  while v_d <= v_last loop
    exit when p_until is not null and v_d > p_until;

    if v_freq = 'DAILY' then
      v_ok := (v_d - v_start_date) % v_interval = 0;
    elsif v_freq = 'WEEKLY' then
      v_ok := extract(isodow from v_d)::integer = any (v_days)
        and (((v_d - extract(isodow from v_d)::integer + 1) - (v_start_date - extract(isodow from v_start_date)::integer + 1)) / 7) % v_interval = 0;
    else
      v_months := (extract(year from v_d)::integer * 12 + extract(month from v_d)::integer)
                - (extract(year from v_start_date)::integer * 12 + extract(month from v_start_date)::integer);
      v_dim := extract(day from (date_trunc('month', v_d) + interval '1 month - 1 day'))::integer;
      v_ok := v_months >= 0
        and v_months % (case when v_freq = 'YEARLY' then 12 * v_interval else v_interval end) = 0
        and extract(day from v_d)::integer = least(extract(day from v_start_date)::integer, v_dim);
    end if;

    if v_ok then
      foreach v_h in array v_hours loop
        foreach v_m in array v_minutes loop
          v_ts := (v_d + make_time(v_h, v_m, 0)) at time zone c_tz;
          if v_ts >= p_start and v_ts >= p_from and v_ts <= p_to then
            return next v_ts;
          end if;
        end loop;
      end loop;
    end if;
    v_d := v_d + 1;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- generate_reminder_occurrences: materializa as ocorrências devidas. Idempotente.
--  * sem rrule: garante a ocorrência única em `due_at` (mesmo no passado → «em atraso»);
--  * com rrule: as da janela [p_from, p_to] (por omissão, de hoje a +30 dias, hora de Lisboa).
-- Só para o servidor (triggers, refresh_my_occurrences e o cron do passo 2).
-- ---------------------------------------------------------------------------
create function public.generate_reminder_occurrences(
  p_reminder_id uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_tz constant text := 'Europe/Lisbon';
  v_from timestamptz := coalesce(p_from, ((now() at time zone c_tz)::date)::timestamp at time zone c_tz);
  v_to timestamptz := coalesce(p_to, ((now() at time zone c_tz)::date + 31)::timestamp at time zone c_tz);
  v_total integer := 0;
  v_n integer;
  r public.reminders;
begin
  for r in
    select * from public.reminders
    where active and ended_at is null
      and (p_reminder_id is null or id = p_reminder_id)
  loop
    if r.rrule is null then
      insert into public.reminder_occurrences (reminder_id, pet_id, scheduled_for)
      values (r.id, r.pet_id, r.due_at)
      on conflict (reminder_id, scheduled_for) do nothing;
    else
      insert into public.reminder_occurrences (reminder_id, pet_id, scheduled_for)
      select r.id, r.pet_id, t
      from public.expand_rrule(r.rrule, r.due_at, v_from, v_to, r.ends_on) t
      on conflict (reminder_id, scheduled_for) do nothing;
    end if;
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
  end loop;
  return v_total;
end;
$$;

revoke all on function public.expand_rrule(text, timestamptz, timestamptz, timestamptz, date)
  from public, anon, authenticated;
revoke all on function public.generate_reminder_occurrences(uuid, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.generate_reminder_occurrences(uuid, timestamptz, timestamptz)
  to service_role;

-- A app chama isto ao abrir «Hoje»: garante as ocorrências dos lembretes recorrentes
-- dos animais do utilizador (o cron faz o mesmo para todos). Idempotente.
create function public.refresh_my_occurrences()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer := 0;
  v_id uuid;
begin
  for v_id in
    select id from public.reminders
    where rrule is not null and active and ended_at is null and public.is_pet_member(pet_id)
  loop
    v_total := v_total + public.generate_reminder_occurrences(v_id);
  end loop;
  return v_total;
end;
$$;

revoke all on function public.refresh_my_occurrences() from public, anon;
grant execute on function public.refresh_my_occurrences() to authenticated;

-- Ao criar/alterar um lembrete: refaz as ocorrências ainda por fazer e por enviar.
create function public.reminders_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (
       new.due_at is distinct from old.due_at
       or new.rrule is distinct from old.rrule
       or new.ends_on is distinct from old.ends_on) then
    delete from public.reminder_occurrences
    where reminder_id = new.id and done_at is null
      and push_sent_at is null and email_sent_at is null;
  end if;
  if new.active and new.ended_at is null then
    perform public.generate_reminder_occurrences(new.id);
  end if;
  return null;
end;
$$;

create trigger reminders_after_write after insert or update on public.reminders
  for each row execute function public.reminders_after_write();

-- ---------------------------------------------------------------------------
-- Lembretes a partir de eventos de saúde (vacinas, desparasitações...)
-- ---------------------------------------------------------------------------
create function public.resync_health_event_reminder(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.health_events;
  v_superseded boolean;
begin
  select * into e from public.health_events where id = p_event_id;
  if not found then
    return;
  end if;

  -- Existe um registo mais recente do mesmo tratamento (mesmo tipo e título)?
  v_superseded := exists (
    select 1 from public.health_events o
    where o.pet_id = e.pet_id and o.id <> e.id and o.type = e.type
      and lower(btrim(o.title)) = lower(btrim(e.title))
      and (o.occurred_on > e.occurred_on
           or (o.occurred_on = e.occurred_on and o.created_at > e.created_at))
  );

  if e.remind and e.next_due_on is not null then
    insert into public.reminders
      (pet_id, title, due_at, source_type, source_id, created_by, ended_at)
    values (
      e.pet_id, e.title,
      (e.next_due_on + time '09:00') at time zone 'Europe/Lisbon',
      'health_event', e.id, e.created_by,
      case when v_superseded then now() end
    )
    on conflict (source_type, source_id) do update
      set title = excluded.title,
          due_at = excluded.due_at,
          ended_at = case when v_superseded then coalesce(public.reminders.ended_at, now()) end;
  else
    delete from public.reminders where source_type = 'health_event' and source_id = e.id;
  end if;

  -- Esta dose substitui a data prevista das anteriores: ficam terminadas.
  update public.reminders r set ended_at = now()
  where r.source_type = 'health_event' and r.ended_at is null
    and r.source_id in (
      select o.id from public.health_events o
      where o.pet_id = e.pet_id and o.id <> e.id and o.type = e.type
        and lower(btrim(o.title)) = lower(btrim(e.title))
        and (o.occurred_on < e.occurred_on
             or (o.occurred_on = e.occurred_on and o.created_at <= e.created_at))
    );
end;
$$;

create function public.health_events_sync_reminder()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prev uuid;
begin
  if tg_op = 'DELETE' then
    delete from public.reminders where source_type = 'health_event' and source_id = old.id;
    -- Apagou-se a dose mais recente: a anterior volta a valer.
    select o.id into v_prev from public.health_events o
    where o.pet_id = old.pet_id and o.type = old.type
      and lower(btrim(o.title)) = lower(btrim(old.title))
    order by o.occurred_on desc, o.created_at desc limit 1;
    if v_prev is not null then
      update public.reminders set ended_at = null
      where source_type = 'health_event' and source_id = v_prev;
    end if;
    return null;
  end if;
  perform public.resync_health_event_reminder(new.id);
  return null;
end;
$$;

create trigger health_events_sync_reminder
  after insert or delete or update of type, title, occurred_on, next_due_on, remind
  on public.health_events
  for each row execute function public.health_events_sync_reminder();

-- ---------------------------------------------------------------------------
-- Lembretes a partir de medicação (recorrentes, com a schedule_rrule)
-- ---------------------------------------------------------------------------
create function public.medications_sync_reminder()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_tz constant text := 'Europe/Lisbon';
  v_today date := (now() at time zone c_tz)::date;
  v_due timestamptz;
  v_ended boolean;
begin
  if tg_op = 'DELETE' then
    delete from public.reminders where source_type = 'medication' and source_id = old.id;
    return null;
  end if;

  if new.remind and new.schedule_rrule is not null then
    -- Com BYHOUR as horas vêm da regra (a âncora é o início do dia); sem ele, às 09:00.
    v_due := (new.starts_on + case when upper(new.schedule_rrule) like '%BYHOUR=%'
                                   then time '00:00' else time '09:00' end) at time zone c_tz;
    -- Terminar a medicação (ends_on = hoje ou antes, ao editar) deixa o lembrete terminado.
    v_ended := new.ends_on is not null
      and (new.ends_on < v_today or (tg_op = 'UPDATE' and new.ends_on <= v_today));
    insert into public.reminders
      (pet_id, title, due_at, rrule, ends_on, source_type, source_id, created_by, ended_at)
    values (
      new.pet_id, new.name, v_due, new.schedule_rrule, new.ends_on,
      'medication', new.id, new.created_by,
      case when v_ended then now() end
    )
    on conflict (source_type, source_id) do update
      set title = excluded.title,
          due_at = excluded.due_at,
          rrule = excluded.rrule,
          ends_on = excluded.ends_on,
          ended_at = case when v_ended then coalesce(public.reminders.ended_at, now()) end;
  else
    delete from public.reminders where source_type = 'medication' and source_id = new.id;
  end if;
  return null;
end;
$$;

create trigger medications_sync_reminder
  after insert or delete or update of name, schedule_rrule, starts_on, ends_on, remind
  on public.medications
  for each row execute function public.medications_sync_reminder();

revoke all on function
  public.resync_health_event_reminder(uuid),
  public.health_events_sync_reminder(),
  public.medications_sync_reminder(),
  public.reminders_after_write()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- save_reminder(payload): cria/edita um lembrete MANUAL (hora local de Lisboa).
-- { "id"?: uuid, "pet_id", "title", "on": "2026-11-28", "at": "10:00",
--   "rrule"?: "FREQ=MONTHLY", "channels": ["push","email"] }
-- Security invoker: o RLS decide quem pode criar/editar.
-- ---------------------------------------------------------------------------
create function public.save_reminder(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := (payload ->> 'id')::uuid;
  v_due timestamptz := ((payload ->> 'on')::date + (payload ->> 'at')::time) at time zone 'Europe/Lisbon';
  v_channels text[] := coalesce(
    (select array_agg(c) from jsonb_array_elements_text(payload -> 'channels') c),
    array['push', 'email', 'calendar']);
  v_rows integer;
begin
  if v_id is null then
    insert into public.reminders (pet_id, title, due_at, rrule, channels)
    values (
      (payload ->> 'pet_id')::uuid,
      btrim(payload ->> 'title'),
      v_due,
      nullif(btrim(payload ->> 'rrule'), ''),
      v_channels
    )
    returning id into v_id;
  else
    update public.reminders
    set title = btrim(payload ->> 'title'),
        due_at = v_due,
        rrule = nullif(btrim(payload ->> 'rrule'), ''),
        channels = v_channels
    where id = v_id;
    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      raise exception 'Lembrete não encontrado ou sem permissão.' using errcode = '42501';
    end if;
  end if;
  return v_id;
end;
$$;

revoke all on function public.save_reminder(jsonb) from public, anon;
grant execute on function public.save_reminder(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- «Feito» e «Desfazer»: qualquer membro do animal (dono ou cuidador).
-- complete_occurrence(id, tratamento?): marca feito e, se vier o objeto do tratamento
-- (mesmo formato de record_home_treatment, sem pet_id), regista-o na mesma transação.
-- Devolve o id do evento de saúde criado (ou null).
-- ---------------------------------------------------------------------------
create function public.complete_occurrence(p_occurrence_id uuid, p_treatment jsonb default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.reminder_occurrences;
  v_event uuid;
begin
  select * into o from public.reminder_occurrences where id = p_occurrence_id for update;
  if not found or not public.is_pet_member(o.pet_id) then
    raise exception 'Sem acesso a este lembrete.' using errcode = '42501';
  end if;

  if o.done_at is null then
    update public.reminder_occurrences
    set done_at = now(), done_by = (select auth.uid())
    where id = o.id;
  end if;

  if p_treatment is not null and jsonb_typeof(p_treatment) = 'object' then
    -- Corre com o RLS do dono da função, por isso verificámos a pertença acima.
    v_event := public.record_home_treatment(p_treatment || jsonb_build_object('pet_id', o.pet_id));
  end if;
  return v_event;
end;
$$;

create function public.uncomplete_occurrence(p_occurrence_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.reminder_occurrences;
begin
  select * into o from public.reminder_occurrences where id = p_occurrence_id for update;
  if not found or not public.is_pet_member(o.pet_id) then
    raise exception 'Sem acesso a este lembrete.' using errcode = '42501';
  end if;
  update public.reminder_occurrences set done_at = null, done_by = null where id = o.id;
end;
$$;

revoke all on function public.complete_occurrence(uuid, jsonb), public.uncomplete_occurrence(uuid)
  from public, anon;
grant execute on function public.complete_occurrence(uuid, jsonb), public.uncomplete_occurrence(uuid)
  to authenticated;
