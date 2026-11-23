-- Envio de lembretes: seleção (janela de 24 h, canais, notify), idempotência e anti-spam.
begin;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  ('f3000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sr-dono@example.test', now(), now()),
  ('f3000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sr-mudo@example.test', now(), now()),
  ('f3000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sr-cuid@example.test', now(), now()),
  ('f3000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sr-estranho@example.test', now(), now());
update public.profiles set name = 'Pedro' where id = 'f3000000-0000-0000-0000-000000000001';

update public.profiles set reminder_emails = false where id = 'f3000000-0000-0000-0000-000000000003';

-- (corre como superutilizador: sem RLS)
insert into public.pets (id, name, species, created_by)
values ('f3100000-0000-0000-0000-000000000001', 'Nina', 'dog', 'f3000000-0000-0000-0000-000000000001');
insert into public.pet_members (pet_id, user_id, role, notify)
values
  ('f3100000-0000-0000-0000-000000000001', 'f3000000-0000-0000-0000-000000000002', 'caregiver', false),
  ('f3100000-0000-0000-0000-000000000001', 'f3000000-0000-0000-0000-000000000003', 'caregiver', true)
on conflict (pet_id, user_id) do update set notify = excluded.notify;

-- Lembretes (a ocorrência é criada pelo trigger)
insert into public.reminders (id, pet_id, title, due_at, channels) values
  ('f3200000-0000-0000-0000-000000000001', 'f3100000-0000-0000-0000-000000000001', 'Manual push+email', now() - interval '1 hour', array['push','email']),
  ('f3200000-0000-0000-0000-000000000002', 'f3100000-0000-0000-0000-000000000001', 'Antigo', now() - interval '30 hours', array['push','email']),
  ('f3200000-0000-0000-0000-000000000003', 'f3100000-0000-0000-0000-000000000001', 'Só calendário', now() - interval '1 hour', array['calendar']),
  ('f3200000-0000-0000-0000-000000000004', 'f3100000-0000-0000-0000-000000000001', 'Futuro', now() + interval '2 hours', array['push','email']),
  ('f3200000-0000-0000-0000-000000000005', 'f3100000-0000-0000-0000-000000000001', 'Só email', now() - interval '1 hour', array['email']);
insert into public.reminders (id, pet_id, title, due_at, channels, source_type, source_id) values
  ('f3200000-0000-0000-0000-000000000006', 'f3100000-0000-0000-0000-000000000001', 'Medicação', now() - interval '1 hour', array['push','email','calendar'], 'medication', 'f3300000-0000-0000-0000-000000000001');
insert into public.reminders (id, pet_id, title, due_at, channels) values
  ('f3200000-0000-0000-0000-000000000007', 'f3100000-0000-0000-0000-000000000001', 'Feito', now() - interval '1 hour', array['push','email']),
  ('f3200000-0000-0000-0000-000000000008', 'f3100000-0000-0000-0000-000000000001', 'Inativo', now() - interval '1 hour', array['push','email']);
update public.reminder_occurrences set done_at = now() where reminder_id = 'f3200000-0000-0000-0000-000000000007';
update public.reminders set active = false where id = 'f3200000-0000-0000-0000-000000000008';

-- Lembrete de saúde, com «Da última vez»
insert into public.health_events (id, pet_id, type, occurred_on, title, product, next_due_on, created_by)
values ('f3400000-0000-0000-0000-000000000001', 'f3100000-0000-0000-0000-000000000001', 'deworming_external',
        (now() at time zone 'Europe/Lisbon')::date - 30, 'Desparasitação externa', 'Pipeta Advantix',
        (now() at time zone 'Europe/Lisbon')::date, 'f3000000-0000-0000-0000-000000000001');
update public.reminders set due_at = now() - interval '2 hours'
where source_type = 'health_event' and source_id = 'f3400000-0000-0000-0000-000000000001';

