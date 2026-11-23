-- RPC record_vet_visit / record_weight / record_home_treatment: tudo ou nada, sempre com RLS.
begin;
select plan(21);

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  ('a1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'r-dono@example.test', now(), now()),
  ('a1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'r-cuidador@example.test', now(), now()),
  ('a1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'r-estranho@example.test', now(), now());

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

select pg_temp.act_as('a1000000-0000-0000-0000-000000000001');
insert into public.pets (id, name, species) values ('a0000000-0000-0000-0000-000000000001', 'Nina', 'dog');
insert into public.pet_members (pet_id, user_id, role)
values ('a0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 'caregiver');

-- Cuidador carrega a fatura e grava uma consulta completa
select pg_temp.act_as('a1000000-0000-0000-0000-000000000002');
insert into public.documents (id, pet_id, kind, title, storage_path)
values ('a3000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'invoice', 'Fatura',
        'a0000000-0000-0000-0000-000000000001/fatura.pdf');
create temp table result (visit_id uuid);
grant all on result to authenticated;
insert into result
select public.record_vet_visit($${
  "pet_id": "a0000000-0000-0000-0000-000000000001",
  "visited_on": "2026-11-20",
  "reason": "Vacinação",
  "clinic_name": "Clínica Patinhas",
  "weight_kg": 12.4,
  "health_events": [
    {"type": "vaccine", "title": "Antirrábica", "next_due_on": "2027-11-20"},
    {"type": "deworming_internal", "title": "Desparasitação interna", "product": "Drontal", "next_due_on": "2027-02-20"}
  ],
  "medications": [
    {"name": "Apoquel", "dose": "½ comprimido", "schedule_rrule": "FREQ=DAILY", "ends_on": "2026-11-30"}
  ],
  "expense": {"amount_cents": 4500, "category": "veterinary", "description": "Consulta"},
  "document_id": "a3000000-0000-0000-0000-000000000001"
}$$::jsonb);

select isnt((select visit_id from result), null, 'devolve o id da consulta');
select is((select count(*)::int from public.vet_visits where id = (select visit_id from result) and reason = 'Vacinação' and created_by = 'a1000000-0000-0000-0000-000000000002'), 1, 'grava a consulta (created_by é o cuidador)');
select is((select c.name from public.vet_visits v join public.clinics c on c.id = v.clinic_id where v.id = (select visit_id from result)), 'Clínica Patinhas', 'cria a clínica nova na mesma transação');
select is((select c.name from public.pets p join public.clinics c on c.id = p.clinic_id where p.id = 'a0000000-0000-0000-0000-000000000001'), 'Clínica Patinhas', 'a primeira clínica usada passa a habitual (mesmo por um cuidador)');
select is((select weight_kg from public.weights where vet_visit_id = (select visit_id from result)), 12.4, 'grava o peso ligado à consulta');
select is((select count(*)::int from public.health_events where vet_visit_id = (select visit_id from result) and occurred_on = '2026-11-20'), 2, 'grava vacina e desparasitação na data da consulta');
select is((select next_due_on from public.health_events where title = 'Antirrábica'), '2027-11-20'::date, 'guarda next_due_on');
select is((select count(*)::int from public.medications where vet_visit_id = (select visit_id from result) and starts_on = '2026-11-20'), 1, 'grava a medicação');
select is((select amount_cents from public.expenses where vet_visit_id = (select visit_id from result)), 4500, 'grava a despesa');
select is((select sum(s.amount_cents)::int from public.expense_splits s join public.expenses e on e.id = s.expense_id where e.vet_visit_id = (select visit_id from result)), 4500, 'split único para o animal com o total');
select is((select vet_visit_id from public.documents where id = 'a3000000-0000-0000-0000-000000000001'), (select visit_id from result), 'liga o documento à consulta');
select is((select document_id from public.expenses where vet_visit_id = (select visit_id from result)), 'a3000000-0000-0000-0000-000000000001'::uuid, 'liga o documento à despesa');

-- Reverte tudo se uma parte falhar (despesa com categoria inválida, no fim do payload)
select throws_ok($$select public.record_vet_visit('{
  "pet_id": "a0000000-0000-0000-0000-000000000001",
  "reason": "Falha",
  "weight_kg": 9,
  "health_events": [{"type": "vaccine", "title": "Falha"}],
  "expense": {"amount_cents": 100, "category": "viagens"}
}'::jsonb)$$, '23514', null, 'categoria inválida falha');
select is((select count(*)::int from public.vet_visits where reason = 'Falha')
        + (select count(*)::int from public.weights where weight_kg = 9)
        + (select count(*)::int from public.health_events where title = 'Falha'), 0, 'nada ficou gravado depois da falha');

-- Reverte também se falhar a meio (medicação sem nome, depois da consulta e da vacina)
select throws_ok($$select public.record_vet_visit('{
  "pet_id": "a0000000-0000-0000-0000-000000000001",
  "reason": "Falha2",
  "health_events": [{"type": "vaccine", "title": "Falha2"}],
  "medications": [{"name": ""}]
}'::jsonb)$$, '23514', null, 'medicação sem nome falha');
select is((select count(*)::int from public.vet_visits where reason = 'Falha2') + (select count(*)::int from public.health_events where title = 'Falha2'), 0, 'nada ficou gravado (2)');

-- Documento inexistente é recusado
select throws_ok($$select public.record_vet_visit('{"pet_id": "a0000000-0000-0000-0000-000000000001", "document_id": "a3000000-0000-0000-0000-0000000000ff"}'::jsonb)$$, '42501', null, 'documento inexistente é recusado');

-- Estranho não grava
select pg_temp.act_as('a1000000-0000-0000-0000-000000000003');
select throws_ok($$select public.record_vet_visit('{"pet_id": "a0000000-0000-0000-0000-000000000001", "reason": "X"}'::jsonb)$$, '42501', null, 'estranho não regista consulta');
select throws_ok($$select public.record_weight('{"pet_id": "a0000000-0000-0000-0000-000000000001", "weight_kg": 5}'::jsonb)$$, '42501', null, 'estranho não regista peso');

-- Registos rápidos (cuidador)
select pg_temp.act_as('a1000000-0000-0000-0000-000000000002');
select lives_ok($$select public.record_weight('{"pet_id": "a0000000-0000-0000-0000-000000000001", "weight_kg": 12.6}'::jsonb)$$, 'regista peso rápido');
create temp table res2 (id uuid);
grant all on res2 to authenticated;
insert into res2 select public.record_home_treatment($${
  "pet_id": "a0000000-0000-0000-0000-000000000001", "type": "deworming_external", "title": "Desparasitação externa",
  "product": "Frontline", "next_due_on": "2099-01-01", "expense": {"amount_cents": 1250}
}$$::jsonb);
select is((select count(*)::int from public.health_events h join public.expenses e on e.description = h.title
           where h.id = (select id from res2) and h.vet_visit_id is null and e.amount_cents = 1250 and e.category = 'medication'), 1, 'tratamento em casa grava evento e despesa');

select * from finish();
rollback;
