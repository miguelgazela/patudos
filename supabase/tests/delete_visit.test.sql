-- Apagar uma consulta: um só DELETE (transacional). Os registos ligados ficam e só perdem a ligação.
begin;
select plan(10);

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  ('a5000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dv-dono@example.test', now(), now()),
  ('a5000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dv-cuid1@example.test', now(), now()),
  ('a5000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dv-cuid2@example.test', now(), now()),
  ('a5000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dv-estranho@example.test', now(), now());

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

select pg_temp.act_as('a5000000-0000-0000-0000-000000000001');
insert into public.pets (id, name, species) values ('a4000000-0000-0000-0000-000000000001', 'Nina', 'dog');
insert into public.pet_members (pet_id, user_id, role) values
  ('a4000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000002', 'caregiver'),
  ('a4000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000003', 'caregiver');

-- Cuidador 1 regista uma consulta completa; cuidador 2 outra
select pg_temp.act_as('a5000000-0000-0000-0000-000000000002');
create temp table visits (who text, id uuid);
grant all on visits to authenticated;
insert into visits select 'c1', public.record_vet_visit($${
  "pet_id": "a4000000-0000-0000-0000-000000000001", "reason": "Vacinação", "weight_kg": 12.4,
  "health_events": [{"type": "vaccine", "title": "Antirrábica", "next_due_on": "2099-01-01"}],
  "medications": [{"name": "Apoquel", "schedule_rrule": "FREQ=DAILY"}],
  "expense": {"amount_cents": 4500, "category": "veterinary"}
}$$::jsonb);

select pg_temp.act_as('a5000000-0000-0000-0000-000000000003');
insert into visits select 'c2', public.record_vet_visit($${
  "pet_id": "a4000000-0000-0000-0000-000000000001", "reason": "Check-up"
}$$::jsonb);

-- Outro cuidador não apaga a consulta de quem a criou
delete from public.vet_visits where id = (select id from visits where who = 'c1');
select is((select count(*)::int from public.vet_visits where id = (select id from visits where who = 'c1')), 1,
  'cuidador não apaga a consulta de outro');

-- Utilizador sem acesso nem a vê
select pg_temp.act_as('a5000000-0000-0000-0000-000000000004');
delete from public.vet_visits where id = (select id from visits where who = 'c1');
select is((select count(*)::int from public.vet_visits where pet_id = 'a4000000-0000-0000-0000-000000000001'), 0, 'estranho não vê consultas');
reset role;
select is((select count(*)::int from public.vet_visits where id = (select id from visits where who = 'c1')), 1,
  'estranho não apagou nada');

-- Quem criou apaga a sua
select pg_temp.act_as('a5000000-0000-0000-0000-000000000002');
delete from public.vet_visits where id = (select id from visits where who = 'c1');
reset role;
select is((select count(*)::int from public.vet_visits where id = (select id from visits where who = 'c1')), 0,
  'o criador apaga a consulta');
select is((select count(*)::int from public.weights where pet_id = 'a4000000-0000-0000-0000-000000000001' and vet_visit_id is null and weight_kg = 12.4), 1,
  'o peso fica, sem ligação');
select is((select count(*)::int from public.health_events where pet_id = 'a4000000-0000-0000-0000-000000000001' and title = 'Antirrábica' and vet_visit_id is null and next_due_on = '2099-01-01'), 1,
  'a vacina fica, sem ligação, com a próxima data');
select is((select count(*)::int from public.medications where pet_id = 'a4000000-0000-0000-0000-000000000001' and name = 'Apoquel' and vet_visit_id is null), 1,
  'a medicação fica, sem ligação');
select is((select count(*)::int from public.expenses e join public.expense_splits sp on sp.expense_id = e.id where sp.pet_id = 'a4000000-0000-0000-0000-000000000001' and e.amount_cents = 4500 and e.vet_visit_id is null), 1,
  'a despesa fica, sem ligação');
select is((select count(*)::int from public.expense_splits where pet_id = 'a4000000-0000-0000-0000-000000000001' and amount_cents = 4500), 1, 'a divisão da despesa fica');

-- O dono apaga a consulta de qualquer cuidador
select pg_temp.act_as('a5000000-0000-0000-0000-000000000001');
delete from public.vet_visits where id = (select id from visits where who = 'c2');
select is((select count(*)::int from public.vet_visits where pet_id = 'a4000000-0000-0000-0000-000000000001'), 0, 'o dono apaga a consulta de um cuidador');

select * from finish();
rollback;
