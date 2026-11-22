-- Lembretes: criação automática, ocorrências (idempotência), «Feito» e RLS por animal.
begin;
select plan(63);

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  ('f1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'l-dono@example.test', now(), now()),
  ('f1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'l-cuid@example.test', now(), now()),
  ('f1000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'l-estranho@example.test', now(), now());

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

create function pg_temp.today() returns date language sql as $$
  select (now() at time zone 'Europe/Lisbon')::date $$;

-- ---------------------------------------------------------------------------
-- expand_rrule (função pura)
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from public.expand_rrule(
     'FREQ=DAILY;BYHOUR=8,20;BYMINUTE=0;BYSECOND=0',
     '2026-03-01 00:00 Europe/Lisbon', '2026-03-01 00:00 Europe/Lisbon', '2026-03-03 23:59 Europe/Lisbon')),
  6, 'expand_rrule: diário com 2 horas dá 2 por dia');
select is(
  (select count(*)::int from public.expand_rrule(
     'FREQ=DAILY;INTERVAL=2;BYHOUR=8;BYMINUTE=0',
     '2026-03-01 00:00 Europe/Lisbon', '2026-03-01 00:00 Europe/Lisbon', '2026-03-07 23:59 Europe/Lisbon')),
  4, 'expand_rrule: de 2 em 2 dias');
select is(
  (select array_agg(t at time zone 'Europe/Lisbon' order by t) from public.expand_rrule(
     'FREQ=MONTHLY', '2026-01-31 09:00 Europe/Lisbon', '2026-01-01 00:00 Europe/Lisbon', '2026-04-30 23:59 Europe/Lisbon') t),
  array['2026-01-31 09:00', '2026-02-28 09:00', '2026-03-31 09:00', '2026-04-30 09:00']::timestamp[],
  'expand_rrule: mensal no dia 31 cai no último dia do mês');
select is(
  (select count(*)::int from public.expand_rrule(
     'FREQ=MONTHLY;INTERVAL=3', '2026-01-10 09:00 Europe/Lisbon', '2026-01-01 00:00 Europe/Lisbon', '2026-12-31 23:59 Europe/Lisbon')),
  4, 'expand_rrule: de 3 em 3 meses');
select is(
  (select count(*)::int from public.expand_rrule(
     'FREQ=WEEKLY', '2026-03-02 09:00 Europe/Lisbon', '2026-03-01 00:00 Europe/Lisbon', '2026-03-31 23:59 Europe/Lisbon')),
  5, 'expand_rrule: semanal (segundas-feiras de março de 2026)');
select is(
  (select count(*)::int from public.expand_rrule(
     'FREQ=YEARLY', '2025-05-20 09:00 Europe/Lisbon', '2025-01-01 00:00 Europe/Lisbon', '2027-12-31 23:59 Europe/Lisbon')),
  3, 'expand_rrule: anual');
select is(
  (select count(*)::int from public.expand_rrule(
     'FREQ=DAILY;BYHOUR=8', '2026-03-01 00:00 Europe/Lisbon', '2026-03-01 00:00 Europe/Lisbon', '2026-03-10 23:59 Europe/Lisbon', '2026-03-03')),
  3, 'expand_rrule: respeita o fim (ends_on)');
select is(
  (select count(*)::int from public.expand_rrule('FREQ=HOURLY', now(), now(), now() + interval '2 days')),
  0, 'expand_rrule: regra não suportada não gera nada');
select is(
  (select (t at time zone 'Europe/Lisbon')::time from public.expand_rrule(
     'FREQ=DAILY;BYHOUR=8', '2026-03-28 00:00 Europe/Lisbon', '2026-03-29 00:00 Europe/Lisbon', '2026-03-29 23:59 Europe/Lisbon') t),
  time '08:00', 'expand_rrule: continua às 08:00 de Lisboa na mudança de hora');

-- ---------------------------------------------------------------------------
-- Preparação: dono + cuidador no animal; estranho sem acesso
-- ---------------------------------------------------------------------------
select pg_temp.act_as('f1000000-0000-0000-0000-000000000001');
insert into public.pets (id, name, species) values ('f0000000-0000-0000-0000-000000000001', 'Nina', 'dog');
insert into public.pet_members (pet_id, user_id, role)
values ('f0000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000002', 'caregiver');

-- ---------------------------------------------------------------------------
-- Lembrete automático de um evento de saúde (registado pelo cuidador)
-- ---------------------------------------------------------------------------
select pg_temp.act_as('f1000000-0000-0000-0000-000000000002');
select lives_ok($$
  select public.record_home_treatment(jsonb_build_object(
    'pet_id', 'f0000000-0000-0000-0000-000000000001', 'type', 'deworming_external',
    'title', 'Desparasitação externa', 'occurred_on', (pg_temp.today() - 31)::text,
    'next_due_on', (pg_temp.today() - 1)::text))
$$, 'cuidador regista tratamento com próxima data');

select is(
  (select count(*)::int from public.reminders where pet_id = 'f0000000-0000-0000-0000-000000000001' and source_type = 'health_event' and ended_at is null),
  1, 'evento com próxima data cria um lembrete');
select is(
  (select (due_at at time zone 'Europe/Lisbon')::time from public.reminders where source_type = 'health_event'),
  time '09:00', 'lembrete de saúde às 09:00 de Lisboa');
select is(
  (select created_by from public.reminders where source_type = 'health_event'),
  'f1000000-0000-0000-0000-000000000002'::uuid, 'lembrete herda created_by do evento');
select is(
  (select count(*)::int from public.reminder_occurrences where pet_id = 'f0000000-0000-0000-0000-000000000001'),
  1, 'lembrete único gera logo a sua ocorrência (em atraso)');

-- Novo registo do mesmo tratamento: o lembrete anterior termina; o novo fica ativo
select lives_ok($$
  select public.record_home_treatment(jsonb_build_object(
    'pet_id', 'f0000000-0000-0000-0000-000000000001', 'type', 'deworming_external',
    'title', 'Desparasitação externa', 'occurred_on', pg_temp.today()::text,
    'next_due_on', (pg_temp.today() + 30)::text))
$$, 'novo registo do mesmo tratamento');
select is(
  (select count(*)::int from public.reminders where source_type = 'health_event' and ended_at is null),
  1, 'só um lembrete ativo por tratamento');
select is(
  (select count(*)::int from public.reminders where source_type = 'health_event' and ended_at is not null),
  1, 'o lembrete da dose anterior ficou terminado');
select is(
  (select ((due_at at time zone 'Europe/Lisbon')::date) from public.reminders where source_type = 'health_event' and ended_at is null),
  pg_temp.today() + 30, 'o lembrete ativo é o da próxima data nova');

-- Tratamento diferente não mexe no anterior
select lives_ok($$
  select public.record_home_treatment(jsonb_build_object(
    'pet_id', 'f0000000-0000-0000-0000-000000000001', 'type', 'vaccine',
    'title', 'Antirrábica', 'occurred_on', pg_temp.today()::text,
    'next_due_on', (pg_temp.today() + 365)::text, 'remind', false))
$$, 'vacina com «Lembrar-me» desligado');
select is(
  (select count(*)::int from public.reminders where title = 'Antirrábica'),
  0, 'sem «Lembrar-me» não há lembrete');

-- Editar a próxima data atualiza o lembrete
update public.health_events set next_due_on = pg_temp.today() + 45
where title = 'Desparasitação externa' and occurred_on = pg_temp.today();
select is(
  (select ((due_at at time zone 'Europe/Lisbon')::date) from public.reminders where source_type = 'health_event' and ended_at is null),
  pg_temp.today() + 45, 'editar next_due_on move o lembrete');
select is(
  (select count(*)::int from public.reminder_occurrences o join public.reminders r on r.id = o.reminder_id
   where r.source_type = 'health_event' and r.ended_at is null),
  1, 'editar a data refaz a ocorrência (sem duplicar)');

-- ---------------------------------------------------------------------------
-- Medicação: lembrete recorrente; geração idempotente; terminar desativa
-- ---------------------------------------------------------------------------
select lives_ok($$
  insert into public.medications (id, pet_id, name, schedule_rrule, starts_on, ends_on)
  values ('f4000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'Meloxicam',
          'FREQ=DAILY;BYHOUR=8,20;BYMINUTE=0;BYSECOND=0', pg_temp.today(), pg_temp.today() + 6)
$$, 'cuidador cria medicação diária');
select is(
  (select count(*)::int from public.reminders where source_type = 'medication' and source_id = 'f4000000-0000-0000-0000-000000000001'),
  1, 'medicação com «remind» cria lembrete recorrente');
select is(
  (select count(*)::int from public.reminder_occurrences o join public.reminders r on r.id = o.reminder_id where r.source_type = 'medication'),
  14, '7 dias × 2 tomas = 14 ocorrências (respeita ends_on)');

reset role;
-- Só o lembrete deste teste (a BD local pode ter dados de outros testes; como superuser não há RLS).
select is(
  public.generate_reminder_occurrences((select id from public.reminders where source_id = 'f4000000-0000-0000-0000-000000000001')),
  0, 'gerar de novo não cria nada (idempotente)');
select is(
  (select count(*)::int from public.reminder_occurrences where pet_id = 'f0000000-0000-0000-0000-000000000001' and reminder_id = (select id from public.reminders where source_id = 'f4000000-0000-0000-0000-000000000001')),
  14, 'continua com 14 ocorrências (a geração não apaga as de hoje já passadas)');
-- Uma toma passada, marcada «Feito», sobrevive a nova geração
update public.reminder_occurrences set done_at = now(), done_by = 'f1000000-0000-0000-0000-000000000002'
where id = (select id from public.reminder_occurrences where reminder_id = (select id from public.reminders where source_id = 'f4000000-0000-0000-0000-000000000001') order by scheduled_for limit 1);
select public.generate_reminder_occurrences();
select is(
  (select count(*)::int from public.reminder_occurrences where reminder_id = (select id from public.reminders where source_id = 'f4000000-0000-0000-0000-000000000001') and done_at is not null),
  1, 'gerar não desfaz um «Feito»');
select pg_temp.act_as('f1000000-0000-0000-0000-000000000002');

select lives_ok($$update public.medications set ends_on = pg_temp.today() where id = 'f4000000-0000-0000-0000-000000000001'$$,
  'terminar a medicação');
select isnt(
  (select ended_at from public.reminders where source_type = 'medication'), null,
  'terminar a medicação termina o lembrete');
select lives_ok($$update public.medications set remind = false where id = 'f4000000-0000-0000-0000-000000000001'$$, 'desligar «remind»');
select is((select count(*)::int from public.reminders where source_type = 'medication'), 0, 'sem «remind» o lembrete desaparece');

-- ---------------------------------------------------------------------------
-- Lembrete manual (save_reminder) e RLS
-- ---------------------------------------------------------------------------
select lives_ok($$
  insert into public.reminders (id, pet_id, title, due_at, rrule, channels)
  values ('f5000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'Comprar ração',
          (pg_temp.today() + 3 + time '10:00') at time zone 'Europe/Lisbon', 'FREQ=MONTHLY', array['push'])
$$, 'cuidador cria lembrete manual (mensal)');
select lives_ok($$
  select public.save_reminder(jsonb_build_object(
    'pet_id', 'f0000000-0000-0000-0000-000000000001', 'title', ' Banho semanal ',
    'on', (pg_temp.today() + 1)::text, 'at', '09:30', 'rrule', 'FREQ=WEEKLY', 'channels', jsonb_build_array('push', 'email')))
$$, 'save_reminder cria (hora local de Lisboa)');
select is(
  (select ((due_at at time zone 'Europe/Lisbon')::time)::text || '|' || title from public.reminders where title like 'Banho semanal%'),
  '09:30:00|Banho semanal', 'save_reminder guarda a hora de Lisboa e apara o título');
select lives_ok($$
  select public.save_reminder(jsonb_build_object(
    'id', (select id from public.reminders where title = 'Banho semanal'),
    'pet_id', 'f0000000-0000-0000-0000-000000000001', 'title', 'Banho quinzenal',
    'on', (pg_temp.today() + 1)::text, 'at', '09:30', 'rrule', 'FREQ=WEEKLY;INTERVAL=2'))
$$, 'save_reminder edita');
delete from public.reminders where title = 'Banho quinzenal';
select is(
  (select count(*)::int from public.reminder_occurrences where reminder_id = 'f5000000-0000-0000-0000-000000000001'),
  1, 'lembrete mensal gera as ocorrências da janela de 30 dias');
select throws_ok($$
  insert into public.reminders (pet_id, title, due_at, source_type, source_id)
  values ('f0000000-0000-0000-0000-000000000001', 'x', now(), 'medication', gen_random_uuid())
$$, '42501', null, 'cuidador não cria lembretes «de origem» à mão');
select throws_ok($$
  insert into public.reminders (pet_id, title, due_at, created_by)
  values ('f0000000-0000-0000-0000-000000000001', 'x', now(), 'f1000000-0000-0000-0000-000000000001')
$$, '42501', null, 'cuidador não cria em nome de outro');

select pg_temp.act_as('f1000000-0000-0000-0000-000000000004');
select is((select count(*)::int from public.reminders), 0, 'estranho não vê lembretes');
select is((select count(*)::int from public.reminder_occurrences), 0, 'estranho não vê ocorrências');
select throws_ok($$
  insert into public.reminders (pet_id, title, due_at) values ('f0000000-0000-0000-0000-000000000001', 'x', now())
$$, '42501', null, 'estranho não cria lembretes');
select throws_ok($$select public.save_reminder(jsonb_build_object(
    'pet_id', 'f0000000-0000-0000-0000-000000000001', 'title', 'x', 'on', '2030-01-01', 'at', '10:00'))$$,
  '42501', null, 'estranho não cria por save_reminder');

-- Dono vê tudo e edita o do cuidador; cuidador não edita o que o dono criou
select pg_temp.act_as('f1000000-0000-0000-0000-000000000001');
select cmp_ok((select count(*)::int from public.reminders), '>=', 2, 'dono vê os lembretes do animal');
update public.reminders set active = false where id = 'f5000000-0000-0000-0000-000000000001';
select is((select active from public.reminders where id = 'f5000000-0000-0000-0000-000000000001'), false, 'dono pausa o lembrete do cuidador');
update public.reminders set active = true where id = 'f5000000-0000-0000-0000-000000000001';
select lives_ok($$
  insert into public.reminders (id, pet_id, title, due_at)
  values ('f5000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', 'Banho',
          (pg_temp.today() + 2 + time '18:00') at time zone 'Europe/Lisbon')
$$, 'dono cria lembrete manual (sem repetição)');

select pg_temp.act_as('f1000000-0000-0000-0000-000000000002');
update public.reminders set title = 'mudado' where id = 'f5000000-0000-0000-0000-000000000002';
delete from public.reminders where id = 'f5000000-0000-0000-0000-000000000002';
select is((select title from public.reminders where id = 'f5000000-0000-0000-0000-000000000002'), 'Banho', 'cuidador não edita nem apaga o lembrete do dono');
update public.reminders set title = 'Comprar areia' where id = 'f5000000-0000-0000-0000-000000000001';
select is((select title from public.reminders where id = 'f5000000-0000-0000-0000-000000000001'), 'Comprar areia', 'cuidador edita o que criou');
select throws_ok($$update public.reminders set pet_id = pet_id where id = 'f5000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'pet_id não se altera');

-- ---------------------------------------------------------------------------
-- «Feito» / «Desfazer»
-- ---------------------------------------------------------------------------
select throws_ok($$
  update public.reminder_occurrences set done_at = now() where reminder_id = 'f5000000-0000-0000-0000-000000000002'
$$, '42501', null, 'ocorrências não se escrevem diretamente');

-- O dono marca a ocorrência do lembrete do dono; o cuidador marca a do dono também
select pg_temp.act_as('f1000000-0000-0000-0000-000000000001');
select lives_ok($$
  select public.complete_occurrence((select id from public.reminder_occurrences where reminder_id = 'f5000000-0000-0000-0000-000000000002'))
$$, 'dono marca «Feito» (lembrete manual)');
select is(
  (select done_by from public.reminder_occurrences where reminder_id = 'f5000000-0000-0000-0000-000000000002'),
  'f1000000-0000-0000-0000-000000000001'::uuid, '«Feito» guarda quem fez');

-- Cuidador marca; dono vê «Feito por» o cuidador
select pg_temp.act_as('f1000000-0000-0000-0000-000000000002');
select lives_ok($$
  select public.complete_occurrence((select id from public.reminder_occurrences where reminder_id = 'f5000000-0000-0000-0000-000000000001' order by scheduled_for limit 1))
$$, 'cuidador marca «Feito» (lembrete manual)');
select pg_temp.act_as('f1000000-0000-0000-0000-000000000001');
select is(
  (select done_by from public.reminder_occurrences where reminder_id = 'f5000000-0000-0000-0000-000000000001' order by scheduled_for limit 1),
  'f1000000-0000-0000-0000-000000000002'::uuid, 'o dono vê quem (o cuidador) marcou «Feito»');
select lives_ok($$
  select public.uncomplete_occurrence((select id from public.reminder_occurrences where reminder_id = 'f5000000-0000-0000-0000-000000000001' order by scheduled_for limit 1))
$$, 'o dono desfaz o «Feito» do cuidador');
select is(
  (select done_at from public.reminder_occurrences where reminder_id = 'f5000000-0000-0000-0000-000000000001' order by scheduled_for limit 1),
  null, 'desfeito: done_at volta a nulo');

-- Estranho não marca nem desfaz
select pg_temp.act_as('f1000000-0000-0000-0000-000000000004');
select throws_ok($$
  select public.complete_occurrence((select id from public.reminder_occurrences limit 1))
$$, '42501', null, 'estranho não marca «Feito»');

-- «Feito» de tratamento: marca + regista o tratamento (próxima data) na mesma transação
select pg_temp.act_as('f1000000-0000-0000-0000-000000000002');
select lives_ok($$
  select public.complete_occurrence(
    (select o.id from public.reminder_occurrences o join public.reminders r on r.id = o.reminder_id
     where r.source_type = 'health_event' and r.ended_at is null),
    jsonb_build_object('type', 'deworming_external', 'title', 'Desparasitação externa',
      'occurred_on', pg_temp.today()::text, 'next_due_on', (pg_temp.today() + 60)::text))
$$, 'cuidador marca «Feito» num tratamento e regista-o');
select is(
  (select count(*)::int from public.health_events where title = 'Desparasitação externa' and next_due_on = pg_temp.today() + 60),
  1, 'o tratamento ficou registado com a próxima data');
select is(
  (select count(*)::int from public.reminders where source_type = 'health_event' and title = 'Desparasitação externa' and ended_at is null),
  1, 'continua só um lembrete ativo do tratamento (o novo)');
select is(
  (select count(*)::int from public.reminder_occurrences o join public.reminders r on r.id = o.reminder_id
   where r.source_type = 'health_event' and r.title = 'Desparasitação externa' and o.done_at is not null),
  1, 'a ocorrência antiga ficou «Feito»');

-- Apagar o lembrete apaga as ocorrências
select pg_temp.act_as('f1000000-0000-0000-0000-000000000001');
delete from public.reminders where id = 'f5000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.reminder_occurrences where reminder_id = 'f5000000-0000-0000-0000-000000000001'), 0,
  'apagar o lembrete apaga as ocorrências');

-- Apagar o evento mais recente reativa o anterior
delete from public.health_events where title = 'Desparasitação externa' and next_due_on = pg_temp.today() + 60;
select is(
  (select count(*)::int from public.reminders where source_type = 'health_event' and title = 'Desparasitação externa' and ended_at is null),
  1, 'apagar a dose mais recente volta a ativar o lembrete anterior');

select * from finish();
rollback;
