-- Apagar conta (RGPD): delete_account(p_pet_ids).
begin;
select plan(36);

-- Utilizadores: dono, cuidadores, co-dono, estranho e uma cuidadora só do animal partilhado.
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  ('a1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'x-dono@example.test', now(), now()),
  ('a1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'x-cuid2@example.test', now(), now()),
  ('a1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'x-cuid3@example.test', now(), now()),
  ('a1000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'x-codono@example.test', now(), now()),
  ('a1000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'x-estranho@example.test', now(), now()),
  ('a1000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'x-cuid6@example.test', now(), now());

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

-- Animais (o trigger faz do criador o dono):
--  P1 Nina: dono 1, cuidadores 2 e 3          (sem transferir → apagada)
--  P2 Mimi: dono 1, cuidador 3                (com transferência → fica ao 3)
--  P3 Simba: dono 1, sem mais ninguém         (apagado)
--  P4 Pimenta: donos 1 e 4, cuidadores 2 e 6  (fica)
insert into public.pets (id, name, species, created_by) values
  ('a0000000-0000-0000-0000-000000000001', 'Nina', 'dog', 'a1000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000002', 'Mimi', 'cat', 'a1000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000003', 'Simba', 'cat', 'a1000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000004', 'Pimenta', 'cat', 'a1000000-0000-0000-0000-000000000001');
insert into public.pet_members (pet_id, user_id, role) values
  ('a0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 'caregiver'),
  ('a0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000003', 'caregiver'),
  ('a0000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000003', 'caregiver'),
  ('a0000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000004', 'owner'),
  ('a0000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000002', 'caregiver'),
  ('a0000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000006', 'caregiver');

-- Registos do dono (1) e da cuidadora 6 no animal que fica (P4); registos nos que vão desaparecer.
insert into public.vet_visits (id, pet_id, reason, created_by) values
  ('a2000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'Consulta do dono', 'a1000000-0000-0000-0000-000000000001'),
  ('a2000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Consulta da Nina', 'a1000000-0000-0000-0000-000000000001');
insert into public.weights (id, pet_id, weight_kg, created_by) values
  ('a3000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 4.2, 'a1000000-0000-0000-0000-000000000006'),
  ('a3000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004', 4.3, 'a1000000-0000-0000-0000-000000000001'),
  ('a3000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 20, 'a1000000-0000-0000-0000-000000000001');
insert into public.documents (id, pet_id, kind, title, storage_path, created_by) values
  ('a4000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'invoice', 'Fatura', 'a0000000-0000-0000-0000-000000000004/_fatura.pdf', 'a1000000-0000-0000-0000-000000000001');
insert into public.reminders (id, pet_id, title, due_at, created_by) values
  ('a5000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'Ração', now(), 'a1000000-0000-0000-0000-000000000001');
update public.reminder_occurrences set done_at = now(), done_by = 'a1000000-0000-0000-0000-000000000001'
where reminder_id = 'a5000000-0000-0000-0000-000000000001';

-- Despesas: X1 partilhada entre P1 (apagada) e P4 (fica); X2 só de P3; X3 só de P4 paga pelo dono.
insert into public.expenses (id, category, amount_cents, paid_by, created_by) values
  ('a7000000-0000-0000-0000-000000000001', 'food', 3000, 'a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001'),
  ('a7000000-0000-0000-0000-000000000002', 'food', 500, 'a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001'),
  ('a7000000-0000-0000-0000-000000000003', 'hygiene', 700, 'a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001');
insert into public.expense_splits (expense_id, pet_id, amount_cents) values
  ('a7000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 1000),
  ('a7000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 2000),
  ('a7000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 500),
  ('a7000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004', 700);

-- Convites: um enviado pelo dono (pendente) e um dirigido ao email do dono.
insert into public.pet_invites (pet_id, email, invited_by) values
  ('a0000000-0000-0000-0000-000000000004', 'novo@example.test', 'a1000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000004', 'x-dono@example.test', 'a1000000-0000-0000-0000-000000000004');
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values
  ('a1000000-0000-0000-0000-000000000001', 'https://push.example.test/1', 'k', 'a');
insert into public.calendar_feeds (user_id, token) values
  ('a1000000-0000-0000-0000-000000000001', repeat('t', 43));

-- ---------------------------------------------------------------------------
-- Segurança: sem sessão não há nada para apagar; ninguém apaga a conta de outro
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '', true);
set local role authenticated;
select throws_ok($$select public.delete_account('{}')$$, '42501', 'forbidden', 'sem sessão: recusado');
reset role;
set local role anon;
select throws_ok($$select public.delete_account('{}')$$, '42501', null, 'anónimo não pode executar a função');
reset role;

-- O estranho (5) só consegue apagar a própria conta, mesmo passando os animais do dono
select pg_temp.act_as('a1000000-0000-0000-0000-000000000005');
select throws_ok($$select public.delete_account('{a0000000-0000-0000-0000-000000000001}')$$,
  'P0001', 'plan_changed', 'estranho não apaga animais de outro (lista não bate)');
select lives_ok($$select public.delete_account('{}')$$, 'estranho apaga a sua própria conta');
reset role;
select is((select count(*)::int from auth.users where id = 'a1000000-0000-0000-0000-000000000001'), 1, 'a conta do dono não foi tocada');
select is((select count(*)::int from auth.users where id = 'a1000000-0000-0000-0000-000000000005'), 0, 'a conta do estranho desapareceu');
select is((select count(*)::int from public.pets where id::text like 'a0000000%'), 4, 'nenhum animal foi tocado');

-- ---------------------------------------------------------------------------
-- Cuidadora só do animal partilhado (6): o animal fica, os registos ficam sem autor
-- ---------------------------------------------------------------------------
select pg_temp.act_as('a1000000-0000-0000-0000-000000000006');
select lives_ok($$select public.delete_account('{}')$$, 'cuidadora apaga a conta');
reset role;
select is((select count(*)::int from auth.users where id = 'a1000000-0000-0000-0000-000000000006'), 0, 'cuidadora: utilizador apagado');
select is((select count(*)::int from public.profiles where id = 'a1000000-0000-0000-0000-000000000006'), 0, 'cuidadora: perfil apagado');
select is((select count(*)::int from public.pets where id = 'a0000000-0000-0000-0000-000000000004'), 1, 'cuidadora: o animal fica');
select ok((select created_by is null from public.weights where id = 'a3000000-0000-0000-0000-000000000001'), 'cuidadora: o registo fica com o autor a null');
select is((select weight_kg from public.weights where id = 'a3000000-0000-0000-0000-000000000001'), 4.2::numeric, 'cuidadora: o registo mantém-se');
select is((select count(*)::int from public.pet_members where pet_id = 'a0000000-0000-0000-0000-000000000004'), 3, 'cuidadora: deixa de ser membro');

-- ---------------------------------------------------------------------------
-- Dono (1): a lista tem de bater certo com o que vai ser apagado
-- ---------------------------------------------------------------------------
select pg_temp.act_as('a1000000-0000-0000-0000-000000000001');
select throws_ok($$select public.delete_account('{}')$$, 'P0001', 'plan_changed',
  'dono: lista vazia não bate (tem animais só dele)');
select throws_ok($$select public.delete_account('{a0000000-0000-0000-0000-000000000003}')$$, 'P0001', 'plan_changed',
  'dono: lista incompleta não bate');
select throws_ok($$select public.delete_account('{a0000000-0000-0000-0000-000000000001,a0000000-0000-0000-0000-000000000002,a0000000-0000-0000-0000-000000000003,a0000000-0000-0000-0000-000000000004}')$$,
  'P0001', 'plan_changed', 'dono: não se apaga um animal com outro dono');

-- Transferência: a cuidadora 3 passa a dona da Mimi (P2), como no ecrã Pessoas
update public.pet_members set role = 'owner'
where pet_id = 'a0000000-0000-0000-0000-000000000002' and user_id = 'a1000000-0000-0000-0000-000000000003';

-- Sem transferir (P1), com cuidadores; P3 sem membros; P2 já transferido; P4 tem outro dono
select lives_ok($$select public.delete_account('{a0000000-0000-0000-0000-000000000003,a0000000-0000-0000-0000-000000000001}')$$,
  'dono apaga a conta (lista fora de ordem e com os animais certos)');
reset role;

select is((select count(*)::int from auth.users where id = 'a1000000-0000-0000-0000-000000000001'), 0, 'dono: utilizador apagado');
select is((select count(*)::int from public.pets where id in
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003')), 0,
  'dono: Nina (com cuidadores, sem transferir) e Simba (sem membros) apagados');
select is((select count(*)::int from public.pet_members where pet_id = 'a0000000-0000-0000-0000-000000000001'), 0,
  'sem transferir: os cuidadores perdem o acesso');
select is((select count(*)::int from public.vet_visits where pet_id = 'a0000000-0000-0000-0000-000000000001')
  + (select count(*)::int from public.weights where pet_id = 'a0000000-0000-0000-0000-000000000001'), 0,
  'dono: o historial dos animais apagados desaparece');
select is((select role from public.pet_members where pet_id = 'a0000000-0000-0000-0000-000000000002'
  and user_id = 'a1000000-0000-0000-0000-000000000003'), 'owner', 'com transferência: a Mimi fica com a nova dona');
select is((select count(*)::int from public.pet_members where pet_id = 'a0000000-0000-0000-0000-000000000004'), 2,
  'animal com outro dono: só o dono que saiu deixa de ser membro');

-- O que fica no animal partilhado (P4) perde só o autor
select ok((select created_by is null from public.vet_visits where id = 'a2000000-0000-0000-0000-000000000001'), 'consulta fica sem autor');
select ok((select created_by is null from public.documents where id = 'a4000000-0000-0000-0000-000000000001'), 'documento fica sem autor (e continua a existir)');
select ok((select created_by is null from public.reminders where id = 'a5000000-0000-0000-0000-000000000001'), 'lembrete fica sem autor');
select ok((select done_by is null and done_at is not null from public.reminder_occurrences where reminder_id = 'a5000000-0000-0000-0000-000000000001'), 'ocorrência feita fica sem done_by');
select ok((select paid_by is null and created_by is null from public.expenses where id = 'a7000000-0000-0000-0000-000000000003'), 'despesa fica sem pago-por e sem autor');

-- Despesas: a partilhada perde a parte do animal apagado; a que era só do animal apagado desaparece
select is((select amount_cents from public.expenses where id = 'a7000000-0000-0000-0000-000000000001'), 2000,
  'despesa partilhada: o total passa a ser só a parte do animal que fica');
select is((select count(*)::int from public.expenses where id = 'a7000000-0000-0000-0000-000000000002'), 0,
  'despesa só do animal apagado desaparece');

-- Convites e dados pessoais
select is((select count(*)::int from public.pet_invites where pet_id::text like 'a0000000%'), 0, 'convites enviados e dirigidos ao dono desaparecem');
select is((select count(*)::int from public.push_subscriptions where endpoint like 'https://push.example.test/%') + (select count(*)::int from public.calendar_feeds where token = repeat('t', 43)), 0,
  'subscrições push e feed de calendário desaparecem');

-- Idempotência: repetir com a mesma sessão (já apagada) não falha nem toca em mais nada
select pg_temp.act_as('a1000000-0000-0000-0000-000000000001');
select lives_ok($$select public.delete_account('{}')$$, 'repetir o apagamento não falha');
reset role;
select is((select count(*)::int from public.pets where id::text like 'a0000000%'), 2, 'repetir não apaga mais animais (Mimi e Pimenta ficam)');

-- Os totais continuam coerentes no fim da transação (os triggers são diferidos)
set constraints all immediate;
select pass('despesas coerentes no fim da transação');

select * from finish();
rollback;
