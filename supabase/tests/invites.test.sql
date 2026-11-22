begin;
select plan(27);

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'i-dono@example.test', now(), now()),
  ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'i-cuidador@example.test', now(), now()),
  ('c0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'i-convidado@example.test', now(), now()),
  ('c0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'i-estranho@example.test', now(), now());

create function pg_temp.act_as(uid uuid, mail text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated', 'email', mail)::text, true);
  set local role authenticated;
end $$;

create function pg_temp.act_as_postgres() returns void language plpgsql as $$
begin
  reset role;
end $$;

-- Dono cria o animal e o cuidador já é membro
select pg_temp.act_as('c0000000-0000-0000-0000-000000000001', 'i-dono@example.test');
insert into public.pets (id, name, species) values ('d0000000-0000-0000-0000-000000000001', 'Nina', 'dog');
insert into public.pets (id, name, species) values ('d0000000-0000-0000-0000-000000000002', 'Simba', 'cat');
insert into public.pet_members (pet_id, user_id, role)
values ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'caregiver');

-- Dono convida (email normalizado)
select lives_ok($$select public.invite_to_pet('d0000000-0000-0000-0000-000000000001', '  I-Convidado@Example.TEST ')$$, 'dono convida');
select is((select email from public.pet_invites where pet_id = 'd0000000-0000-0000-0000-000000000001'), 'i-convidado@example.test', 'email normalizado em minúsculas');
select is((select role from public.pet_invites where pet_id = 'd0000000-0000-0000-0000-000000000001'), 'caregiver', 'papel por defeito é cuidador');

-- Duplicado reaproveita o pendente (e atualiza o papel)
select lives_ok($$select public.invite_to_pet('d0000000-0000-0000-0000-000000000001', 'i-convidado@example.test', 'owner')$$, 'convidar de novo não falha');
select is((select count(*)::int from public.pet_invites where pet_id = 'd0000000-0000-0000-0000-000000000001'), 1, 'convite duplicado reaproveita o pendente');
select is((select role from public.pet_invites where pet_id = 'd0000000-0000-0000-0000-000000000001'), 'owner', 'reenvio atualiza o papel');
select public.invite_to_pet('d0000000-0000-0000-0000-000000000001', 'i-convidado@example.test', 'caregiver');

-- Não se convida quem já é membro
select throws_ok($$select public.invite_to_pet('d0000000-0000-0000-0000-000000000001', 'i-cuidador@example.test')$$,
  'P0001', 'already_member', 'não se convida um membro');
select throws_ok($$select public.invite_to_pet('d0000000-0000-0000-0000-000000000001', 'i-dono@example.test')$$,
  'P0001', 'already_member', 'dono não se convida a si');
select throws_ok($$select public.invite_to_pet('d0000000-0000-0000-0000-000000000001', 'sem-arroba')$$,
  '22023', 'invalid_email', 'email inválido');

-- Reenvio renova a validade
select pg_temp.act_as_postgres();
update public.pet_invites set expires_at = now() + interval '1 day';
select pg_temp.act_as('c0000000-0000-0000-0000-000000000001', 'i-dono@example.test');
select public.invite_to_pet('d0000000-0000-0000-0000-000000000001', 'i-convidado@example.test');
select ok((select expires_at > now() + interval '13 days' from public.pet_invites), 'reenvio renova a validade');

select is((select count(*)::int from public.pet_invites), 1, 'dono vê o convite pendente');

-- Cuidador não convida nem vê convites
select pg_temp.act_as('c0000000-0000-0000-0000-000000000002', 'i-cuidador@example.test');
select throws_ok($$select public.invite_to_pet('d0000000-0000-0000-0000-000000000001', 'outro@example.test')$$,
  '42501', 'forbidden', 'cuidador não convida');
select is((select count(*)::int from public.pet_invites), 0, 'cuidador não vê convites');
update public.pet_invites set cancelled_at = now();
select pg_temp.act_as_postgres();
select is((select count(*)::int from public.pet_invites where cancelled_at is not null and pet_id::text like 'd0000000%'), 0, 'cuidador não cancela convites');

-- Estranho: não convida, não vê, não aceita
select pg_temp.act_as('c0000000-0000-0000-0000-000000000004', 'i-estranho@example.test');
select throws_ok($$select public.invite_to_pet('d0000000-0000-0000-0000-000000000001', 'outro@example.test')$$,
  '42501', 'forbidden', 'estranho não convida');
select is((select count(*)::int from public.pet_invites), 0, 'estranho não vê convites');
select is((select count(*)::int from public.accept_pet_invites()), 0, 'estranho não aceita convites de outros');
select is((select count(*)::int from public.pet_members where user_id = 'c0000000-0000-0000-0000-000000000004'), 0, 'estranho continua sem acesso');

-- Convidado vê o seu convite e aceita
select pg_temp.act_as('c0000000-0000-0000-0000-000000000003', 'I-Convidado@example.test');
select is((select count(*)::int from public.pet_invites), 1, 'convidado vê o seu convite');
select is((select count(*)::int from public.pets), 0, 'convidado ainda não vê o animal');
select is((select count(*)::int from public.accept_pet_invites()), 1, 'convidado aceita (email em maiúsculas no JWT)');
select is((select role from public.pet_members where user_id = 'c0000000-0000-0000-0000-000000000003'), 'caregiver', 'entra como cuidador');
select is((select count(*)::int from public.pets), 1, 'convidado vê o animal');
select is((select count(*)::int from public.accept_pet_invites()), 0, 'convite só se aceita uma vez');

-- Cancelado e expirado não aceitam
select pg_temp.act_as('c0000000-0000-0000-0000-000000000001', 'i-dono@example.test');
select public.invite_to_pet('d0000000-0000-0000-0000-000000000002', 'i-estranho@example.test');
update public.pet_invites set cancelled_at = now() where email = 'i-estranho@example.test';
select public.invite_to_pet('d0000000-0000-0000-0000-000000000001', 'i-estranho@example.test');
select pg_temp.act_as_postgres();
update public.pet_invites set expires_at = now() - interval '1 minute' where email = 'i-estranho@example.test' and pet_id = 'd0000000-0000-0000-0000-000000000001';
select pg_temp.act_as('c0000000-0000-0000-0000-000000000004', 'i-estranho@example.test');
select is((select count(*)::int from public.accept_pet_invites()), 0, 'convite cancelado ou expirado não aceita');
select is((select count(*)::int from public.pet_members where user_id = 'c0000000-0000-0000-0000-000000000004'), 0, 'nada aceite');

-- Aceitação com o email errado não dá acesso
select pg_temp.act_as('c0000000-0000-0000-0000-000000000001', 'i-dono@example.test');
select public.invite_to_pet('d0000000-0000-0000-0000-000000000002', 'i-cuidador@example.test');
select pg_temp.act_as('c0000000-0000-0000-0000-000000000004', 'i-estranho@example.test');
select is((select count(*)::int from public.accept_pet_invites()), 0, 'convite para outro email não aceita');

select * from finish();
rollback;