-- (a BD local tem dados do seed: o primeiro claim apanha-os também; filtramos pelo nosso animal)
create temp table claimed as
  select coalesce(jsonb_agg(e), '[]'::jsonb) as j
  from jsonb_array_elements(public.claim_due_reminders(100)) e
  where e ->> 'pet_id' = 'f3100000-0000-0000-0000-000000000001';

select is(
  (select jsonb_array_length(j) from claimed), 4,
  'reclama só: manual, só email, medicação e saúde (não: antigo, calendário, futuro, feito, inativo)');
select is(
  (select array_agg(e ->> 'title' order by e ->> 'title') from claimed, jsonb_array_elements(j) e),
  array['Desparasitação externa', 'Manual push+email', 'Medicação', 'Só email'],
  'os lembretes certos');

select is(
  (select (e ->> 'push')::boolean from claimed, jsonb_array_elements(j) e where e ->> 'title' = 'Manual push+email'),
  true, 'manual: push');
select is(
  (select (e ->> 'email')::boolean from claimed, jsonb_array_elements(j) e where e ->> 'title' = 'Manual push+email'),
  true, 'manual: email');
select is(
  (select (e ->> 'push')::boolean from claimed, jsonb_array_elements(j) e where e ->> 'title' = 'Medicação'),
  true, 'medicação: push');
select is(
  (select (e ->> 'email')::boolean from claimed, jsonb_array_elements(j) e where e ->> 'title' = 'Medicação'),
  false, 'anti-spam: medicação nunca vai por email');
select is(
  (select (e ->> 'push')::boolean from claimed, jsonb_array_elements(j) e where e ->> 'title' = 'Só email'),
  false, 'só email: sem push');

select is(
  (select array_agg(r ->> 'email' order by r ->> 'email')
   from claimed, jsonb_array_elements(j) e, jsonb_array_elements(e -> 'recipients') r
   where e ->> 'title' = 'Manual push+email'),
  array['sr-cuid@example.test', 'sr-dono@example.test'],
  'destinatários: membros com notify (o que desligou não recebe; estranho não recebe)');

select is(
  (select array_agg((r ->> 'email') || '=' || (r ->> 'reminder_emails') order by r ->> 'email')
   from claimed, jsonb_array_elements(j) e, jsonb_array_elements(e -> 'recipients') r
   where e ->> 'title' = 'Manual push+email'),
  array['sr-cuid@example.test=false', 'sr-dono@example.test=true'],
  'reminder_emails por destinatário (desligado no Perfil = false; por defeito = true)');

select is(
  (select e -> 'last' ->> 'product' from claimed, jsonb_array_elements(j) e where e ->> 'title' = 'Desparasitação externa'),
  'Pipeta Advantix', 'da última vez: produto');
select is(
  (select e -> 'last' ->> 'by' from claimed, jsonb_array_elements(j) e where e ->> 'title' = 'Desparasitação externa'),
  'Pedro', 'da última vez: quem registou');

-- Marcas
select isnt(
  (select push_sent_at from public.reminder_occurrences where reminder_id = 'f3200000-0000-0000-0000-000000000001'),
  null, 'push_sent_at marcado');
select isnt(
  (select email_sent_at from public.reminder_occurrences where reminder_id = 'f3200000-0000-0000-0000-000000000001'),
  null, 'email_sent_at marcado');
select is(
  (select email_sent_at from public.reminder_occurrences where reminder_id = 'f3200000-0000-0000-0000-000000000006'),
  null, 'medicação: email_sent_at fica por marcar (nunca é enviado)');

-- Idempotência
select is(public.claim_due_reminders(100), '[]'::jsonb, 'segunda execução não reclama nada (sem duplicados)');

-- Devolver o claim → volta a ser reclamado, só nesse canal
select lives_ok($$ select public.release_reminder_claim(o.id, 'push')
  from public.reminder_occurrences o where o.reminder_id = 'f3200000-0000-0000-0000-000000000001' $$,
  'release do canal push');
