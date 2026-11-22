-- Bucket «documentos»: privado, caminho {pet_id}/{ficheiro}, políticas por animal.
-- Membros leem e carregam; apaga/altera o dono ou quem carregou.
begin;
select plan(14);

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  ('b1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd-dono@example.test', now(), now()),
  ('b1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd-cuid1@example.test', now(), now()),
  ('b1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd-cuid2@example.test', now(), now()),
  ('b1000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd-estranho@example.test', now(), now());

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

-- O Storage bloqueia DELETE direto salvo com este parâmetro (o RLS aplica-se na mesma).
set local storage.allow_delete_query = 'true';

select is((select public from storage.buckets where id = 'documentos'), false, 'bucket documentos é privado');

select pg_temp.act_as('b1000000-0000-0000-0000-000000000001');
insert into public.pets (id, name, species) values ('b0000000-0000-0000-0000-000000000001', 'Nina', 'dog');
insert into public.pet_members (pet_id, user_id, role) values
  ('b0000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', 'caregiver'),
  ('b0000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000003', 'caregiver');

select lives_ok($$insert into storage.objects (bucket_id, name, owner) values ('documentos', 'b0000000-0000-0000-0000-000000000001/dono.pdf', 'b1000000-0000-0000-0000-000000000001')$$,
  'dono carrega documento');
select throws_ok($$insert into storage.objects (bucket_id, name, owner) values ('documentos', 'b0000000-0000-0000-0000-0000000000ff/x.pdf', 'b1000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'dono não carrega para animal alheio');
select throws_ok($$insert into storage.objects (bucket_id, name, owner) values ('documentos', 'lixo/x.pdf', 'b1000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'caminho sem uuid é rejeitado');

-- Cuidador 1
select pg_temp.act_as('b1000000-0000-0000-0000-000000000002');
select lives_ok($$insert into storage.objects (bucket_id, name, owner) values ('documentos', 'b0000000-0000-0000-0000-000000000001/cuid1.pdf', 'b1000000-0000-0000-0000-000000000002')$$,
  'cuidador carrega documento');
select is((select count(*)::int from storage.objects where bucket_id = 'documentos'), 2, 'cuidador lê os documentos do animal');
delete from storage.objects where bucket_id = 'documentos' and name = 'b0000000-0000-0000-0000-000000000001/dono.pdf';
select is((select count(*)::int from storage.objects where bucket_id = 'documentos' and name like '%/dono.pdf'), 1, 'cuidador não apaga documento do dono');

-- Cuidador 2
select pg_temp.act_as('b1000000-0000-0000-0000-000000000003');
delete from storage.objects where bucket_id = 'documentos' and name = 'b0000000-0000-0000-0000-000000000001/cuid1.pdf';
select is((select count(*)::int from storage.objects where bucket_id = 'documentos' and name like '%/cuid1.pdf'), 1, 'outro cuidador não apaga documento alheio');

-- Estranho
select pg_temp.act_as('b1000000-0000-0000-0000-000000000004');
select is((select count(*)::int from storage.objects where bucket_id = 'documentos'), 0, 'estranho não vê documentos');
select throws_ok($$insert into storage.objects (bucket_id, name, owner) values ('documentos', 'b0000000-0000-0000-0000-000000000001/estranho.pdf', 'b1000000-0000-0000-0000-000000000004')$$,
  '42501', null, 'estranho não carrega documento');
delete from storage.objects where bucket_id = 'documentos';
select pg_temp.act_as('b1000000-0000-0000-0000-000000000001');
select is((select count(*)::int from storage.objects where bucket_id = 'documentos'), 2, 'estranho não apaga nada');

-- Cuidador apaga o que carregou; dono apaga o de qualquer um
select pg_temp.act_as('b1000000-0000-0000-0000-000000000002');
delete from storage.objects where bucket_id = 'documentos' and name = 'b0000000-0000-0000-0000-000000000001/cuid1.pdf';
select is((select count(*)::int from storage.objects where bucket_id = 'documentos' and name like '%/cuid1.pdf'), 0, 'cuidador apaga o que carregou');
select pg_temp.act_as('b1000000-0000-0000-0000-000000000001');
select lives_ok($$insert into storage.objects (bucket_id, name, owner) values ('documentos', 'b0000000-0000-0000-0000-000000000001/outro.pdf', 'b1000000-0000-0000-0000-000000000003')$$,
  'dono insere ficheiro (de outro uploader, para o teste)');
delete from storage.objects where bucket_id = 'documentos' and name = 'b0000000-0000-0000-0000-000000000001/outro.pdf';
select is((select count(*)::int from storage.objects where bucket_id = 'documentos' and name like '%/outro.pdf'), 0, 'dono apaga documento de cuidador');

select * from finish();
rollback;
