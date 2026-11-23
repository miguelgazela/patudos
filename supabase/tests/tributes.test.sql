-- Tributos: dados do falecimento, memórias (RLS por animal), limites e fotos das memórias.
begin;
select plan(36);

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  ('e1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tr-dono@example.test', now(), now()),
  ('e1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tr-cuidador@example.test', now(), now()),
  ('e1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tr-estranho@example.test', now(), now());

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

-- O Storage bloqueia DELETE direto salvo com este parâmetro (o RLS aplica-se na mesma).
set local storage.allow_delete_query = 'true';

-- O dono tem o Nero (vivo) e o Tobias (já arquivado como falecido); o Nero tem um cuidador.
select pg_temp.act_as('e1000000-0000-0000-0000-000000000001');
insert into public.pets (id, name, species, birth_date) values
  ('e0000000-0000-0000-0000-000000000001', 'Nero', 'cat', '2012-05-10');
insert into public.pet_members (pet_id, user_id, role)
values ('e0000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000002', 'caregiver');

-- Falecimento só em animais arquivados e depois do nascimento
select throws_ok($$update public.pets set deceased_on = '2026-09-01', deceased_precision = 'month' where id = 'e0000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'falecido tem de estar arquivado');
select throws_ok($$update public.pets set archived_at = now(), deceased_on = '2011-01-01', deceased_precision = 'year' where id = 'e0000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'falecimento não pode ser antes do nascimento');
select throws_ok($$update public.pets set archived_at = now(), deceased_on = '2026-09-01', deceased_precision = 'semana' where id = 'e0000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'precisão fora de dia/mês/ano é rejeitada');

-- Memórias só existem em animais que faleceram
select throws_ok($$insert into public.pet_memories (pet_id, body) values ('e0000000-0000-0000-0000-000000000001', 'Ainda está cá')$$,
  '42501', null, 'não se deixam memórias de um animal vivo');

-- O cuidador não consegue marcar o animal como falecido nem editar o tributo
select pg_temp.act_as('e1000000-0000-0000-0000-000000000002');
update public.pets set archived_at = now(), deceased_on = '2026-09-01', deceased_precision = 'month', tribute_text = 'x'
 where id = 'e0000000-0000-0000-0000-000000000001';
select is((select deceased_on from public.pets where id = 'e0000000-0000-0000-0000-000000000001'), null, 'cuidador não marca como falecido');

-- Dono marca como falecido, com texto
select pg_temp.act_as('e1000000-0000-0000-0000-000000000001');
select lives_ok($$update public.pets set archived_at = now(), deceased_on = '2026-09-01', deceased_precision = 'month', tribute_text = 'Dormia ao sol.' where id = 'e0000000-0000-0000-0000-000000000001'$$,
  'dono marca como falecido');
select is((select deceased_precision from public.pets where id = 'e0000000-0000-0000-0000-000000000001'), 'month', 'guarda a precisão');
select throws_ok($$update public.pets set tribute_text = repeat('a', 1501) where id = 'e0000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'texto do tributo tem limite');

-- Memórias: dono e cuidador deixam as suas
select lives_ok($$insert into public.pet_memories (id, pet_id, body) values ('e2000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Esperava-me à porta.')$$,
  'dono deixa uma memória');
select throws_ok($$insert into public.pet_memories (pet_id, body) values ('e0000000-0000-0000-0000-000000000001', '   ')$$,
  '23514', null, 'memória vazia é rejeitada');
select throws_ok($$insert into public.pet_memories (pet_id, body) values ('e0000000-0000-0000-0000-000000000001', repeat('a', 601))$$,
  '23514', null, 'memória demasiado grande é rejeitada');
select throws_ok($$insert into public.pet_memories (pet_id, body, photo_path) values ('e0000000-0000-0000-0000-000000000001', 'Foto', 'e0000000-0000-0000-0000-000000000099/memorias/a.jpg')$$,
  '23514', null, 'foto tem de ser do próprio animal');
select throws_ok($$insert into public.pet_memories (pet_id, body, photo_path) values ('e0000000-0000-0000-0000-000000000001', 'Foto', 'e0000000-0000-0000-0000-000000000001/a.jpg')$$,
  '23514', null, 'foto tem de estar na pasta memorias');

select pg_temp.act_as('e1000000-0000-0000-0000-000000000002');
select lives_ok($$insert into public.pet_memories (id, pet_id, body) values ('e2000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'Gostava da minha manta.')$$,
  'cuidador deixa uma memória');
select throws_ok($$insert into public.pet_memories (pet_id, body, created_by) values ('e0000000-0000-0000-0000-000000000001', 'Em nome de outro', 'e1000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'não se escreve em nome de outra pessoa');
select is((select count(*)::int from public.pet_memories), 2, 'cuidador vê as memórias do animal');

-- Cada pessoa edita só as suas
select lives_ok($$update public.pet_memories set body = 'Gostava muito da minha manta.' where id = 'e2000000-0000-0000-0000-000000000002'$$,
  'cuidador edita a sua memória');
update public.pet_memories set body = 'Alterada' where id = 'e2000000-0000-0000-0000-000000000001';
select is((select body from public.pet_memories where id = 'e2000000-0000-0000-0000-000000000001'), 'Esperava-me à porta.', 'cuidador não edita a memória de outra pessoa');
delete from public.pet_memories where id = 'e2000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.pet_memories where id = 'e2000000-0000-0000-0000-000000000001'), 1, 'cuidador não apaga a memória de outra pessoa');

-- Fotos das memórias no Storage: o membro carrega na pasta memorias; não noutros sítios
select lives_ok($$insert into storage.objects (bucket_id, name, owner, owner_id) values ('fotos', 'e0000000-0000-0000-0000-000000000001/memorias/c.jpg', 'e1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000002')$$,
  'cuidador carrega foto de memória');
select throws_ok($$insert into storage.objects (bucket_id, name, owner, owner_id) values ('fotos', 'e0000000-0000-0000-0000-000000000001/capa.jpg', 'e1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000002')$$,
  '42501', null, 'cuidador continua sem poder mudar a foto do animal');
select lives_ok($$update public.pet_memories set photo_path = 'e0000000-0000-0000-0000-000000000001/memorias/c.jpg' where id = 'e2000000-0000-0000-0000-000000000002'$$,
  'memória guarda a foto');

-- Estranho: não vê, não escreve, não carrega fotos
select pg_temp.act_as('e1000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.pet_memories), 0, 'estranho não vê memórias');
select throws_ok($$insert into public.pet_memories (pet_id, body) values ('e0000000-0000-0000-0000-000000000001', 'Intruso')$$,
  '42501', null, 'estranho não deixa memórias');
select throws_ok($$insert into storage.objects (bucket_id, name, owner, owner_id) values ('fotos', 'e0000000-0000-0000-0000-000000000001/memorias/x.jpg', 'e1000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000003')$$,
  '42501', null, 'estranho não carrega fotos');

-- Dono apaga qualquer memória; o autor apaga a foto que carregou
select pg_temp.act_as('e1000000-0000-0000-0000-000000000002');
delete from storage.objects where bucket_id = 'fotos' and name = 'e0000000-0000-0000-0000-000000000001/memorias/c.jpg';
select is((select count(*)::int from storage.objects where name = 'e0000000-0000-0000-0000-000000000001/memorias/c.jpg'), 0, 'autor apaga a sua foto de memória');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000001');
select lives_ok($$delete from public.pet_memories where id = 'e2000000-0000-0000-0000-000000000002'$$, 'dono apaga a memória de outra pessoa');
select is((select count(*)::int from public.pet_memories), 1, 'fica a memória do dono');

-- Limites: 30 animais ativos; um animal que já nasce arquivado («Em memória de…») não conta
insert into public.pets (name, species) select 'Ativo ' || g, 'dog' from generate_series(1, 30) g;
select lives_ok($$insert into public.pets (name, species, archived_at, deceased_on, deceased_precision) values ('Antigo', 'cat', now(), '2020-01-01', 'year')$$,
  'em memória não conta para o limite');
select throws_ok($$insert into public.pets (name, species) values ('Trinta e um', 'dog')$$,
  'P0001', 'pet_limit', 'o animal ativo número 31 é recusado');

-- Apagar conta do cuidador: a memória fica, sem autor
select pg_temp.act_as('e1000000-0000-0000-0000-000000000002');
insert into public.pet_memories (id, pet_id, body) values ('e2000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'Última');
select lives_ok($$select public.delete_account('{}')$$, 'cuidador apaga a conta');
reset role;
select is((select created_by from public.pet_memories where id = 'e2000000-0000-0000-0000-000000000003'), null, 'a memória fica sem autor');

-- Anular o tributo apaga as memórias
select pg_temp.act_as('e1000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.pet_memories where pet_id = 'e0000000-0000-0000-0000-000000000001'), 2, 'antes de anular há memórias');
select lives_ok($$update public.pets set archived_at = null, deceased_on = null where id = 'e0000000-0000-0000-0000-000000000001'$$, 'dono anula o falecimento');
reset role;
select is((select count(*)::int from public.pet_memories where pet_id = 'e0000000-0000-0000-0000-000000000001'), 0, 'as memórias apagam-se com o tributo');

-- Apagar o animal leva as memórias
delete from public.pets where id = 'e0000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.pet_memories where pet_id = 'e0000000-0000-0000-0000-000000000001'), 0, 'memórias saem com o animal');

select * from finish();
rollback;
