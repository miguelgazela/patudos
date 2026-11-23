-- Clínicas: visibilidade por animal (via pet_members), edição, guardas e limpeza ao apagar conta.
begin;
select plan(25);

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  ('c1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cl-dono@example.test', now(), now()),
  ('c1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cl-cuidador@example.test', now(), now()),
  ('c1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cl-estranho@example.test', now(), now());

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

-- Dono tem a Nina (com cuidador) e o Rex (só dele); o estranho tem a Mia.
select pg_temp.act_as('c1000000-0000-0000-0000-000000000001');
insert into public.pets (id, name, species) values
  ('c0000000-0000-0000-0000-000000000001', 'Nina', 'dog'),
  ('c0000000-0000-0000-0000-000000000002', 'Rex', 'dog');
insert into public.pet_members (pet_id, user_id, role)
values ('c0000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'caregiver');
select pg_temp.act_as('c1000000-0000-0000-0000-000000000003');
insert into public.pets (id, name, species) values ('c0000000-0000-0000-0000-000000000003', 'Mia', 'cat');

-- Dono cria uma clínica e regista uma consulta da Nina nela.
select pg_temp.act_as('c1000000-0000-0000-0000-000000000001');
insert into public.clinics (id, name, phone, address)
values ('c2000000-0000-0000-0000-000000000001', 'VetLumiar', '217 000 000', 'Rua A, Lisboa');
select lives_ok($$select public.record_vet_visit('{"pet_id": "c0000000-0000-0000-0000-000000000001", "reason": "Vacinação", "clinic_id": "c2000000-0000-0000-0000-000000000001"}'::jsonb)$$, 'consulta com clínica conhecida');
select is((select clinic_id from public.pets where id = 'c0000000-0000-0000-0000-000000000001'), 'c2000000-0000-0000-0000-000000000001'::uuid, 'primeira clínica usada passa a habitual');
select is((select clinic_id from public.pets where id = 'c0000000-0000-0000-0000-000000000002'), null, 'não mexe nos outros animais');

-- find_or_create_clinic reutiliza pelo nome (sem distinguir maiúsculas/espaços)
select is(public.find_or_create_clinic('  vetlumiar '), 'c2000000-0000-0000-0000-000000000001'::uuid, 'reutiliza a clínica existente (sem duplicar)');
select is((select count(*)::int from public.clinics), 1, 'continua a haver uma só clínica');
select is(public.find_or_create_clinic('   '), null, 'nome vazio não cria nada');

-- Dono: o Rex também vê a clínica da Nina como opção (partilha entre os meus animais)
select is((select count(*)::int from public.clinics where id = 'c2000000-0000-0000-0000-000000000001'), 1, 'dono vê a clínica');
select lives_ok($$update public.pets set clinic_id = 'c2000000-0000-0000-0000-000000000001' where id = 'c0000000-0000-0000-0000-000000000002'$$, 'dono define a habitual de outro animal seu com uma clínica que vê');
select lives_ok($$update public.clinics set phone = '218 111 111' where id = 'c2000000-0000-0000-0000-000000000001'$$, 'criador edita o telefone');
select is((select phone from public.clinics where id = 'c2000000-0000-0000-0000-000000000001'), '218 111 111', 'telefone atualizado');

-- Cuidador (da Nina): vê a clínica, não edita, não muda a habitual
select pg_temp.act_as('c1000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.clinics), 1, 'cuidador vê a clínica do animal');
update public.clinics set phone = 'x' where id = 'c2000000-0000-0000-0000-000000000001';
select is((select phone from public.clinics where id = 'c2000000-0000-0000-0000-000000000001'), '218 111 111', 'cuidador não edita a clínica de outro');
update public.pets set clinic_id = null where id = 'c0000000-0000-0000-0000-000000000001';
select isnt((select clinic_id from public.pets where id = 'c0000000-0000-0000-0000-000000000001'), null, 'cuidador não muda a clínica habitual (só o dono)');
select lives_ok($$select public.record_vet_visit('{"pet_id": "c0000000-0000-0000-0000-000000000001", "reason": "Revisão", "clinic_name": "Clínica Nova"}'::jsonb)$$, 'cuidador regista consulta numa clínica nova');
select is((select created_by from public.clinics where name = 'Clínica Nova'), 'c1000000-0000-0000-0000-000000000002'::uuid, 'a clínica nova é do cuidador');
select is((select clinic_id from public.pets where id = 'c0000000-0000-0000-0000-000000000001'), 'c2000000-0000-0000-0000-000000000001'::uuid, 'a habitual não muda por usar outra clínica');

-- Estranho: não vê nem aponta para clínicas de quem não partilha animais com ele
select pg_temp.act_as('c1000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.clinics), 0, 'estranho não vê clínicas alheias');
select throws_ok($$update public.pets set clinic_id = 'c2000000-0000-0000-0000-000000000001' where id = 'c0000000-0000-0000-0000-000000000003'$$, '42501', null, 'estranho não aponta o seu animal para uma clínica que não vê');
select throws_ok($$select public.record_vet_visit('{"pet_id": "c0000000-0000-0000-0000-000000000003", "clinic_id": "c2000000-0000-0000-0000-000000000001"}'::jsonb)$$, '42501', null, 'estranho não regista consulta com clínica que não vê');
select throws_ok($$insert into public.clinics (name, created_by) values ('Falsa', 'c1000000-0000-0000-0000-000000000001')$$, '42501', null, 'não se cria clínica em nome de outro');

-- Uma clínica que passa a ser vista por ligação ao animal: a Mia vai à VetLumiar
select lives_ok($$select public.record_vet_visit('{"pet_id": "c0000000-0000-0000-0000-000000000003", "clinic_name": "Mia Vet"}'::jsonb)$$, 'estranho cria a sua clínica');
select is((select count(*)::int from public.clinics), 1, 'vê só a sua');

-- Apagar conta do estranho remove a clínica dele (já sem outros animais)
select lives_ok($$select public.delete_account(array['c0000000-0000-0000-0000-000000000003']::uuid[])$$, 'apagar conta do estranho');
select pg_temp.act_as('c1000000-0000-0000-0000-000000000001');
reset role;
select is((select count(*)::int from public.clinics where name = 'Mia Vet'), 0, 'clínica sem ligações é removida ao apagar a conta');
select is((select count(*)::int from public.clinics where id = 'c2000000-0000-0000-0000-000000000001'), 1, 'clínicas em uso ficam');

select * from finish();
rollback;
