-- Dados de exemplo (só desenvolvimento local).
-- Pedro, Mãe e Pai; Nina (cadela) partilhada; Simba e Pimenta (gatos) só do Pedro.

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'pedro@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'mae@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'pai@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

-- O trigger já criou os perfis com nome vazio.
update public.profiles set name = 'Pedro' where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set name = 'Mãe' where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set name = 'Pai' where id = '33333333-3333-3333-3333-333333333333';

-- O trigger faz do criador o dono.
insert into public.pets (id, name, species, breed, sex, birth_date, birth_date_is_estimate, neutered, color, created_by)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Nina', 'dog', 'Serra da Estrela', 'female', '2019-03-15', false, true, 'laranja', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Simba', 'cat', 'Europeu comum', 'male', '2021-06-01', true, true, 'azul', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Pimenta', 'cat', 'Europeu comum', 'female', '2022-09-10', true, true, 'uva', '11111111-1111-1111-1111-111111111111');

insert into public.pet_members (pet_id, user_id, role, notify)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'caregiver', true),
  ('aaaaaaaa-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'caregiver', true);
