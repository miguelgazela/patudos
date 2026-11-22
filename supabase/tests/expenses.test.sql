-- Despesas e splits: visibilidade entre animais com membros diferentes, soma dos splits, edição.
-- Nina (cadela): dono Ana, cuidador Bruno. Simba (gato): dono Carla. Bruno e Carla não se conhecem.
begin;
select plan(23);

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  ('f1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'x-ana@example.test', now(), now()),
  ('f1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'x-bruno@example.test', now(), now()),
  ('f1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'x-carla@example.test', now(), now()),
  ('f1000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'x-estranho@example.test', now(), now());

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

select pg_temp.act_as('f1000000-0000-0000-0000-000000000001');
insert into public.pets (id, name, species) values ('f0000000-0000-0000-0000-000000000001', 'Nina', 'dog');
insert into public.pet_members (pet_id, user_id, role)
values ('f0000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000002', 'caregiver');

select pg_temp.act_as('f1000000-0000-0000-0000-000000000003');
insert into public.pets (id, name, species) values ('f0000000-0000-0000-0000-000000000002', 'Simba', 'cat');

-- Ana: despesa só da Nina (60 €)
select pg_temp.act_as('f1000000-0000-0000-0000-000000000001');
insert into public.expenses (id, category, amount_cents) values ('f2000000-0000-0000-0000-000000000001', 'food', 6000);
insert into public.expense_splits (expense_id, pet_id, amount_cents)
values ('f2000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 6000);

-- Carla: despesa só do Simba (20 €)
select pg_temp.act_as('f1000000-0000-0000-0000-000000000003');
insert into public.expenses (id, category, amount_cents) values ('f2000000-0000-0000-0000-000000000002', 'food', 2000);
insert into public.expense_splits (expense_id, pet_id, amount_cents)
values ('f2000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002', 2000);

-- Bruno (cuidador da Nina) não pode dividir por um animal a que não tem acesso
select pg_temp.act_as('f1000000-0000-0000-0000-000000000002');
select lives_ok($$insert into public.expenses (id, category, amount_cents) values ('f2000000-0000-0000-0000-000000000003', 'hygiene', 3000)$$,
  'cuidador cria despesa');
select throws_ok($$insert into public.expense_splits (expense_id, pet_id, amount_cents) values ('f2000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000002', 3000)$$,
  '42501', null, 'não se divide por animal sem acesso');
select lives_ok($$insert into public.expense_splits (expense_id, pet_id, amount_cents) values ('f2000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000001', 3000)$$,
  'cuidador divide por animal a que tem acesso');
select throws_ok($$insert into public.expenses (category, amount_cents, created_by) values ('food', 100, 'f1000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'não se cria despesa em nome de outro');
select throws_ok($$insert into public.expenses (category, amount_cents) values ('food', -1)$$,
  '23514', null, 'valor negativo é rejeitado');
select throws_ok($$insert into public.expenses (category, amount_cents) values ('viagens', 100)$$,
  '23514', null, 'categoria inválida é rejeitada');

-- Bruno não pode apadrinhar splits na despesa da Ana (nem a vê no animal que não é dele)
select throws_ok($$insert into public.expense_splits (expense_id, pet_id, amount_cents) values ('f2000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', 1)$$,
  '42501', null, 'não se acrescenta split à despesa de outro');

-- Visibilidade
select is((select count(*)::int from public.expenses where id in ('f2000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000003')), 2,
  'cuidador vê as despesas da Nina (da dona e a sua)');
select is((select count(*)::int from public.expenses where id = 'f2000000-0000-0000-0000-000000000002'), 0,
  'cuidador não vê despesa do gato alheio');

-- Despesa partilhada Nina + Simba, criada pela Ana? A Ana não tem acesso ao Simba. A Carla ganha acesso à Nina.
select pg_temp.act_as('f1000000-0000-0000-0000-000000000001');
select throws_ok($$insert into public.expense_splits (expense_id, pet_id, amount_cents) values ('f2000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002', 1)$$,
  '42501', null, 'dona não divide por animal alheio');

select pg_temp.act_as('f1000000-0000-0000-0000-000000000003');
insert into public.pet_members (pet_id, user_id, role) values ('f0000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000002', 'caregiver');

-- Agora o Bruno é cuidador dos dois animais: despesa partilhada de 10 € (4 € + 6 €)
select pg_temp.act_as('f1000000-0000-0000-0000-000000000002');
insert into public.expenses (id, category, amount_cents) values ('f2000000-0000-0000-0000-000000000004', 'food', 1000);
insert into public.expense_splits (expense_id, pet_id, amount_cents) values
  ('f2000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000001', 400),
  ('f2000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000002', 600);

select pg_temp.act_as('f1000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.expenses where id = 'f2000000-0000-0000-0000-000000000004'), 1,
  'dona da Nina vê a despesa partilhada (é membro de um dos animais)');
select is((select count(*)::int from public.expense_splits where expense_id = 'f2000000-0000-0000-0000-000000000004'), 1,
  'dona só vê o split do seu animal');
select pg_temp.act_as('f1000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.expenses where id = 'f2000000-0000-0000-0000-000000000004'), 1,
  'dona do Simba vê a despesa partilhada');
select is((select count(*)::int from public.expense_splits where expense_id = 'f2000000-0000-0000-0000-000000000004'), 1,
  'dona do Simba só vê o split do gato');
select is((select count(*)::int from public.expenses where id = 'f2000000-0000-0000-0000-000000000001'), 0,
  'dona do Simba não vê despesas só da Nina');

select pg_temp.act_as('f1000000-0000-0000-0000-000000000004');
select is((select count(*)::int from public.expenses), 0, 'estranho não vê despesas');
select throws_ok($$insert into public.expense_splits (expense_id, pet_id, amount_cents) values ('f2000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000001', 1)$$,
  '42501', null, 'estranho não acrescenta splits');

-- Edição: a dona da Nina não apaga a despesa partilhada (não é dona de todos os animais, nem criadora)
select pg_temp.act_as('f1000000-0000-0000-0000-000000000001');
delete from public.expenses where id = 'f2000000-0000-0000-0000-000000000004';
select is((select count(*)::int from public.expenses where id = 'f2000000-0000-0000-0000-000000000004'), 1,
  'dona de um só dos animais não apaga despesa partilhada de outro');
-- Dona da Nina edita a despesa do cuidador só da Nina
update public.expenses set description = 'mudada' where id = 'f2000000-0000-0000-0000-000000000003';
select is((select description from public.expenses where id = 'f2000000-0000-0000-0000-000000000003'), 'mudada',
  'dono edita despesa de cuidador (só do seu animal)');

-- Cuidador edita a sua e não a da dona
select pg_temp.act_as('f1000000-0000-0000-0000-000000000002');
update public.expenses set description = 'bruno' where id = 'f2000000-0000-0000-0000-000000000001';
select is((select description from public.expenses where id = 'f2000000-0000-0000-0000-000000000001'), null,
  'cuidador não edita despesa da dona');
update public.expenses set description = 'bruno' where id = 'f2000000-0000-0000-0000-000000000004';
select is((select description from public.expenses where id = 'f2000000-0000-0000-0000-000000000004'), 'bruno',
  'cuidador edita a despesa que criou');

-- Soma dos splits = total, e pelo menos um split (verificado no fim da transação; força-se aqui)
select pg_temp.act_as('f1000000-0000-0000-0000-000000000002');
insert into public.expenses (id, category, amount_cents) values ('f2000000-0000-0000-0000-000000000005', 'food', 100);
select throws_ok($$set constraints all immediate$$, '23514', null, 'despesa sem animais é rejeitada');
delete from public.expenses where id = 'f2000000-0000-0000-0000-000000000005';
update public.expense_splits set amount_cents = 500
  where expense_id = 'f2000000-0000-0000-0000-000000000004' and pet_id = 'f0000000-0000-0000-0000-000000000001';
select throws_ok($$set constraints all immediate$$, '23514', null, 'soma dos splits diferente do total é rejeitada');

select * from finish();
rollback;
