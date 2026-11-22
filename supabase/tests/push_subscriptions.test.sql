-- push_subscriptions: cada utilizador só vê e gere as suas; guardar passa pela RPC.
begin;
select plan(12);

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  ('f2000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ps-a@example.test', now(), now()),
  ('f2000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ps-b@example.test', now(), now());

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

select pg_temp.act_as('f2000000-0000-0000-0000-000000000001');
select lives_ok($$
  select public.save_push_subscription('https://push.example.test/a', 'p256-a', 'auth-a', 'iPhone')
$$, 'utilizador guarda a sua subscrição');
select is((select count(*)::int from public.push_subscriptions), 1, 'vê a sua subscrição');

select throws_ok($$
  insert into public.push_subscriptions (endpoint, p256dh, auth) values ('https://push.example.test/x', 'p', 'a')
$$, '42501', null, 'inserção direta não é permitida (só pela RPC)');

-- Voltar a guardar o mesmo endpoint não duplica
select lives_ok($$
  select public.save_push_subscription('https://push.example.test/a', 'p256-a2', 'auth-a2', 'iPhone')
$$, 'guardar o mesmo endpoint é idempotente');
select is((select count(*)::int from public.push_subscriptions), 1, 'continua uma só linha');
select is((select p256dh from public.push_subscriptions), 'p256-a2', 'chaves atualizadas');

select throws_ok($$
  select public.save_push_subscription('ftp://x', 'p', 'a')
$$, '23514', null, 'endpoint tem de ser http(s)');

-- O outro utilizador não vê nem apaga
select pg_temp.act_as('f2000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.push_subscriptions), 0, 'outro utilizador não vê subscrições alheias');
delete from public.push_subscriptions;
select pg_temp.act_as('f2000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.push_subscriptions), 1, 'outro utilizador não apaga subscrições alheias');

-- Mudança de conta no mesmo browser: a subscrição passa para o utilizador atual
select pg_temp.act_as('f2000000-0000-0000-0000-000000000002');
select lives_ok($$
  select public.save_push_subscription('https://push.example.test/a', 'p256-b', 'auth-b', 'iPhone')
$$, 'o mesmo endpoint noutra conta passa para essa conta');
select is(
  (select user_id from public.push_subscriptions where endpoint = 'https://push.example.test/a'),
  'f2000000-0000-0000-0000-000000000002'::uuid, 'subscrição reatribuída');

-- Apagar a própria
delete from public.push_subscriptions;
select is((select count(*)::int from public.push_subscriptions), 0, 'apaga a sua subscrição');

select * from finish();
rollback;