create temp table again as select public.claim_due_reminders(100) as j;
select is(
  (select jsonb_array_length(j) from again), 1, 'só a ocorrência devolvida é reclamada outra vez');
select is(
  (select (e ->> 'push')::boolean || '/' || (e ->> 'email')::boolean from again, jsonb_array_elements(j) e),
  'true/false', 'só no canal devolvido');
select throws_ok($$ select public.release_reminder_claim(gen_random_uuid(), 'sms') $$, '22023', null, 'canal inválido');

-- Marcar «Feito» antes do envio impede-o
insert into public.reminders (id, pet_id, title, due_at, channels)
values ('f3200000-0000-0000-0000-000000000009', 'f3100000-0000-0000-0000-000000000001', 'Feito a tempo', now() - interval '10 minutes', array['push']);
update public.reminder_occurrences set done_at = now() where reminder_id = 'f3200000-0000-0000-0000-000000000009';
select is(public.claim_due_reminders(100), '[]'::jsonb, 'ocorrência já feita não é enviada');

-- Animal arquivado não envia
insert into public.reminders (id, pet_id, title, due_at, channels)
values ('f3200000-0000-0000-0000-00000000000a', 'f3100000-0000-0000-0000-000000000001', 'Arquivado', now() - interval '10 minutes', array['push']);
update public.pets set archived_at = now() where id = 'f3100000-0000-0000-0000-000000000001';
select is(public.claim_due_reminders(100), '[]'::jsonb, 'animal arquivado não recebe lembretes');
update public.pets set archived_at = null where id = 'f3100000-0000-0000-0000-000000000001';

-- Subscrições para a função de envio
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
values ('f3000000-0000-0000-0000-000000000001', 'https://push.example.test/1', 'p', 'a'),
       ('f3000000-0000-0000-0000-000000000004', 'https://push.example.test/4', 'p', 'a');
select is(
  (select count(*)::int from public.push_subscriptions_for(array['f3000000-0000-0000-0000-000000000001']::uuid[])),
  1, 'push_subscriptions_for devolve só as dos utilizadores pedidos');

-- Cada pessoa altera a sua preferência (e só a sua)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f3000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
update public.profiles set reminder_emails = false where id = 'f3000000-0000-0000-0000-000000000004';
update public.profiles set reminder_emails = false where id = 'f3000000-0000-0000-0000-000000000001';
reset role;
select is((select reminder_emails from public.profiles where id = 'f3000000-0000-0000-0000-000000000004'), false, 'edita a própria preferência de emails');
select is((select reminder_emails from public.profiles where id = 'f3000000-0000-0000-0000-000000000001'), true, 'não edita a de outra pessoa');

-- Permissões: só o service_role
set local role authenticated;
select throws_ok($$ select public.claim_due_reminders(1) $$, '42501', null, 'authenticated não pode reclamar');
select throws_ok($$ select public.release_reminder_claim(gen_random_uuid(), 'push') $$, '42501', null, 'authenticated não pode devolver claims');
select throws_ok($$ select * from public.push_subscriptions_for(array[]::uuid[]) $$, '42501', null, 'authenticated não lê subscrições de outros');
select throws_ok($$ select public.run_reminder_cycle() $$, '42501', null, 'authenticated não corre o ciclo');
reset role;
set local role anon;
select throws_ok($$ select public.claim_due_reminders(1) $$, '42501', null, 'anon não pode reclamar');
reset role;

-- Cron agendado, sem segredos configurados só gera ocorrências
select is(
  (select schedule from cron.job where jobname = 'patudos-reminders'), '*/5 * * * *',
  'pg_cron agendado de 5 em 5 minutos');
select lives_ok($$ select public.run_reminder_cycle() $$, 'run_reminder_cycle corre sem segredos no Vault');

select * from finish();
rollback;
