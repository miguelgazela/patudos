-- Feed de calendário: token (criar, regenerar), RLS de calendar_feeds e conteúdo do feed.
begin;
select plan(21);

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  ('f3000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cal-a@example.test', now(), now()),
  ('f3000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cal-b@example.test', now(), now()),
  ('f3000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cal-c@example.test', now(), now());

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

-- A é dono da Nina; B é dono da Tica e cuidador da Nina; C não tem animais.
select pg_temp.act_as('f3000000-0000-0000-0000-000000000001');
insert into public.pets (id, name, species) values ('f3100000-0000-0000-0000-000000000001', 'Nina', 'dog');
insert into public.pet_members (pet_id, user_id, role)
values ('f3100000-0000-0000-0000-000000000001', 'f3000000-0000-0000-0000-000000000002', 'caregiver');
select public.save_reminder(jsonb_build_object(
  'pet_id', 'f3100000-0000-0000-0000-000000000001', 'title', 'Banho',
  'on', ((now() at time zone 'Europe/Lisbon')::date + 3)::text, 'at', '10:00'));
select public.save_reminder(jsonb_build_object(
  'pet_id', 'f3100000-0000-0000-0000-000000000001', 'title', 'Só push',
  'on', ((now() at time zone 'Europe/Lisbon')::date + 3)::text, 'at', '11:00',
  'channels', jsonb_build_array('push')));
select public.save_reminder(jsonb_build_object(
  'pet_id', 'f3100000-0000-0000-0000-000000000001', 'title', 'Escovar',
  'on', ((now() at time zone 'Europe/Lisbon')::date + 1)::text, 'at', '08:00', 'rrule', 'FREQ=WEEKLY'));

select pg_temp.act_as('f3000000-0000-0000-0000-000000000002');
insert into public.pets (id, name, species) values ('f3100000-0000-0000-0000-000000000002', 'Tica', 'cat');
select public.save_reminder(jsonb_build_object(
  'pet_id', 'f3100000-0000-0000-0000-000000000002', 'title', 'Ração',
  'on', ((now() at time zone 'Europe/Lisbon')::date + 2)::text, 'at', '09:00'));

-- Tokens
select pg_temp.act_as('f3000000-0000-0000-0000-000000000001');
create temp table tok (who text primary key, token text);
grant all on tok to public;
insert into tok select 'a', public.get_calendar_token();
select ok((select length(token) >= 43 from tok where who = 'a'), 'token com pelo menos 43 caracteres (≥ 32 bytes em base64url)');
select ok((select token ~ '^[A-Za-z0-9_-]+$' from tok where who = 'a'), 'token em base64url');
select is(public.get_calendar_token(), (select token from tok where who = 'a'), 'pedir outra vez devolve o mesmo token');

select pg_temp.act_as('f3000000-0000-0000-0000-000000000002');
insert into tok select 'b', public.get_calendar_token();
select pg_temp.act_as('f3000000-0000-0000-0000-000000000003');
insert into tok select 'c', public.get_calendar_token();

-- RLS: cada um só vê a sua linha
select is((select count(*)::int from public.calendar_feeds), 1, 'C só vê o seu feed');
select is((select user_id from public.calendar_feeds), 'f3000000-0000-0000-0000-000000000003'::uuid, 'e é o seu');
select throws_ok($$ insert into public.calendar_feeds (user_id, token) values ('f3000000-0000-0000-0000-000000000003', repeat('x', 43)) $$,
  '42501', null, 'não se insere diretamente');
select throws_ok($$ update public.calendar_feeds set token = repeat('x', 43) $$,
  '42501', null, 'não se altera diretamente');

-- anon: não lê a tabela, mas chama o feed
reset role;
set local role anon;
select throws_ok($$ select * from public.calendar_feeds $$, '42501', null, 'anon não lê calendar_feeds');
select throws_ok($$ select public.get_calendar_token() $$, '42501', null, 'anon não pede token');
select is(public.calendar_feed('token-errado'), null, 'token errado (curto) → null');
select is(public.calendar_feed(repeat('x', 43)), null, 'token errado (formato válido) → null');
select is(public.calendar_feed(null), null, 'token nulo → null');

-- Conteúdo do feed de A: só a Nina; respeita o canal «calendar»; recorrente expandido
select is(
  (select array_agg(distinct e ->> 'title' order by e ->> 'title')
     from jsonb_array_elements(public.calendar_feed((select token from tok where who = 'a')) -> 'events') e),
  array['Banho', 'Escovar'], 'A vê Banho e Escovar (não «Só push», não a Tica)');
select cmp_ok(
  (select count(*)::int from jsonb_array_elements(public.calendar_feed((select token from tok where who = 'a')) -> 'events') e
    where e ->> 'title' = 'Escovar'), '>', 40, 'lembrete semanal expandido em ~1 ano de ocorrências');

-- B: Nina (como cuidador) e Tica
select is(
  (select array_agg(distinct e ->> 'title' order by e ->> 'title')
     from jsonb_array_elements(public.calendar_feed((select token from tok where who = 'b')) -> 'events') e),
  array['Banho', 'Escovar', 'Ração'], 'B vê os animais de que é membro');
-- C: sem animais → feed vazio (mas válido)
select is(jsonb_array_length(public.calendar_feed((select token from tok where who = 'c')) -> 'events'), 0,
  'C: token válido, sem eventos');

-- Se B sai da Nina, os eventos da Nina desaparecem do feed de B
reset role;
delete from public.pet_members where pet_id = 'f3100000-0000-0000-0000-000000000001' and user_id = 'f3000000-0000-0000-0000-000000000002';
set local role anon;
select is(
  (select array_agg(distinct e ->> 'title' order by e ->> 'title')
     from jsonb_array_elements(public.calendar_feed((select token from tok where who = 'b')) -> 'events') e),
  array['Ração'], 'B saiu da Nina: só resta a Tica');

-- last_fetched_at é atualizado
reset role;
select isnt((select last_fetched_at from public.calendar_feeds where user_id = 'f3000000-0000-0000-0000-000000000001'), null,
  'last_fetched_at atualizado ao ler o feed');

-- Regenerar invalida o token antigo
select pg_temp.act_as('f3000000-0000-0000-0000-000000000001');
create temp table tok2 as select public.regenerate_calendar_token() as token;
grant all on tok2 to public;
select isnt((select token from tok2), (select token from tok where who = 'a'), 'regenerar dá um token diferente');
reset role;
set local role anon;
select is(public.calendar_feed((select token from tok where who = 'a')), null, 'o token antigo deixa de funcionar');
select isnt(public.calendar_feed((select token from tok2)), null, 'o novo funciona');

select * from finish();
rollback;
