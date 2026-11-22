-- Fase 3, passo 2: envio de lembretes (push + email).
--
-- Arquitetura (plano Hobby da Vercel → o Vercel Cron só corre 1×/dia):
--   pg_cron (5 em 5 min) → run_reminder_cycle():
--      1. generate_reminder_occurrences()  (SQL, sem hop HTTP)
--      2. pg_net → Edge Function `send-reminders`  (o service role fica só no Supabase)
--   A função chama `claim_due_reminders()`, envia, e em caso de falha total devolve o
--   «claim» com `release_reminder_claim()`.
--
-- Idempotência: `claim_due_reminders` marca `push_sent_at`/`email_sent_at` na própria
-- transação que seleciona (`for update skip locked`). Duas execuções sobrepostas nunca
-- reclamam a mesma ocorrência para o mesmo canal. Entrega «no máximo uma vez»: se a
-- função morrer a meio, esse envio perde-se (preferível a duplicar).
--
-- Janela: só ocorrências devidas há menos de 24 h (sem enxurrada no primeiro deploy).
-- Anti-spam: lembretes de medicação (várias tomas por dia) vão só por push, nunca por email.

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- claim_due_reminders
-- ---------------------------------------------------------------------------
create function public.claim_due_reminders(p_limit integer default 100)
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
             'user_id', u.id, 'email', u.email, 'name', nullif(btrim(pr.name), ''))), '[]'::jsonb)
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

-- Devolve o «claim» de um canal (falha total do envio) para uma nova tentativa no ciclo seguinte.
create function public.release_reminder_claim(p_occurrence_id uuid, p_channel text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_channel = 'push' then
    update public.reminder_occurrences set push_sent_at = null where id = p_occurrence_id;
  elsif p_channel = 'email' then
    update public.reminder_occurrences set email_sent_at = null where id = p_occurrence_id;
  else
    raise exception 'Canal inválido: %', p_channel using errcode = '22023';
  end if;
end;
$$;

-- Subscrições push dos utilizadores indicados (para a Edge Function).
create function public.push_subscriptions_for(p_user_ids uuid[])
returns table (id uuid, user_id uuid, endpoint text, p256dh text, auth text)
language sql
security definer
stable
set search_path = ''
as $$
  select s.id, s.user_id, s.endpoint, s.p256dh, s.auth
  from public.push_subscriptions s
  where s.user_id = any (p_user_ids);
$$;

revoke all on function
  public.claim_due_reminders(integer),
  public.release_reminder_claim(uuid, text),
  public.push_subscriptions_for(uuid[])
  from public, anon, authenticated;
grant execute on function
  public.claim_due_reminders(integer),
  public.release_reminder_claim(uuid, text),
  public.push_subscriptions_for(uuid[])
  to service_role;

-- ---------------------------------------------------------------------------
-- run_reminder_cycle: o que o pg_cron corre. Os segredos vêm do Vault (nada em claro aqui):
--   patudos_functions_url  → ex.: https://<ref>.supabase.co/functions/v1
--   patudos_cron_secret    → o mesmo valor de CRON_SECRET nos secrets da função
-- Sem eles, só gera as ocorrências (útil em local e antes de configurar o envio).
-- ---------------------------------------------------------------------------
create function public.run_reminder_cycle()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  perform public.generate_reminder_occurrences();

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'patudos_functions_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'patudos_cron_secret';
  if v_url is null or v_secret is null then
    return;
  end if;

  perform net.http_post(
    url := rtrim(v_url, '/') || '/send-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;

revoke all on function public.run_reminder_cycle() from public, anon, authenticated;

select cron.schedule('patudos-reminders', '*/5 * * * *', $$select public.run_reminder_cycle()$$);
