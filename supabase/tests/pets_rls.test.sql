begin;
select plan(29);

-- Utilizadores de teste (o trigger cria os perfis)
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 't-dono@example.test', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 't-cuidador@example.test', now(), now()),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 't-estranho@example.test', now(), now());

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

create function pg_temp.act_as_postgres() returns void language plpgsql as $$
begin
  reset role;
end $$;

select is((select count(*)::int from public.profiles where id::text like 'a0000000%'), 3, 'trigger cria perfis');

-- Dono cria animal e fica owner
select pg_temp.act_as('a0000000-0000-0000-0000-000000000001');
insert into public.pets (id, name, species) values ('b0000000-0000-0000-0000-000000000001', 'Teste', 'dog');
select is((select role from public.pet_members where pet_id = 'b0000000-0000-0000-0000-000000000001'), 'owner', 'criador fica dono');
select is((select created_by from public.pets where id = 'b0000000-0000-0000-0000-000000000001'), 'a0000000-0000-0000-0000-000000000001'::uuid, 'created_by preenchido');

-- Dono adiciona cuidador
insert into public.pet_members (pet_id, user_id, role) values ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'caregiver');
select is((select count(*)::int from public.pet_members where pet_id = 'b0000000-0000-0000-0000-000000000001'), 2, 'dono gere membros');
select is((select count(*)::int from public.profiles where id = 'a0000000-0000-0000-0000-000000000002'), 1, 'dono vê perfil do cuidador');
select is((select count(*)::int from public.profiles where id = 'a0000000-0000-0000-0000-000000000003'), 0, 'dono não vê perfil de estranho');

-- Dono edita e arquiva
update public.pets set breed = 'Serra da Estrela' where id = 'b0000000-0000-0000-0000-000000000001';
select is((select breed from public.pets where id = 'b0000000-0000-0000-0000-000000000001'), 'Serra da Estrela', 'dono edita ficha');
update public.pets set archived_at = now() where id = 'b0000000-0000-0000-0000-000000000001';
select isnt((select archived_at from public.pets where id = 'b0000000-0000-0000-0000-000000000001'), null, 'dono arquiva');
update public.pets set archived_at = null where id = 'b0000000-0000-0000-0000-000000000001';

-- Último dono
select throws_ok($$delete from public.pet_members where pet_id = 'b0000000-0000-0000-0000-000000000001' and user_id = 'a0000000-0000-0000-0000-000000000001'$$,
  'P0001', 'O animal tem de ter pelo menos um dono.', 'não se remove o último dono');
select throws_ok($$update public.pet_members set role = 'caregiver' where pet_id = 'b0000000-0000-0000-0000-000000000001' and user_id = 'a0000000-0000-0000-0000-000000000001'$$,
  'P0001', 'O animal tem de ter pelo menos um dono.', 'não se despromove o último dono');

-- Cuidador
select pg_temp.act_as('a0000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.pets where id = 'b0000000-0000-0000-0000-000000000001'), 1, 'cuidador vê o animal');
select is((select count(*)::int from public.pet_members where pet_id = 'b0000000-0000-0000-0000-000000000001'), 2, 'cuidador vê os membros');
select is((select count(*)::int from public.profiles where id = 'a0000000-0000-0000-0000-000000000001'), 1, 'cuidador vê perfil do dono');

update public.pets set name = 'Hack' where id = 'b0000000-0000-0000-0000-000000000001';
select is((select name from public.pets where id = 'b0000000-0000-0000-0000-000000000001'), 'Teste', 'cuidador não edita ficha');
update public.pets set archived_at = now() where id = 'b0000000-0000-0000-0000-000000000001';
select is((select archived_at from public.pets where id = 'b0000000-0000-0000-0000-000000000001'), null, 'cuidador não arquiva');

select throws_ok($$insert into public.pet_members (pet_id, user_id, role) values ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'caregiver')$$,
  '42501', null, 'cuidador não adiciona membros');
select throws_ok($$update public.pet_members set role = 'owner' where pet_id = 'b0000000-0000-0000-0000-000000000001' and user_id = 'a0000000-0000-0000-0000-000000000002'$$,
  '42501', 'Só o dono pode alterar papéis.', 'cuidador não se promove');
update public.pet_members set notify = false where pet_id = 'b0000000-0000-0000-0000-000000000001' and user_id = 'a0000000-0000-0000-0000-000000000002';
select is((select notify from public.pet_members where pet_id = 'b0000000-0000-0000-0000-000000000001' and user_id = 'a0000000-0000-0000-0000-000000000002'), false, 'cuidador altera o seu notify');
delete from public.pet_members where pet_id = 'b0000000-0000-0000-0000-000000000001' and user_id = 'a0000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.pet_members where pet_id = 'b0000000-0000-0000-0000-000000000001' and role = 'owner'), 1, 'cuidador não remove o dono');

-- Perfil: edita o seu, não o dos outros
update public.profiles set name = 'Cuidador' where id = 'a0000000-0000-0000-0000-000000000002';
update public.profiles set name = 'Hack' where id = 'a0000000-0000-0000-0000-000000000001';
select is((select name from public.profiles where id = 'a0000000-0000-0000-0000-000000000002'), 'Cuidador', 'edita o próprio perfil');
select is((select name from public.profiles where id = 'a0000000-0000-0000-0000-000000000001'), '', 'não edita perfil alheio');

-- Deixar de cuidar
delete from public.pet_members where pet_id = 'b0000000-0000-0000-0000-000000000001' and user_id = 'a0000000-0000-0000-0000-000000000002';
select is((select count(*)::int from public.pets where id = 'b0000000-0000-0000-0000-000000000001'), 0, 'cuidador deixa de cuidar e perde acesso');

-- Estranho
select pg_temp.act_as('a0000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.pets where id = 'b0000000-0000-0000-0000-000000000001'), 0, 'estranho não vê o animal');
select is((select count(*)::int from public.pet_members where pet_id = 'b0000000-0000-0000-0000-000000000001'), 0, 'estranho não vê membros');
select is((select count(*)::int from public.profiles where id <> 'a0000000-0000-0000-0000-000000000003' and id::text like 'a0000000%'), 0, 'estranho só vê o próprio perfil');
update public.pets set name = 'Hack' where id = 'b0000000-0000-0000-0000-000000000001';
select throws_ok($$insert into public.pet_members (pet_id, user_id, role) values ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'owner')$$,
  '42501', null, 'estranho não se auto-adiciona');
select throws_ok($$insert into public.pets (name, species, created_by) values ('Falso', 'cat', 'a0000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'não se cria animal em nome de outrem');

-- Qualquer autenticado cria animais
insert into public.pets (id, name, species, color) values ('b0000000-0000-0000-0000-000000000002', 'Gato', 'cat', 'azul');
select is((select role from public.pet_members where pet_id = 'b0000000-0000-0000-0000-000000000002'), 'owner', 'qualquer autenticado cria animal');

-- Anónimo não vê nada
select pg_temp.act_as_postgres();
set local role anon;
select throws_ok($$select * from public.pets$$, '42501', null, 'anónimo sem acesso');

select * from finish();
rollback;
