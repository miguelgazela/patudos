-- Fase 5, passo 2: preferência «Emails de lembrete» no Perfil.
-- Cada pessoa pode desligar os emails de lembrete (o push e o resto da app não mudam).
alter table public.profiles add column reminder_emails boolean not null default true;
grant update (reminder_emails) on public.profiles to authenticated;

-- claim_due_reminders passa a devolver `reminder_emails` por destinatário; a Edge Function
-- só envia email a quem o tem ligado.
create or replace function public.claim_due_reminders(p_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_window constant interval := interval '24 hours';
  v_out jsonb := '[]'::jsonb;
  r record;
  v_push boolean;
  v_email boolean;
  v_last jsonb;
  v_dose text;
  v_recipients jsonb;
begin
  for r in
    select o.id as occurrence_id, o.pet_id, o.scheduled_for, o.push_sent_at, o.email_sent_at,
           rem.title, rem.channels, rem.source_type, rem.source_id, p.name as pet_name
    from public.reminder_occurrences o
    join public.reminders rem on rem.id = o.reminder_id
    join public.pets p on p.id = o.pet_id
    where o.scheduled_for <= now()
      and o.scheduled_for > now() - c_window
      and o.done_at is null
      and rem.active and rem.ended_at is null
      and p.archived_at is null
      and (
        ('push' = any (rem.channels) and o.push_sent_at is null)
        or ('email' = any (rem.channels) and rem.source_type is distinct from 'medication'
            and o.email_sent_at is null)
      )
    order by o.scheduled_for
    limit greatest(p_limit, 1)
    for update of o skip locked
  loop
    v_push := 'push' = any (r.channels) and r.push_sent_at is null;
    v_email := 'email' = any (r.channels) and r.source_type is distinct from 'medication'
               and r.email_sent_at is null;

    update public.reminder_occurrences
    set push_sent_at = case when v_push then now() else push_sent_at end,
        email_sent_at = case when v_email then now() else email_sent_at end
    where id = r.occurrence_id;

    -- «Da última vez»: o evento de saúde de origem (a dose anterior).
    v_last := null;
    if r.source_type = 'health_event' then
      select jsonb_build_object(
               'product', coalesce(nullif(btrim(h.product), ''), null),
               'occurred_on', h.occurred_on,
               'by', nullif(btrim(pr.name), ''))
        into v_last
      from public.health_events h
      left join public.profiles pr on pr.id = h.created_by
      where h.id = r.source_id;
    end if;

    -- Medicação: a dose aparece na notificação («Às 20:00 · ½ comprimido»).
    v_dose := null;
    if r.source_type = 'medication' then
      select nullif(btrim(m.dose), '') into v_dose from public.medications m where m.id = r.source_id;
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
             'user_id', u.id, 'email', u.email, 'name', nullif(btrim(pr.name), ''),
             'reminder_emails', coalesce(pr.reminder_emails, true))), '[]'::jsonb)
      into v_recipients
    from public.pet_members m
    join auth.users u on u.id = m.user_id
    left join public.profiles pr on pr.id = m.user_id
    where m.pet_id = r.pet_id and m.notify;

    v_out := v_out || jsonb_build_object(
      'occurrence_id', r.occurrence_id,
      'pet_id', r.pet_id,
      'pet_name', r.pet_name,
      'title', r.title,
      'scheduled_for', r.scheduled_for,
      'source_type', r.source_type,
      'push', v_push,
      'email', v_email,
      'last', v_last,
      'dose', v_dose,
      'recipients', v_recipients);
  end loop;
  return v_out;
end;
$$;
