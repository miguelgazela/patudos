-- Limites de utilização: convites, exportação, notificação de teste, animais, armazenamento, feed .ics.
begin;
select plan(18);

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  ('b1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'l-dono@example.test', now(), now()),
  ('b1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'l-outro@example.test', now(), now());

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

select pg_temp.act_as('b1000000-0000-0000-0000-000000000001');

-- Animais: 30 ativos por dono ----------------------------------------------------------
insert into public.pets (name, species) select 'Cão ' || g, 'dog' from generate_series(1, 30) g;
select is((select count(*)::int from public.pet_members where role = 'owner'), 30, '30 animais criados');
select throws_ok($$ insert into public.pets (name, species) values ('Demais', 'cat') $$,
  'P0001', 'pet_limit', 'o 31.º animal ativo é recusado');
update public.pets set archived_at = now() where name = 'Cão 1';
select lives_ok($$ insert into public.pets (name, species) values ('Cabe agora', 'cat') $$,
  'arquivar um animal liberta uma vaga');
-- Outro utilizador não é afetado
select pg_temp.act_as('b1000000-0000-0000-0000-000000000002');
select lives_ok($$ insert into public.pets (name, species) values ('Do outro', 'cat') $$, 'o limite é por dono');
select pg_temp.act_as('b1000000-0000-0000-0000-000000000001');

-- Convites: 20 por dia ---------------------------------------------------------------------
select lives_ok(
  $$ select public.invite_to_pet((select id from public.pets where name = 'Cão 2'), 'conv' || g || '@example.test')
     from generate_series(1, 20) g $$,
  '20 convites no dia');
select throws_ok(
  $$ select public.invite_to_pet((select id from public.pets where name = 'Cão 2'), 'conv21@example.test') $$,
  'P0001', 'rate_limited', 'o 21.º convite é recusado');
select throws_ok($$ select public.invite_to_pet((select id from public.pets where name = 'Cão 2'), 'conv22@example.test') $$,
  'P0001', 'rate_limited', 'continua recusado');
select is((select count(*)::int from public.pet_invites where pet_id = (select id from public.pets where name = 'Cão 2')),
  20, 'o convite recusado não foi criado');

-- Exportação: 3 por hora -------------------------------------------------------------------
select lives_ok($$ select public.consume_export() from generate_series(1, 3) $$, '3 exportações');
select throws_ok($$ select public.consume_export() $$, 'P0001', 'rate_limited', 'a 4.ª exportação é recusada');
select pg_temp.act_as('b1000000-0000-0000-0000-000000000002');
select lives_ok($$ select public.consume_export() $$, 'o limite é por utilizador');

-- Notificação de teste: só o service role; 1 por minuto ------------------------------------------
select throws_ok($$ select public.consume_test_push('b1000000-0000-0000-0000-000000000002') $$,
  '42501', null, 'um utilizador não chama consume_test_push');
reset role;
select lives_ok($$ select public.consume_test_push('b1000000-0000-0000-0000-000000000002') $$, 'primeira notificação de teste');
select throws_ok($$ select public.consume_test_push('b1000000-0000-0000-0000-000000000002') $$,
  'P0001', 'rate_limited', 'segunda no mesmo minuto é recusada');

-- Armazenamento: 200 MB por animal -------------------------------------------------------------
select pg_temp.act_as('b1000000-0000-0000-0000-000000000001');
reset role;
insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
select 'documentos', (select id from public.pets where name = 'Cão 3')::text || '/grande.pdf',
  'b1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001',
  jsonb_build_object('size', 201 * 1024 * 1024);
select pg_temp.act_as('b1000000-0000-0000-0000-000000000001');
select throws_ok(
  $$ insert into public.documents (pet_id, kind, title, storage_path)
     select id, 'other', 'Grande', id::text || '/grande.pdf' from public.pets where name = 'Cão 3' $$,
  'P0001', 'storage_pet_limit', 'mais de 200 MB num animal é recusado');
select lives_ok(
  $$ insert into public.documents (pet_id, kind, title, storage_path)
     select id, 'other', 'Pequeno', id::text || '/pequeno.pdf' from public.pets where name = 'Cão 4' $$,
  'outro animal não é afetado');

-- Feed .ics: 60 por hora por token --------------------------------------------------------------
select lives_ok($$ select public.get_calendar_token() $$, 'token criado');
select ok(
  (select bool_and(public.calendar_feed((select token from public.calendar_feeds)) ? 'events') from generate_series(1, 60))
  and (public.calendar_feed((select token from public.calendar_feeds)) ->> 'limited')::boolean,
  'depois de 60 pedidos o feed responde «limited»');

select * from finish();
rollback;
