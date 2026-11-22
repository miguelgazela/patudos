-- save_expense (criar/editar com splits) e expense_overview (totais com despesas partilhadas).
-- Nina: dona Ana, cuidador Bruno. Simba: dona Carla, cuidador Bruno. Estranho não partilha nada.
begin;
select plan(39);

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  ('e1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'es-ana@example.test', now(), now()),
  ('e1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'es-bruno@example.test', now(), now()),
  ('e1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'es-carla@example.test', now(), now()),
  ('e1000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'es-estranho@example.test', now(), now());

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

select pg_temp.act_as('e1000000-0000-0000-0000-000000000001');
insert into public.pets (id, name, species) values ('e0000000-0000-0000-0000-000000000001', 'Nina', 'dog');
insert into public.pet_members (pet_id, user_id, role)
values ('e0000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000002', 'caregiver');

select pg_temp.act_as('e1000000-0000-0000-0000-000000000003');
insert into public.pets (id, name, species) values ('e0000000-0000-0000-0000-000000000002', 'Simba', 'cat');
insert into public.pet_members (pet_id, user_id, role)
values ('e0000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000002', 'caregiver');

-- ===== Criar =====
select pg_temp.act_as('e1000000-0000-0000-0000-000000000002');

select lives_ok($$select public.save_expense('{
  "amount_cents": 2501, "category": "food", "spent_on": "2026-11-10", "description": "Ração",
  "splits": [
    {"pet_id": "e0000000-0000-0000-0000-000000000001", "amount_cents": 1251},
    {"pet_id": "e0000000-0000-0000-0000-000000000002", "amount_cents": 1250}
  ]}'::jsonb)$$, 'cuidador dos dois animais cria despesa dividida');
select is((select count(*)::int from public.expense_splits s join public.expenses e on e.id = s.expense_id where e.description = 'Ração'), 2,
  'criou os dois splits');
select is((select amount_cents from public.expenses where description = 'Ração'), 2501, 'total guardado');
select is((select paid_by from public.expenses where description = 'Ração'), 'e1000000-0000-0000-0000-000000000002'::uuid,
  'pago por é quem regista, por defeito');
select lives_ok($$set constraints all immediate$$, 'a soma dos splits bate certo no fim da transação');
set constraints all deferred;

select throws_ok($$select public.save_expense('{
  "amount_cents": 1000, "category": "food",
  "splits": [{"pet_id": "e0000000-0000-0000-0000-000000000001", "amount_cents": 400}]}'::jsonb)$$,
  '23514', null, 'soma dos splits diferente do total é rejeitada');
select throws_ok($$select public.save_expense('{"amount_cents": 1000, "category": "food", "splits": []}'::jsonb)$$,
  '23514', null, 'sem animais é rejeitado');
select throws_ok($$select public.save_expense('{"amount_cents": 1000, "category": "food"}'::jsonb)$$,
  '23514', null, 'sem splits é rejeitado');
select throws_ok($$select public.save_expense('{
  "amount_cents": 1000, "category": "food",
  "splits": [
    {"pet_id": "e0000000-0000-0000-0000-000000000001", "amount_cents": 500},
    {"pet_id": "e0000000-0000-0000-0000-000000000001", "amount_cents": 500}
  ]}'::jsonb)$$, '23514', null, 'animal repetido é rejeitado');
select throws_ok($$select public.save_expense('{
  "amount_cents": 1000, "category": "viagens",
  "splits": [{"pet_id": "e0000000-0000-0000-0000-000000000001", "amount_cents": 1000}]}'::jsonb)$$,
  '23514', null, 'categoria inválida é rejeitada');
select throws_ok($$select public.save_expense('{
  "amount_cents": 1000, "category": "food", "paid_by": "e1000000-0000-0000-0000-000000000004",
  "splits": [{"pet_id": "e0000000-0000-0000-0000-000000000001", "amount_cents": 1000}]}'::jsonb)$$,
  '42501', null, '«pago por» tem de partilhar um animal com quem regista');
select lives_ok($$select public.save_expense('{
  "amount_cents": 1000, "category": "hygiene", "paid_by": "e1000000-0000-0000-0000-000000000001", "spent_on": "2026-11-12",
  "description": "Areia",
  "splits": [{"pet_id": "e0000000-0000-0000-0000-000000000001", "amount_cents": 1000}]}'::jsonb)$$,
  '«pago por» pode ser quem partilha o animal');

-- A Ana não divide por um animal a que não tem acesso
select pg_temp.act_as('e1000000-0000-0000-0000-000000000001');
select throws_ok($$select public.save_expense('{
  "amount_cents": 1000, "category": "food",
  "splits": [
    {"pet_id": "e0000000-0000-0000-0000-000000000001", "amount_cents": 500},
    {"pet_id": "e0000000-0000-0000-0000-000000000002", "amount_cents": 500}
  ]}'::jsonb)$$, '42501', null, 'não se divide por animal sem acesso');
select is((select count(*)::int from public.expenses where amount_cents = 1000 and category = 'food'), 0,
  'e nada fica gravado (a transação da função reverte)');

-- ===== Editar =====
-- Ana (dona só da Nina) não edita a despesa partilhada criada pelo Bruno
select throws_ok($$select public.save_expense(jsonb_build_object(
  'id', (select id from public.expenses where description = 'Ração'),
  'amount_cents', 2501, 'category', 'food', 'description', 'da Ana'))$$,
  '42501', null, 'dona de um só dos animais não edita despesa partilhada de outro');
-- mas edita a despesa só da Nina criada pelo Bruno (é dona de todos os animais dos splits)
select lives_ok($$select public.save_expense(jsonb_build_object(
  'id', (select id from public.expenses where description = 'Areia'),
  'amount_cents', 1000, 'category', 'hygiene', 'description', 'Areia (Ana)'))$$,
  'dono edita despesa de cuidador só do seu animal');
select is((select description from public.expenses where description = 'Areia (Ana)'), 'Areia (Ana)', 'descrição mudou');

select pg_temp.act_as('e1000000-0000-0000-0000-000000000004');
select throws_ok($$select public.save_expense('{"id": "00000000-0000-0000-0000-00000000dead", "amount_cents": 1, "category": "food"}'::jsonb)$$,
  '42501', null, 'estranho não edita nem despesa inexistente');

select pg_temp.act_as('e1000000-0000-0000-0000-000000000002');
-- só campos (sem splits): o total e os animais ficam
select lives_ok($$select public.save_expense(jsonb_build_object(
  'id', (select id from public.expenses where description = 'Ração'),
  'amount_cents', 99999, 'category', 'veterinary', 'spent_on', '2026-11-11', 'description', 'Ração', 'paid_by', 'e1000000-0000-0000-0000-000000000001'))$$,
  'edita só os campos');
select is((select amount_cents from public.expenses where description = 'Ração'), 2501, 'o total não mudou sem splits');
select is((select category from public.expenses where description = 'Ração'), 'veterinary', 'a categoria mudou');
select is((select paid_by from public.expenses where description = 'Ração'), 'e1000000-0000-0000-0000-000000000001'::uuid, '«pago por» mudou');
-- com splits: troca valores e retira um animal
select lives_ok($$select public.save_expense(jsonb_build_object(
  'id', (select id from public.expenses where description = 'Ração'),
  'amount_cents', 3000, 'category', 'food', 'description', 'Ração',
  'splits', jsonb_build_array(jsonb_build_object('pet_id', 'e0000000-0000-0000-0000-000000000001', 'amount_cents', 3000))))$$,
  'edita total e animais');
select is((select count(*)::int from public.expense_splits s join public.expenses e on e.id = s.expense_id where e.description = 'Ração'), 1,
  'o animal retirado perdeu o split');
select is((select amount_cents from public.expenses where description = 'Ração'), 3000, 'novo total');
select throws_ok($$select public.save_expense(jsonb_build_object(
  'id', (select id from public.expenses where description = 'Ração'),
  'amount_cents', 3000, 'category', 'food',
  'splits', jsonb_build_array(jsonb_build_object('pet_id', 'e0000000-0000-0000-0000-000000000001', 'amount_cents', 2999))))$$,
  '23514', null, 'na edição, soma diferente do total é rejeitada');

-- ===== Splits invisíveis: o Bruno cria Nina 400 + Simba 600; depois a Carla retira-o do Simba =====
select lives_ok($$select public.save_expense('{
  "amount_cents": 1000, "category": "other", "spent_on": "2026-11-15", "description": "Partilhada",
  "splits": [
    {"pet_id": "e0000000-0000-0000-0000-000000000001", "amount_cents": 400},
    {"pet_id": "e0000000-0000-0000-0000-000000000002", "amount_cents": 600}
  ]}'::jsonb)$$, 'cria despesa partilhada');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000003');
delete from public.pet_members where pet_id = 'e0000000-0000-0000-0000-000000000002' and user_id = 'e1000000-0000-0000-0000-000000000002';

select pg_temp.act_as('e1000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.expense_splits s join public.expenses e on e.id = s.expense_id where e.description = 'Partilhada'), 1,
  'o criador só vê o split da Nina');
select is(public.expense_hidden_cents((select id from public.expenses where description = 'Partilhada')), 600::bigint,
  'a parte escondida é a do Simba');
select throws_ok($$select public.save_expense(jsonb_build_object(
  'id', (select id from public.expenses where description = 'Partilhada'),
  'amount_cents', 3000, 'category', 'other',
  'splits', jsonb_build_array(jsonb_build_object('pet_id', 'e0000000-0000-0000-0000-000000000001', 'amount_cents', 400))))$$,
  '23514', null, 'o total tem de incluir a parte escondida');
select lives_ok($$select public.save_expense(jsonb_build_object(
  'id', (select id from public.expenses where description = 'Partilhada'),
  'amount_cents', 1300, 'category', 'other', 'description', 'Partilhada',
  'splits', jsonb_build_array(jsonb_build_object('pet_id', 'e0000000-0000-0000-0000-000000000001', 'amount_cents', 700))))$$,
  'edita a parte visível; a escondida fica');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000003');
select is((select amount_cents from public.expense_splits s where s.pet_id = 'e0000000-0000-0000-0000-000000000002' and s.expense_id = (select id from public.expenses where description = 'Partilhada')), 600,
  'a dona do Simba continua a ver o seu split intacto');

-- ===== Resumos (Nov 2026) =====
-- Ana vê: Ração 3000 (Nina, veterinário→food), Areia 1000 (Nina), Partilhada 700 (só Nina) = 4700
select pg_temp.act_as('e1000000-0000-0000-0000-000000000001');
select is((public.expense_overview('2026-11-01', '2026-12-01') ->> 'total_cents')::int, 4700,
  'a dona da Nina soma só os splits da Nina (partilhada conta 7,00 €, não 13,00 €)');
select is((public.expense_overview('2026-11-01', '2026-12-01') -> 'items' -> 0 ->> 'total_cents')::int, 1300,
  'o item da partilhada mantém o total da despesa para contexto');
select is(jsonb_array_length(public.expense_overview('2026-11-01', '2026-12-01', null, 'hygiene') -> 'items'), 1, 'filtro por categoria');
select is((public.expense_overview('2026-11-01', '2026-12-01', null, null, 'e1000000-0000-0000-0000-000000000001') ->> 'total_cents')::int, 4000,
  'filtro por quem pagou (Ana pagou a ração e a areia)');

-- Carla: só o Simba (600)
select pg_temp.act_as('e1000000-0000-0000-0000-000000000003');
select is((public.expense_overview('2026-11-01', '2026-12-01') ->> 'total_cents')::int, 600,
  'a dona do Simba só soma o split do Simba');
select is((public.expense_overview('2026-12-01', '2027-01-01') ->> 'total_cents')::int, 0, 'outro período está vazio');

-- Estranho: nada
select pg_temp.act_as('e1000000-0000-0000-0000-000000000004');
select is((public.expense_overview('2026-01-01', '2027-01-01') ->> 'total_cents')::int, 0, 'estranho não soma nada');

select * from finish();
rollback;
