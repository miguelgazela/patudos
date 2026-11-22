-- Despesas, divididas por animais (expense_splits). Dinheiro em cêntimos (EUR).
-- Visíveis a quem é membro de algum animal dos splits; só se divide por animais a que se tem acesso.

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  spent_on date not null default ((now() at time zone 'Europe/Lisbon')::date),
  category text not null check (category in
    ('veterinary', 'medication', 'food', 'hygiene', 'accessories', 'insurance', 'boarding', 'other')),
  amount_cents integer not null check (amount_cents >= 0),
  description text,
  paid_by uuid default auth.uid() references public.profiles (id) on delete set null,
  vet_visit_id uuid references public.vet_visits (id) on delete set null,
  document_id uuid references public.documents (id) on delete set null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.expense_splits (
  expense_id uuid not null references public.expenses (id) on delete cascade,
  pet_id uuid not null references public.pets (id) on delete cascade,
  amount_cents integer not null check (amount_cents >= 0),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (expense_id, pet_id)
);

create index expenses_spent_on_idx on public.expenses (spent_on desc);
create index expenses_visit_idx on public.expenses (vet_visit_id);
create index expense_splits_pet_idx on public.expense_splits (pet_id);

create trigger expenses_set_updated_at before update on public.expenses
  for each row execute function public.set_updated_at();

-- A soma dos splits tem de ser igual ao total e tem de haver pelo menos um split.
-- Verificado no fim da transação (deferred), para se poder inserir a despesa e depois os splits.
create function public.check_expense_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_total integer;
  v_sum bigint;
  v_count integer;
begin
  if tg_table_name = 'expenses' then
    v_id := new.id;
  elsif tg_op = 'DELETE' then
    v_id := old.expense_id;
  else
    v_id := new.expense_id;
  end if;

  select amount_cents into v_total from public.expenses where id = v_id;
  if not found then
    return null; -- despesa apagada (cascade)
  end if;
  select coalesce(sum(amount_cents), 0), count(*) into v_sum, v_count
  from public.expense_splits where expense_id = v_id;
  if v_count = 0 then
    raise exception 'A despesa tem de ter pelo menos um animal.' using errcode = '23514';
  end if;
  if v_sum <> v_total then
    raise exception 'A soma das partes (%) não é igual ao total da despesa (%).', v_sum, v_total
      using errcode = '23514';
  end if;
  return null;
end;
$$;

create constraint trigger expenses_check_total
  after insert or update of amount_cents on public.expenses
  deferrable initially deferred
  for each row execute function public.check_expense_total();

create constraint trigger expense_splits_check_total
  after insert or update or delete on public.expense_splits
  deferrable initially deferred
  for each row execute function public.check_expense_total();

-- Vê a despesa? Membro de algum animal dos splits (o criador também a vê enquanto
-- ainda não tem splits, para o INSERT ... RETURNING dentro da mesma transação).
create function public.can_see_expense(p_expense_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.expense_splits s
    where s.expense_id = p_expense_id and public.is_pet_member(s.pet_id)
  ) or exists (
    select 1 from public.expenses e
    where e.id = p_expense_id
      and e.created_by = (select auth.uid())
      and not exists (select 1 from public.expense_splits s where s.expense_id = e.id)
  );
$$;

-- Edita/apaga? Quem a criou (e vê), ou quem é dono de todos os animais dos splits.
create function public.can_edit_expense(p_expense_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_see_expense(p_expense_id) and exists (
    select 1 from public.expenses e
    where e.id = p_expense_id
      and (
        e.created_by = (select auth.uid())
        or not exists (
          select 1 from public.expense_splits s
          where s.expense_id = e.id and not public.is_pet_owner(s.pet_id)
        )
      )
  );
$$;

revoke all on function public.can_see_expense(uuid), public.can_edit_expense(uuid) from public, anon;
grant execute on function public.can_see_expense(uuid), public.can_edit_expense(uuid) to authenticated;

-- «Pago por» tem de ser o próprio ou alguém com quem partilho um animal.
create function public.can_be_payer(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is null
    or p_user_id = (select auth.uid())
    or public.shares_pet_with(p_user_id);
$$;

revoke all on function public.can_be_payer(uuid) from public, anon;
grant execute on function public.can_be_payer(uuid) to authenticated;

alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;

revoke all on public.expenses, public.expense_splits from anon, authenticated;
grant select, insert, delete on public.expenses, public.expense_splits to authenticated;
grant update (spent_on, category, amount_cents, description, paid_by, vet_visit_id, document_id)
  on public.expenses to authenticated;
grant update (amount_cents) on public.expense_splits to authenticated;

-- O criador vê a despesa enquanto ainda não tem splits (INSERT ... RETURNING). O ramo do criador
-- usa a coluna da própria linha porque uma função STABLE não vê a linha que está a ser inserida.
create function public.expense_has_splits(p_expense_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.expense_splits where expense_id = p_expense_id);
$$;

revoke all on function public.expense_has_splits(uuid) from public, anon;
grant execute on function public.expense_has_splits(uuid) to authenticated;

create policy "expenses_select_member" on public.expenses
  for select to authenticated
  using (
    public.can_see_expense(id)
    or (created_by = (select auth.uid()) and not public.expense_has_splits(id))
  );

create policy "expenses_insert_authenticated" on public.expenses
  for insert to authenticated
  with check (created_by = (select auth.uid()) and public.can_be_payer(paid_by));

create policy "expenses_update_owner_or_creator" on public.expenses
  for update to authenticated
  using (public.can_edit_expense(id))
  with check (public.can_edit_expense(id) and public.can_be_payer(paid_by));

create policy "expenses_delete_owner_or_creator" on public.expenses
  for delete to authenticated
  using (public.can_edit_expense(id));

-- Splits: só vejo/mexo nos dos animais a que tenho acesso.
create policy "expense_splits_select_member" on public.expense_splits
  for select to authenticated
  using (public.is_pet_member(pet_id));

create policy "expense_splits_insert_member" on public.expense_splits
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and public.is_pet_member(pet_id)
    and public.can_edit_expense(expense_id)
  );

create policy "expense_splits_update_editor" on public.expense_splits
  for update to authenticated
  using (public.is_pet_member(pet_id) and public.can_edit_expense(expense_id))
  with check (public.is_pet_member(pet_id) and public.can_edit_expense(expense_id));

create policy "expense_splits_delete_editor" on public.expense_splits
  for delete to authenticated
  using (public.is_pet_member(pet_id) and public.can_edit_expense(expense_id));
