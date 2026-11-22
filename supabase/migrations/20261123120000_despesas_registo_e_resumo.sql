-- Fase 4, passo 1: gravar despesas (criar/editar com splits) numa transação e resumos por período.
-- As categorias da BD já cobrem as 8 do ecrã 26 (veterinary, medication, food, hygiene,
-- accessories, insurance, boarding, other); só mudam os rótulos na app.

-- Soma dos splits de animais a que NÃO tenho acesso (só para quem vê a despesa).
-- Serve para validar a edição: o total da despesa inclui o que não vejo.
create function public.expense_hidden_cents(p_expense_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(s.amount_cents), 0)::bigint
  from public.expense_splits s
  where s.expense_id = p_expense_id
    and not public.is_pet_member(s.pet_id)
    and public.can_see_expense(p_expense_id);
$$;

revoke all on function public.expense_hidden_cents(uuid) from public, anon;
grant execute on function public.expense_hidden_cents(uuid) to authenticated;

-- Cria ou atualiza uma despesa e os seus splits.
-- payload: { "id"?: uuid, "amount_cents", "category", "spent_on"?, "description"?, "paid_by"?,
--            "document_id"?, "splits": [{ "pet_id", "amount_cents" }] }
-- Na edição, sem "splits" só mudam os campos da despesa (o total e os animais ficam como estão);
-- com "splits", substituem-se os splits dos animais que o utilizador vê (os que não vê ficam).
-- Security invoker: o RLS aplica-se como ao utilizador que chama; qualquer erro reverte tudo.
create function public.save_expense(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := nullif(payload ->> 'id', '')::uuid;
  v_amount integer := (payload ->> 'amount_cents')::integer;
  v_category text := payload ->> 'category';
  v_spent date := nullif(payload ->> 'spent_on', '')::date;
  v_desc text := nullif(btrim(coalesce(payload ->> 'description', '')), '');
  v_doc uuid := nullif(payload ->> 'document_id', '')::uuid;
  v_paid uuid;
  v_splits jsonb := payload -> 'splits';
  v_sum bigint;
  v_n integer;
  v_distinct integer;
  v_hidden bigint := 0;
  v_rows integer;
  v_pets uuid[];
begin
  if v_splits is not null and jsonb_typeof(v_splits) <> 'array' then
    raise exception 'Splits inválidos.' using errcode = '22023';
  end if;

  if v_splits is not null then
    select count(*), count(distinct (x ->> 'pet_id')), coalesce(sum((x ->> 'amount_cents')::bigint), 0),
           array_agg((x ->> 'pet_id')::uuid)
      into v_n, v_distinct, v_sum, v_pets
    from jsonb_array_elements(v_splits) x;
    if v_n = 0 then
      raise exception 'A despesa tem de ter pelo menos um animal.' using errcode = '23514';
    end if;
    if v_n <> v_distinct then
      raise exception 'Cada animal só pode aparecer uma vez.' using errcode = '23514';
    end if;
  end if;

  if v_id is null then
    if v_splits is null then
      raise exception 'A despesa tem de ter pelo menos um animal.' using errcode = '23514';
    end if;
    v_paid := coalesce(nullif(payload ->> 'paid_by', '')::uuid, (select auth.uid()));
    if not public.can_be_payer(v_paid) then
      raise exception 'Quem pagou tem de ser alguém que partilha o animal.' using errcode = '42501';
    end if;
    if v_sum <> v_amount then
      raise exception 'A soma das partes (%) não é igual ao total da despesa (%).', v_sum, v_amount
        using errcode = '23514';
    end if;

    insert into public.expenses (spent_on, category, amount_cents, description, paid_by, document_id)
    values (coalesce(v_spent, (now() at time zone 'Europe/Lisbon')::date), v_category, v_amount, v_desc, v_paid, v_doc)
    returning id into v_id;

    insert into public.expense_splits (expense_id, pet_id, amount_cents)
    select v_id, (x ->> 'pet_id')::uuid, (x ->> 'amount_cents')::integer
    from jsonb_array_elements(v_splits) x;

    return v_id;
  end if;

  -- Edição
  if not exists (select 1 from public.expenses where id = v_id) or not public.can_edit_expense(v_id) then
    raise exception 'Não podes editar esta despesa.' using errcode = '42501';
  end if;

  select coalesce(nullif(payload ->> 'paid_by', '')::uuid, e.paid_by) into v_paid
  from public.expenses e where e.id = v_id;
  if not public.can_be_payer(v_paid) then
    raise exception 'Quem pagou tem de ser alguém que partilha o animal.' using errcode = '42501';
  end if;

  if v_splits is null then
    update public.expenses
       set spent_on = coalesce(v_spent, spent_on), category = v_category, description = v_desc,
           paid_by = v_paid, document_id = v_doc
     where id = v_id;
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then
      raise exception 'Não podes editar esta despesa.' using errcode = '42501';
    end if;
    return v_id;
  end if;

  v_hidden := public.expense_hidden_cents(v_id);
  if v_sum + v_hidden <> v_amount then
    raise exception 'A soma das partes (%) não é igual ao total da despesa (%).', v_sum + v_hidden, v_amount
      using errcode = '23514';
  end if;

  update public.expenses
     set spent_on = coalesce(v_spent, spent_on), category = v_category, amount_cents = v_amount,
         description = v_desc, paid_by = v_paid, document_id = v_doc
   where id = v_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'Não podes editar esta despesa.' using errcode = '42501';
  end if;

  delete from public.expense_splits
   where expense_id = v_id and pet_id <> all (v_pets);

  insert into public.expense_splits (expense_id, pet_id, amount_cents)
  select v_id, (x ->> 'pet_id')::uuid, (x ->> 'amount_cents')::integer
  from jsonb_array_elements(v_splits) x
  on conflict (expense_id, pet_id) do update set amount_cents = excluded.amount_cents;

  return v_id;
end;
$$;

revoke all on function public.save_expense(jsonb) from public, anon;
grant execute on function public.save_expense(jsonb) to authenticated;

-- Resumo de um período [p_from, p_to) com filtros opcionais. Security invoker: só somam os
-- splits dos animais que o utilizador vê (RLS), por isso o total é coerente com a lista.
-- Devolve: total_cents, by_pet, by_category, by_payer e items (uma linha por despesa, com o
-- valor dos splits visíveis, o total da despesa e os animais).
create function public.expense_overview(
  p_from date,
  p_to date,
  p_pet_id uuid default null,
  p_category text default null,
  p_paid_by uuid default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with rows as (
    select e.id, e.spent_on, e.category, e.description, e.paid_by, e.vet_visit_id,
           e.created_at, e.amount_cents as total_cents,
           s.pet_id, s.amount_cents
    from public.expense_splits s
    join public.expenses e on e.id = s.expense_id
    where e.spent_on >= p_from and e.spent_on < p_to
      and (p_pet_id is null or s.pet_id = p_pet_id)
      and (p_category is null or e.category = p_category)
      and (p_paid_by is null or e.paid_by = p_paid_by)
  ),
  items as (
    select id, spent_on, category, description, paid_by, vet_visit_id, created_at, total_cents,
           sum(amount_cents)::bigint as amount_cents,
           jsonb_agg(jsonb_build_object('pet_id', pet_id, 'amount_cents', amount_cents)
                     order by amount_cents desc, pet_id) as pets
    from rows
    group by id, spent_on, category, description, paid_by, vet_visit_id, created_at, total_cents
  )
  select jsonb_build_object(
    'total_cents', coalesce((select sum(amount_cents) from rows), 0)::bigint,
    'by_pet', coalesce((
      select jsonb_agg(jsonb_build_object('pet_id', pet_id, 'amount_cents', c) order by c desc, pet_id)
      from (select pet_id, sum(amount_cents)::bigint as c from rows group by pet_id) x
    ), '[]'::jsonb),
    'by_category', coalesce((
      select jsonb_agg(jsonb_build_object('category', category, 'amount_cents', c) order by c desc, category)
      from (select category, sum(amount_cents)::bigint as c from rows group by category) x
    ), '[]'::jsonb),
    'by_payer', coalesce((
      select jsonb_agg(jsonb_build_object('paid_by', paid_by, 'amount_cents', c) order by c desc, paid_by)
      from (select paid_by, sum(amount_cents)::bigint as c from rows group by paid_by) x
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.spent_on desc, i.created_at desc)
      from (select * from items order by spent_on desc, created_at desc limit 1000) i
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.expense_overview(date, date, uuid, text, uuid) from public, anon;
grant execute on function public.expense_overview(date, date, uuid, text, uuid) to authenticated;
