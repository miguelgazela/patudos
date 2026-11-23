-- Fase 6, passo 2: apagar conta (RGPD).
--
-- As FKs já estão certas: created_by, done_by e paid_by são `on delete set null`, e
-- pet_members, push_subscriptions e calendar_feeds saem em cascata com o utilizador.
-- Falta uma função que faça tudo numa transação, sem service role:
--
--  * Os animais de que a pessoa é o único dono (ao fim das transferências de posse, que a app
--    faz antes) são apagados com todo o historial. A app recebe a lista esperada (`p_pet_ids`)
--    e a função recusa se mudou entretanto: assim os ficheiros que a app apagou do Storage
--    correspondem exatamente aos animais apagados aqui.
--  * Os registos que a pessoa criou em animais que ficam mantêm-se, sem autor (`null`).
--  * Os ficheiros do Storage NÃO se apagam aqui (o Storage proíbe SQL direto): a app apaga-os
--    antes, com a sessão do dono. Repetir é seguro (idempotente).

create function public.delete_account(p_pet_ids uuid[] default '{}')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text;
  v_doomed uuid[];
  v_expected uuid[];
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Bloqueia os animais da pessoa enquanto decidimos (o guard dos membros faz o mesmo).
  perform 1 from public.pets
  where id in (select pet_id from public.pet_members where user_id = v_uid)
  for update;

  -- Único dono = sem outro dono (haja ou não cuidadores).
  select coalesce(array_agg(m.pet_id order by m.pet_id), '{}') into v_doomed
  from public.pet_members m
  where m.user_id = v_uid and m.role = 'owner'
    and not exists (
      select 1 from public.pet_members o
      where o.pet_id = m.pet_id and o.role = 'owner' and o.user_id <> v_uid
    );

  select coalesce(array_agg(distinct x order by x), '{}') into v_expected
  from unnest(coalesce(p_pet_ids, '{}')) as x;

  if v_doomed is distinct from v_expected then
    raise exception 'plan_changed' using errcode = 'P0001';
  end if;

  if cardinality(v_doomed) > 0 then
    -- Despesas só destes animais desaparecem; as partilhadas com animais que ficam
    -- perdem a parte dos animais apagados (o total passa a ser a soma do que fica).
    delete from public.expenses e
    where exists (select 1 from public.expense_splits s
                  where s.expense_id = e.id and s.pet_id = any (v_doomed))
      and not exists (select 1 from public.expense_splits s
                      where s.expense_id = e.id and s.pet_id <> all (v_doomed));

    update public.expenses e
    set amount_cents = (select sum(s.amount_cents) from public.expense_splits s
                        where s.expense_id = e.id and s.pet_id <> all (v_doomed))
    where exists (select 1 from public.expense_splits s
                  where s.expense_id = e.id and s.pet_id = any (v_doomed));

    -- Cascata: membros, convites, consultas, pesos, saúde, medicação, lembretes,
    -- ocorrências, documentos (metadados) e partes de despesas.
    delete from public.pets where id = any (v_doomed);
  end if;

  -- Convites enviados por mim e convites dirigidos ao meu email.
  select email into v_email from public.profiles where id = v_uid;
  delete from public.pet_invites
  where invited_by = v_uid
     or (coalesce(v_email, '') <> '' and email = lower(btrim(v_email)));

  -- Perfil, membros, subscrições push e feed de calendário saem em cascata;
  -- created_by / done_by / paid_by ficam a null nos animais que continuam.
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_account(uuid[]) from public, anon;
grant execute on function public.delete_account(uuid[]) to authenticated;
