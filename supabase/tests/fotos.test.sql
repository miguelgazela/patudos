begin;
select plan(19);

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f-dono@example.test', now(), now()),
  ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f-cuidador@example.test', now(), now()),
  ('c0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f-estranho@example.test', now(), now());

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

-- O Storage bloqueia DELETE direto salvo com este parâmetro (o RLS aplica-se na mesma).
set local storage.allow_delete_query = 'true';

-- Bucket privado
select is((select public from storage.buckets where id = 'fotos'), false, 'bucket fotos é privado');

-- Colunas do animal
select pg_temp.act_as('c0000000-0000-0000-0000-000000000001');
insert into public.pets (id, name, species, color, birth_date, birth_date_is_estimate)
values ('d0000000-0000-0000-0000-000000000001', 'Bolacha', 'dog', 'relva', '2025-11-01', true);
select is((select color from public.pets where id = 'd0000000-0000-0000-0000-000000000001'), 'relva', 'guarda a cor');
select is((select birth_date_is_estimate from public.pets where id = 'd0000000-0000-0000-0000-000000000001'), true, 'guarda idade aproximada');
select throws_ok($$insert into public.pets (name, species, color) values ('X', 'dog', 'rosa')$$,
  '23514', null, 'cor fora da paleta é rejeitada');
select throws_ok($$insert into public.pets (name, species) values ('X', 'rabbit')$$,
  '23514', null, 'espécie fora de cão/gato é rejeitada');

insert into public.pet_members (pet_id, user_id, role)
values ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'caregiver');

-- Dono escreve foto
select lives_ok($$insert into storage.objects (bucket_id, name, owner) values ('fotos', 'd0000000-0000-0000-0000-000000000001/a.jpg', 'c0000000-0000-0000-0000-000000000001')$$,
  'dono carrega foto');
select is((select count(*)::int from storage.objects where bucket_id = 'fotos'), 1, 'dono lê foto');
update public.pets set photo_path = 'd0000000-0000-0000-0000-000000000001/a.jpg' where id = 'd0000000-0000-0000-0000-000000000001';
select is((select photo_path from public.pets where id = 'd0000000-0000-0000-0000-000000000001'), 'd0000000-0000-0000-0000-000000000001/a.jpg', 'dono guarda photo_path');
select throws_ok($$insert into storage.objects (bucket_id, name, owner) values ('fotos', 'd0000000-0000-0000-0000-00000000ffff/a.jpg', 'c0000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'dono não carrega foto para animal alheio');
select throws_ok($$insert into storage.objects (bucket_id, name, owner) values ('fotos', 'lixo/a.jpg', 'c0000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'caminho sem uuid é rejeitado');

-- Cuidador
select pg_temp.act_as('c0000000-0000-0000-0000-000000000002');
select is((select count(*)::int from storage.objects where bucket_id = 'fotos'), 1, 'cuidador lê foto');
select throws_ok($$insert into storage.objects (bucket_id, name, owner) values ('fotos', 'd0000000-0000-0000-0000-000000000001/b.jpg', 'c0000000-0000-0000-0000-000000000002')$$,
  '42501', null, 'cuidador não carrega foto');
delete from storage.objects where bucket_id = 'fotos' and name = 'd0000000-0000-0000-0000-000000000001/a.jpg';
select is((select count(*)::int from storage.objects where bucket_id = 'fotos'), 1, 'cuidador não apaga foto');
update public.pets set archived_at = now() where id = 'd0000000-0000-0000-0000-000000000001';
select is((select archived_at from public.pets where id = 'd0000000-0000-0000-0000-000000000001'), null, 'cuidador não arquiva');

-- Estranho
select pg_temp.act_as('c0000000-0000-0000-0000-000000000003');
select is((select count(*)::int from storage.objects where bucket_id = 'fotos'), 0, 'estranho não vê foto');
select throws_ok($$insert into storage.objects (bucket_id, name, owner) values ('fotos', 'd0000000-0000-0000-0000-000000000001/c.jpg', 'c0000000-0000-0000-0000-000000000003')$$,
  '42501', null, 'estranho não carrega foto');

-- Dono arquiva, reativa e apaga a foto
select pg_temp.act_as('c0000000-0000-0000-0000-000000000001');
update public.pets set archived_at = now() where id = 'd0000000-0000-0000-0000-000000000001';
select isnt((select archived_at from public.pets where id = 'd0000000-0000-0000-0000-000000000001'), null, 'dono arquiva');
update public.pets set archived_at = null where id = 'd0000000-0000-0000-0000-000000000001';
select is((select archived_at from public.pets where id = 'd0000000-0000-0000-0000-000000000001'), null, 'dono reativa');
delete from storage.objects where bucket_id = 'fotos' and name = 'd0000000-0000-0000-0000-000000000001/a.jpg';
select is((select count(*)::int from storage.objects where bucket_id = 'fotos'), 0, 'dono apaga foto');

select * from finish();
rollback;
