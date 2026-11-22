-- Saúde e documentos: RLS por animal (dono, cuidador, outro cuidador, estranho).
begin;
select plan(74);

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  ('e1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's-dono@example.test', now(), now()),
  ('e1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's-cuid1@example.test', now(), now()),
  ('e1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's-cuid2@example.test', now(), now()),
  ('e1000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's-estranho@example.test', now(), now());

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

select pg_temp.act_as('e1000000-0000-0000-0000-000000000001');
insert into public.pets (id, name, species) values ('e0000000-0000-0000-0000-000000000001', 'Nina', 'dog');
insert into public.pet_members (pet_id, user_id, role) values ('e0000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000002', 'caregiver'), ('e0000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000003', 'caregiver');

select pg_temp.act_as('e1000000-0000-0000-0000-000000000004');
select cmp_ok((select count(*)::int from public.care_presets where species = 'dog'), '>=', 6, 'qualquer utilizador autenticado lê presets de cão');
select cmp_ok((select count(*)::int from public.care_presets where species = 'cat'), '>=', 5, 'qualquer utilizador autenticado lê presets de gato');
select throws_ok($$insert into public.care_presets (species, type, name, interval_months) values ('dog', 'vaccine', 'X', 1)$$, '42501', null, 'presets não se escrevem pela API');

-- vet_visits
select pg_temp.act_as('e1000000-0000-0000-0000-000000000002');
select lives_ok($$insert into public.vet_visits (id, pet_id, reason) values ('e3000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'x')$$, 'vet_visits: cuidador cria');
select throws_ok($$insert into public.vet_visits (id, pet_id, reason, created_by) values ('e3ffffff-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'x', 'e1000000-0000-0000-0000-000000000001')$$, '42501', null, 'vet_visits: cuidador não cria em nome de outro');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000001');
select lives_ok($$insert into public.vet_visits (id, pet_id, reason) values ('e3000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'x')$$, 'vet_visits: dono cria');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000004');
select throws_ok($$insert into public.vet_visits (id, pet_id, reason) values ('e3ffffff-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'x')$$, '42501', null, 'vet_visits: estranho não cria');
select is((select count(*)::int from public.vet_visits where id in ('e3000000-0000-0000-0000-000000000001', 'e3000000-0000-0000-0000-000000000002')), 0, 'vet_visits: estranho não vê');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.vet_visits where id in ('e3000000-0000-0000-0000-000000000001', 'e3000000-0000-0000-0000-000000000002')), 2, 'vet_visits: outro cuidador vê tudo do animal');
update public.vet_visits set reason = 'mudado' where id = 'e3000000-0000-0000-0000-000000000001';
delete from public.vet_visits where id = 'e3000000-0000-0000-0000-000000000001';
select is((select reason from public.vet_visits where id = 'e3000000-0000-0000-0000-000000000001'), 'x', 'vet_visits: outro cuidador não edita nem apaga o registo alheio');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000002');
update public.vet_visits set reason = 'mudado' where id = 'e3000000-0000-0000-0000-000000000002';
delete from public.vet_visits where id = 'e3000000-0000-0000-0000-000000000002';
select is((select reason from public.vet_visits where id = 'e3000000-0000-0000-0000-000000000002'), 'x', 'vet_visits: cuidador não edita nem apaga o registo do dono');
update public.vet_visits set reason = 'mudado' where id = 'e3000000-0000-0000-0000-000000000001';
select is((select reason from public.vet_visits where id = 'e3000000-0000-0000-0000-000000000001'), 'mudado', 'vet_visits: cuidador edita o que criou');
select throws_ok($$update public.vet_visits set pet_id = 'e0000000-0000-0000-0000-000000000001' where id = 'e3000000-0000-0000-0000-000000000001'$$, '42501', null, 'vet_visits: pet_id não se altera');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000001');
update public.vet_visits set reason = 'mudado' where id = 'e3000000-0000-0000-0000-000000000002';
select is((select reason from public.vet_visits where id = 'e3000000-0000-0000-0000-000000000002'), 'mudado', 'vet_visits: dono edita os seus registos');
delete from public.vet_visits where id = 'e3000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.vet_visits where id = 'e3000000-0000-0000-0000-000000000001'), 0, 'vet_visits: dono apaga registo do cuidador');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000002');
insert into public.vet_visits (id, pet_id, reason) values ('e3000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'x');
delete from public.vet_visits where id = 'e3000000-0000-0000-0000-000000000003';
select is((select count(*)::int from public.vet_visits where id = 'e3000000-0000-0000-0000-000000000003'), 0, 'vet_visits: cuidador apaga o que criou');

-- weights
select pg_temp.act_as('e1000000-0000-0000-0000-000000000002');
select lives_ok($$insert into public.weights (id, pet_id, weight_kg) values ('e3100000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 10)$$, 'weights: cuidador cria');
select throws_ok($$insert into public.weights (id, pet_id, weight_kg, created_by) values ('e3ffffff-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 10, 'e1000000-0000-0000-0000-000000000001')$$, '42501', null, 'weights: cuidador não cria em nome de outro');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000001');
select lives_ok($$insert into public.weights (id, pet_id, weight_kg) values ('e3100000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 10)$$, 'weights: dono cria');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000004');
select throws_ok($$insert into public.weights (id, pet_id, weight_kg) values ('e3ffffff-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 10)$$, '42501', null, 'weights: estranho não cria');
select is((select count(*)::int from public.weights where id in ('e3100000-0000-0000-0000-000000000001', 'e3100000-0000-0000-0000-000000000002')), 0, 'weights: estranho não vê');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.weights where id in ('e3100000-0000-0000-0000-000000000001', 'e3100000-0000-0000-0000-000000000002')), 2, 'weights: outro cuidador vê tudo do animal');
update public.weights set weight_kg = 11 where id = 'e3100000-0000-0000-0000-000000000001';
delete from public.weights where id = 'e3100000-0000-0000-0000-000000000001';
select is((select weight_kg::text from public.weights where id = 'e3100000-0000-0000-0000-000000000001'), '10.00', 'weights: outro cuidador não edita nem apaga o registo alheio');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000002');
update public.weights set weight_kg = 11 where id = 'e3100000-0000-0000-0000-000000000002';
delete from public.weights where id = 'e3100000-0000-0000-0000-000000000002';
select is((select weight_kg::text from public.weights where id = 'e3100000-0000-0000-0000-000000000002'), '10.00', 'weights: cuidador não edita nem apaga o registo do dono');
update public.weights set weight_kg = 11 where id = 'e3100000-0000-0000-0000-000000000001';
select is((select weight_kg::text from public.weights where id = 'e3100000-0000-0000-0000-000000000001'), '11.00', 'weights: cuidador edita o que criou');
select throws_ok($$update public.weights set pet_id = 'e0000000-0000-0000-0000-000000000001' where id = 'e3100000-0000-0000-0000-000000000001'$$, '42501', null, 'weights: pet_id não se altera');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000001');
update public.weights set weight_kg = 11 where id = 'e3100000-0000-0000-0000-000000000002';
select is((select weight_kg::text from public.weights where id = 'e3100000-0000-0000-0000-000000000002'), '11.00', 'weights: dono edita os seus registos');
delete from public.weights where id = 'e3100000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.weights where id = 'e3100000-0000-0000-0000-000000000001'), 0, 'weights: dono apaga registo do cuidador');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000002');
insert into public.weights (id, pet_id, weight_kg) values ('e3100000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 10);
delete from public.weights where id = 'e3100000-0000-0000-0000-000000000003';
select is((select count(*)::int from public.weights where id = 'e3100000-0000-0000-0000-000000000003'), 0, 'weights: cuidador apaga o que criou');

-- health_events
select pg_temp.act_as('e1000000-0000-0000-0000-000000000002');
select lives_ok($$insert into public.health_events (id, pet_id, type, title) values ('e3200000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'vaccine', 'x')$$, 'health_events: cuidador cria');
select throws_ok($$insert into public.health_events (id, pet_id, type, title, created_by) values ('e3ffffff-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'vaccine', 'x', 'e1000000-0000-0000-0000-000000000001')$$, '42501', null, 'health_events: cuidador não cria em nome de outro');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000001');
select lives_ok($$insert into public.health_events (id, pet_id, type, title) values ('e3200000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'vaccine', 'x')$$, 'health_events: dono cria');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000004');
select throws_ok($$insert into public.health_events (id, pet_id, type, title) values ('e3ffffff-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'vaccine', 'x')$$, '42501', null, 'health_events: estranho não cria');
select is((select count(*)::int from public.health_events where id in ('e3200000-0000-0000-0000-000000000001', 'e3200000-0000-0000-0000-000000000002')), 0, 'health_events: estranho não vê');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.health_events where id in ('e3200000-0000-0000-0000-000000000001', 'e3200000-0000-0000-0000-000000000002')), 2, 'health_events: outro cuidador vê tudo do animal');
update public.health_events set title = 'mudado' where id = 'e3200000-0000-0000-0000-000000000001';
delete from public.health_events where id = 'e3200000-0000-0000-0000-000000000001';
select is((select title from public.health_events where id = 'e3200000-0000-0000-0000-000000000001'), 'x', 'health_events: outro cuidador não edita nem apaga o registo alheio');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000002');
update public.health_events set title = 'mudado' where id = 'e3200000-0000-0000-0000-000000000002';
delete from public.health_events where id = 'e3200000-0000-0000-0000-000000000002';
select is((select title from public.health_events where id = 'e3200000-0000-0000-0000-000000000002'), 'x', 'health_events: cuidador não edita nem apaga o registo do dono');
update public.health_events set title = 'mudado' where id = 'e3200000-0000-0000-0000-000000000001';
select is((select title from public.health_events where id = 'e3200000-0000-0000-0000-000000000001'), 'mudado', 'health_events: cuidador edita o que criou');
select throws_ok($$update public.health_events set pet_id = 'e0000000-0000-0000-0000-000000000001' where id = 'e3200000-0000-0000-0000-000000000001'$$, '42501', null, 'health_events: pet_id não se altera');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000001');
update public.health_events set title = 'mudado' where id = 'e3200000-0000-0000-0000-000000000002';
select is((select title from public.health_events where id = 'e3200000-0000-0000-0000-000000000002'), 'mudado', 'health_events: dono edita os seus registos');
delete from public.health_events where id = 'e3200000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.health_events where id = 'e3200000-0000-0000-0000-000000000001'), 0, 'health_events: dono apaga registo do cuidador');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000002');
insert into public.health_events (id, pet_id, type, title) values ('e3200000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'vaccine', 'x');
delete from public.health_events where id = 'e3200000-0000-0000-0000-000000000003';
select is((select count(*)::int from public.health_events where id = 'e3200000-0000-0000-0000-000000000003'), 0, 'health_events: cuidador apaga o que criou');

-- medications
select pg_temp.act_as('e1000000-0000-0000-0000-000000000002');
select lives_ok($$insert into public.medications (id, pet_id, name) values ('e3300000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'x')$$, 'medications: cuidador cria');
select throws_ok($$insert into public.medications (id, pet_id, name, created_by) values ('e3ffffff-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'x', 'e1000000-0000-0000-0000-000000000001')$$, '42501', null, 'medications: cuidador não cria em nome de outro');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000001');
select lives_ok($$insert into public.medications (id, pet_id, name) values ('e3300000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'x')$$, 'medications: dono cria');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000004');
select throws_ok($$insert into public.medications (id, pet_id, name) values ('e3ffffff-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'x')$$, '42501', null, 'medications: estranho não cria');
select is((select count(*)::int from public.medications where id in ('e3300000-0000-0000-0000-000000000001', 'e3300000-0000-0000-0000-000000000002')), 0, 'medications: estranho não vê');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.medications where id in ('e3300000-0000-0000-0000-000000000001', 'e3300000-0000-0000-0000-000000000002')), 2, 'medications: outro cuidador vê tudo do animal');
update public.medications set name = 'mudado' where id = 'e3300000-0000-0000-0000-000000000001';
delete from public.medications where id = 'e3300000-0000-0000-0000-000000000001';
select is((select name from public.medications where id = 'e3300000-0000-0000-0000-000000000001'), 'x', 'medications: outro cuidador não edita nem apaga o registo alheio');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000002');
update public.medications set name = 'mudado' where id = 'e3300000-0000-0000-0000-000000000002';
delete from public.medications where id = 'e3300000-0000-0000-0000-000000000002';
select is((select name from public.medications where id = 'e3300000-0000-0000-0000-000000000002'), 'x', 'medications: cuidador não edita nem apaga o registo do dono');
update public.medications set name = 'mudado' where id = 'e3300000-0000-0000-0000-000000000001';
select is((select name from public.medications where id = 'e3300000-0000-0000-0000-000000000001'), 'mudado', 'medications: cuidador edita o que criou');
select throws_ok($$update public.medications set pet_id = 'e0000000-0000-0000-0000-000000000001' where id = 'e3300000-0000-0000-0000-000000000001'$$, '42501', null, 'medications: pet_id não se altera');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000001');
update public.medications set name = 'mudado' where id = 'e3300000-0000-0000-0000-000000000002';
select is((select name from public.medications where id = 'e3300000-0000-0000-0000-000000000002'), 'mudado', 'medications: dono edita os seus registos');
delete from public.medications where id = 'e3300000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.medications where id = 'e3300000-0000-0000-0000-000000000001'), 0, 'medications: dono apaga registo do cuidador');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000002');
insert into public.medications (id, pet_id, name) values ('e3300000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'x');
delete from public.medications where id = 'e3300000-0000-0000-0000-000000000003';
select is((select count(*)::int from public.medications where id = 'e3300000-0000-0000-0000-000000000003'), 0, 'medications: cuidador apaga o que criou');

-- documents
select pg_temp.act_as('e1000000-0000-0000-0000-000000000002');
select lives_ok($$insert into public.documents (id, pet_id, kind, title, storage_path) values ('e3400000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'invoice', 'x', 'e0000000-0000-0000-0000-000000000001/e3400000-0000-0000-0000-000000000001.pdf')$$, 'documents: cuidador cria');
select throws_ok($$insert into public.documents (id, pet_id, kind, title, storage_path, created_by) values ('e3ffffff-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'invoice', 'x', 'e0000000-0000-0000-0000-000000000001/e3ffffff-0000-0000-0000-000000000001.pdf', 'e1000000-0000-0000-0000-000000000001')$$, '42501', null, 'documents: cuidador não cria em nome de outro');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000001');
select lives_ok($$insert into public.documents (id, pet_id, kind, title, storage_path) values ('e3400000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'invoice', 'x', 'e0000000-0000-0000-0000-000000000001/e3400000-0000-0000-0000-000000000002.pdf')$$, 'documents: dono cria');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000004');
select throws_ok($$insert into public.documents (id, pet_id, kind, title, storage_path) values ('e3ffffff-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'invoice', 'x', 'e0000000-0000-0000-0000-000000000001/e3ffffff-0000-0000-0000-000000000002.pdf')$$, '42501', null, 'documents: estranho não cria');
select is((select count(*)::int from public.documents where id in ('e3400000-0000-0000-0000-000000000001', 'e3400000-0000-0000-0000-000000000002')), 0, 'documents: estranho não vê');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.documents where id in ('e3400000-0000-0000-0000-000000000001', 'e3400000-0000-0000-0000-000000000002')), 2, 'documents: outro cuidador vê tudo do animal');
update public.documents set title = 'mudado' where id = 'e3400000-0000-0000-0000-000000000001';
delete from public.documents where id = 'e3400000-0000-0000-0000-000000000001';
select is((select title from public.documents where id = 'e3400000-0000-0000-0000-000000000001'), 'x', 'documents: outro cuidador não edita nem apaga o registo alheio');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000002');
update public.documents set title = 'mudado' where id = 'e3400000-0000-0000-0000-000000000002';
delete from public.documents where id = 'e3400000-0000-0000-0000-000000000002';
select is((select title from public.documents where id = 'e3400000-0000-0000-0000-000000000002'), 'x', 'documents: cuidador não edita nem apaga o registo do dono');
update public.documents set title = 'mudado' where id = 'e3400000-0000-0000-0000-000000000001';
select is((select title from public.documents where id = 'e3400000-0000-0000-0000-000000000001'), 'mudado', 'documents: cuidador edita o que criou');
select throws_ok($$update public.documents set pet_id = 'e0000000-0000-0000-0000-000000000001' where id = 'e3400000-0000-0000-0000-000000000001'$$, '42501', null, 'documents: pet_id não se altera');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000001');
update public.documents set title = 'mudado' where id = 'e3400000-0000-0000-0000-000000000002';
select is((select title from public.documents where id = 'e3400000-0000-0000-0000-000000000002'), 'mudado', 'documents: dono edita os seus registos');
delete from public.documents where id = 'e3400000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.documents where id = 'e3400000-0000-0000-0000-000000000001'), 0, 'documents: dono apaga registo do cuidador');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000002');
insert into public.documents (id, pet_id, kind, title, storage_path) values ('e3400000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'invoice', 'x', 'e0000000-0000-0000-0000-000000000001/e3400000-0000-0000-0000-000000000003.pdf');
delete from public.documents where id = 'e3400000-0000-0000-0000-000000000003';
select is((select count(*)::int from public.documents where id = 'e3400000-0000-0000-0000-000000000003'), 0, 'documents: cuidador apaga o que criou');

select pg_temp.act_as('e1000000-0000-0000-0000-000000000001');
insert into public.pets (id, name, species) values ('e0000000-0000-0000-0000-000000000002', 'Simba', 'cat');
insert into public.vet_visits (id, pet_id) values ('e2000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002');
select throws_ok($$insert into public.weights (pet_id, weight_kg, vet_visit_id) values ('e0000000-0000-0000-0000-000000000001', 5, 'e2000000-0000-0000-0000-000000000001')$$, '23503', null, 'registo não se liga a consulta de outro animal');
select throws_ok($$insert into public.weights (pet_id, weight_kg) values ('e0000000-0000-0000-0000-000000000001', 0)$$, '23514', null, 'peso tem de ser > 0');
select throws_ok($$insert into public.health_events (pet_id, type, title, occurred_on, next_due_on) values ('e0000000-0000-0000-0000-000000000001', 'vaccine', 'x', '2026-05-01', '2026-04-01')$$, '23514', null, 'próxima data não pode ser anterior');
select throws_ok($$insert into public.health_events (pet_id, type, title) values ('e0000000-0000-0000-0000-000000000001', 'dança', 'x')$$, '23514', null, 'tipo de evento inválido é rejeitado');
select throws_ok($$insert into public.documents (pet_id, kind, title, storage_path) values ('e0000000-0000-0000-0000-000000000001', 'invoice', 'x', 'outro/a.pdf')$$, '23514', null, 'documento tem de estar na pasta do animal');
insert into public.vet_visits (id, pet_id) values ('e2000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000001');
insert into public.weights (id, pet_id, weight_kg, vet_visit_id) values ('e2000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-000000000001', 9, 'e2000000-0000-0000-0000-000000000009');
delete from public.vet_visits where id = 'e2000000-0000-0000-0000-000000000009';
select is((select vet_visit_id from public.weights where id = 'e2000000-0000-0000-0000-00000000000a'), null, 'apagar a consulta mantém o peso, sem ligação');
select * from finish();
rollback;
