-- Gravação transacional de consultas e registos rápidos.
-- Todas as funções são security invoker: o RLS aplica-se como ao utilizador que chama.
-- Qualquer erro reverte a transação inteira.

-- Cria a despesa de um animal (split único) e devolve o id.
create function public.record_pet_expense(
  p_pet_id uuid,
  p_amount_cents integer,
  p_category text,
  p_spent_on date,
  p_description text,
  p_paid_by uuid,
  p_vet_visit_id uuid,
  p_document_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.expenses (spent_on, category, amount_cents, description, paid_by, vet_visit_id, document_id)
  values (p_spent_on, p_category, p_amount_cents, p_description,
          coalesce(p_paid_by, (select auth.uid())), p_vet_visit_id, p_document_id)
  returning id into v_id;

  insert into public.expense_splits (expense_id, pet_id, amount_cents)
  values (v_id, p_pet_id, p_amount_cents);

  return v_id;
end;
$$;

-- Auxiliar das funções abaixo (security invoker, por isso o RLS continua a aplicar-se).
revoke all on function public.record_pet_expense(uuid, integer, text, date, text, uuid, uuid, uuid)
  from public, anon;
grant execute on function public.record_pet_expense(uuid, integer, text, date, text, uuid, uuid, uuid)
  to authenticated;

-- Insere um health_event a partir de um objeto jsonb.
create function public.insert_health_event(
  p_pet_id uuid,
  p_default_date date,
  p_vet_visit_id uuid,
  p_item jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.health_events
    (pet_id, type, occurred_on, title, product, preset_id, notes, next_due_on, remind, vet_visit_id)
  values (
    p_pet_id,
    p_item ->> 'type',
    coalesce((p_item ->> 'occurred_on')::date, p_default_date),
    p_item ->> 'title',
    nullif(btrim(p_item ->> 'product'), ''),
    (p_item ->> 'preset_id')::uuid,
    nullif(btrim(p_item ->> 'notes'), ''),
    (p_item ->> 'next_due_on')::date,
    coalesce((p_item ->> 'remind')::boolean, true),
    p_vet_visit_id
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.insert_health_event(uuid, date, uuid, jsonb)
  from public, anon;
grant execute on function public.insert_health_event(uuid, date, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- record_vet_visit(payload)
--
-- {
--   "pet_id": uuid, "visited_on": "2026-11-22", "reason": "Vacinação",
--   "vet_name": "...", "clinic": "...", "notes": "...",
--   "weight_kg": 12.4,
--   "health_events": [{ "type", "title", "product", "preset_id", "notes", "next_due_on", "remind" }],
--   "medications": [{ "name", "dose", "schedule_rrule", "starts_on", "ends_on", "notes", "remind" }],
--   "expense": { "amount_cents": 4500, "category": "veterinary", "description": "...", "paid_by": uuid },
--   "document_id": uuid   -- documento já carregado, é ligado à consulta (e à despesa)
-- }
-- Devolve o id da consulta.
-- ---------------------------------------------------------------------------
create function public.record_vet_visit(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_pet_id uuid := (payload ->> 'pet_id')::uuid;
  v_date date := coalesce((payload ->> 'visited_on')::date, (now() at time zone 'Europe/Lisbon')::date);
  v_visit_id uuid;
  v_item jsonb;
  v_exp jsonb := payload -> 'expense';
  v_doc_id uuid := (payload ->> 'document_id')::uuid;
  v_rows integer;
begin
  if v_pet_id is null then
    raise exception 'Falta o animal.' using errcode = '22023';
  end if;
  if not public.is_pet_member(v_pet_id) then
    raise exception 'Sem acesso a este animal.' using errcode = '42501';
  end if;

  insert into public.vet_visits (pet_id, visited_on, reason, vet_name, clinic, notes)
  values (
    v_pet_id, v_date,
    nullif(btrim(payload ->> 'reason'), ''),
    nullif(btrim(payload ->> 'vet_name'), ''),
    nullif(btrim(payload ->> 'clinic'), ''),
    nullif(btrim(payload ->> 'notes'), '')
  )
  returning id into v_visit_id;

  if nullif(payload ->> 'weight_kg', '') is not null then
    insert into public.weights (pet_id, measured_on, weight_kg, vet_visit_id)
    values (v_pet_id, v_date, (payload ->> 'weight_kg')::numeric, v_visit_id);
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(payload -> 'health_events', '[]'::jsonb))
  loop
    perform public.insert_health_event(v_pet_id, v_date, v_visit_id, v_item);
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(payload -> 'medications', '[]'::jsonb))
  loop
    insert into public.medications
      (pet_id, name, dose, schedule_rrule, starts_on, ends_on, notes, remind, vet_visit_id)
    values (
      v_pet_id,
      v_item ->> 'name',
      nullif(btrim(v_item ->> 'dose'), ''),
      nullif(btrim(v_item ->> 'schedule_rrule'), ''),
      coalesce((v_item ->> 'starts_on')::date, v_date),
      (v_item ->> 'ends_on')::date,
      nullif(btrim(v_item ->> 'notes'), ''),
      coalesce((v_item ->> 'remind')::boolean, true),
      v_visit_id
    );
  end loop;

  if v_doc_id is not null then
    update public.documents set vet_visit_id = v_visit_id
    where id = v_doc_id and pet_id = v_pet_id;
    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      raise exception 'Documento não encontrado para este animal.' using errcode = '42501';
    end if;
  end if;

  if v_exp is not null and jsonb_typeof(v_exp) = 'object' then
    perform public.record_pet_expense(
      v_pet_id,
      (v_exp ->> 'amount_cents')::integer,
      coalesce(v_exp ->> 'category', 'veterinary'),
      v_date,
      nullif(btrim(v_exp ->> 'description'), ''),
      (v_exp ->> 'paid_by')::uuid,
      v_visit_id,
      v_doc_id
    );
  end if;

  -- Falha já aqui (e não só no commit) se as contas não batem.
  set constraints all immediate;
  set constraints all deferred;

  return v_visit_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- record_weight(payload) — peso fora de consulta
-- { "pet_id": uuid, "measured_on": "2026-11-22", "weight_kg": 12.4 }
-- ---------------------------------------------------------------------------
create function public.record_weight(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.weights (pet_id, measured_on, weight_kg)
  values (
    (payload ->> 'pet_id')::uuid,
    coalesce((payload ->> 'measured_on')::date, (now() at time zone 'Europe/Lisbon')::date),
    (payload ->> 'weight_kg')::numeric
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- record_home_treatment(payload) — vacina/desparasitação fora de consulta
-- { "pet_id", "type", "title", "occurred_on", "product", "preset_id", "notes",
--   "next_due_on", "remind", "expense": { "amount_cents", "category", "paid_by" } }
-- Devolve o id do evento de saúde.
-- ---------------------------------------------------------------------------
create function public.record_home_treatment(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_pet_id uuid := (payload ->> 'pet_id')::uuid;
  v_date date := coalesce((payload ->> 'occurred_on')::date, (now() at time zone 'Europe/Lisbon')::date);
  v_exp jsonb := payload -> 'expense';
  v_id uuid;
begin
  if v_pet_id is null then
    raise exception 'Falta o animal.' using errcode = '22023';
  end if;
  if not public.is_pet_member(v_pet_id) then
    raise exception 'Sem acesso a este animal.' using errcode = '42501';
  end if;

  v_id := public.insert_health_event(v_pet_id, v_date, null, payload);

  if v_exp is not null and jsonb_typeof(v_exp) = 'object' then
    perform public.record_pet_expense(
      v_pet_id,
      (v_exp ->> 'amount_cents')::integer,
      coalesce(v_exp ->> 'category', 'medication'),
      v_date,
      coalesce(nullif(btrim(v_exp ->> 'description'), ''), payload ->> 'title'),
      (v_exp ->> 'paid_by')::uuid,
      null,
      null
    );
  end if;

  set constraints all immediate;
  set constraints all deferred;

  return v_id;
end;
$$;

revoke all on function public.record_vet_visit(jsonb), public.record_weight(jsonb),
  public.record_home_treatment(jsonb) from public, anon;
grant execute on function public.record_vet_visit(jsonb), public.record_weight(jsonb),
  public.record_home_treatment(jsonb) to authenticated;
