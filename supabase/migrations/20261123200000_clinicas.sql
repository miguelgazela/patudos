-- Clínicas guardadas: substituem o texto livre «Veterinário / clínica» da consulta.
--
-- Modelo
--  * `clinics`: nome (obrigatório), telefone e morada (opcionais).
--  * `pets.clinic_id`: a clínica habitual do animal.
--  * `vet_visits.clinic_id`: a clínica onde a consulta foi feita.
--
-- Acesso (continua a ser sempre por animal, via `pet_members`): uma clínica vê-se se
--  (a) foi criada por mim, ou
--  (b) é a habitual de um animal de que sou membro, ou
--  (c) foi usada numa consulta de um animal de que sou membro.
-- Por isso as clínicas dos meus animais aparecem como sugestão em todos os meus animais,
-- sem uma tabela de «agregado» e sem expor clínicas de pessoas com quem não partilho animais.
--
-- As colunas antigas `vet_visits.vet_name` e `vet_visits.clinic` ficam por agora (deixam de
-- ser escritas pela app): guardam o nome do veterinário e permitem reverter sem perder dados.
-- Remover numa migração futura, depois de a versão nova estar em produção sem problemas.

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  phone text check (phone is null or length(btrim(phone)) between 1 and 30),
  address text check (address is null or length(btrim(address)) between 1 and 200),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clinics_name_idx on public.clinics (lower(btrim(name)));
create index clinics_created_by_idx on public.clinics (created_by);

create trigger clinics_set_updated_at
  before update on public.clinics
  for each row execute function public.set_updated_at();

alter table public.pets
  add column clinic_id uuid references public.clinics (id) on delete set null;
alter table public.vet_visits
  add column clinic_id uuid references public.clinics (id) on delete set null;

create index pets_clinic_idx on public.pets (clinic_id);
create index vet_visits_clinic_idx on public.vet_visits (clinic_id);

-- ---------------------------------------------------------------------------
-- Funções auxiliares (security definer evita recursão entre políticas)
-- ---------------------------------------------------------------------------
create function public.can_see_clinic(p_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (select 1 from public.clinics c
            where c.id = p_clinic_id and c.created_by = (select auth.uid()))
    or exists (select 1 from public.pets p
               join public.pet_members m on m.pet_id = p.id
               where p.clinic_id = p_clinic_id and m.user_id = (select auth.uid()))
    or exists (select 1 from public.vet_visits v
               join public.pet_members m on m.pet_id = v.pet_id
               where v.clinic_id = p_clinic_id and m.user_id = (select auth.uid()));
$$;

-- Editar nome/telefone/morada: quem a criou, ou o dono de um animal que a tem como habitual.
create function public.can_edit_clinic(p_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (select 1 from public.clinics c
            where c.id = p_clinic_id and c.created_by = (select auth.uid()))
    or exists (select 1 from public.pets p
               join public.pet_members m on m.pet_id = p.id
               where p.clinic_id = p_clinic_id
                 and m.user_id = (select auth.uid()) and m.role = 'owner');
$$;

revoke all on function public.can_see_clinic(uuid), public.can_edit_clinic(uuid)
  from public, anon;
grant execute on function public.can_see_clinic(uuid), public.can_edit_clinic(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- RLS e permissões
-- ---------------------------------------------------------------------------
alter table public.clinics enable row level security;

revoke all on public.clinics from anon, authenticated;
grant select, insert on public.clinics to authenticated;
grant update (name, phone, address) on public.clinics to authenticated;

create policy "clinics_select_visible" on public.clinics
  for select to authenticated
  using (created_by = (select auth.uid()) or public.can_see_clinic(id));

create policy "clinics_insert_self" on public.clinics
  for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "clinics_update_editor" on public.clinics
  for update to authenticated
  using (public.can_edit_clinic(id))
  with check (public.can_edit_clinic(id));

-- Sem DELETE: uma clínica nunca desaparece por engano (animais e consultas só perdem a ligação
-- se for apagada à mão). As que ficam sem ligações são limpas ao apagar a conta de quem as criou.

-- O dono muda a clínica habitual na ficha (a política «pets_update_owner» já o limita).
grant update (clinic_id) on public.pets to authenticated;

-- Quem tem o animal (ou a consulta) só pode apontar para uma clínica que vê: a FK ignora o RLS,
-- por isso sem este guarda bastava conhecer um uuid para «ver» a clínica de outra pessoa.
create function public.guard_clinic_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.clinic_id is not null
     and (tg_op = 'INSERT' or new.clinic_id is distinct from old.clinic_id)
     and not public.can_see_clinic(new.clinic_id) then
    raise exception 'Clínica não encontrada.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- A primeira clínica usada num animal passa a ser a habitual (mesmo que a consulta seja de um
-- cuidador, que não edita a ficha: por isso é security definer e só preenche se estiver vazia).
create function public.set_default_clinic()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.clinic_id is not null then
    update public.pets set clinic_id = new.clinic_id
    where id = new.pet_id and clinic_id is null;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_clinic_link(), public.set_default_clinic()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Dados existentes: uma clínica por nome distinto (sem distinguir maiúsculas) **e por autor**, com
-- o nome da clínica ou, se faltar, o do veterinário. Pessoas sem animais em comum nunca ficam com
-- a mesma linha (senão veriam e editariam o telefone e a morada umas das outras). Consultas sem
-- autor (conta apagada) agrupam-se por animal. A habitual de cada animal é a da consulta mais recente.
-- (Os guardas só são criados depois, para não interferirem com a migração.)
-- ---------------------------------------------------------------------------
create temp table clinic_backfill on commit drop as
select
  v.id as visit_id,
  v.created_by,
  v.created_at,
  left(btrim(coalesce(nullif(btrim(v.clinic), ''), nullif(btrim(v.vet_name), ''))), 80) as name,
  coalesce(v.created_by::text, 'pet:' || v.pet_id::text) as grp,
  gen_random_uuid() as new_id
from public.vet_visits v
where coalesce(nullif(btrim(v.clinic), ''), nullif(btrim(v.vet_name), '')) is not null;

-- Um id por (grupo, nome); a clínica fica do autor da consulta mais antiga desse grupo.
with ids as (
  select grp, lower(name) as k, (array_agg(new_id order by created_at))[1] as id
  from clinic_backfill group by grp, lower(name)
)
update clinic_backfill b set new_id = ids.id
from ids where ids.grp = b.grp and ids.k = lower(b.name);

insert into public.clinics (id, name, created_by)
select distinct on (new_id) new_id, name, created_by
from clinic_backfill
order by new_id, created_at;

update public.vet_visits v
set clinic_id = b.new_id
from clinic_backfill b
where b.visit_id = v.id;

update public.pets p
set clinic_id = (
  select v.clinic_id from public.vet_visits v
  where v.pet_id = p.id and v.clinic_id is not null
  order by v.visited_on desc, v.created_at desc
  limit 1
);

create trigger vet_visits_a_guard_clinic
  before insert or update of clinic_id on public.vet_visits
  for each row execute function public.guard_clinic_link();
create trigger pets_a_guard_clinic
  before insert or update of clinic_id on public.pets
  for each row execute function public.guard_clinic_link();
create trigger vet_visits_default_clinic
  after insert or update of clinic_id on public.vet_visits
  for each row execute function public.set_default_clinic();

-- O dono edita a consulta (clinic_id é editável como os restantes campos).
grant update (clinic_id) on public.vet_visits to authenticated;

-- ---------------------------------------------------------------------------
-- find_or_create_clinic(nome): reutiliza uma clínica que já vejo com o mesmo nome
-- (evita duplicados) ou cria uma nova. Devolve null se o nome estiver vazio.
-- ---------------------------------------------------------------------------
create function public.find_or_create_clinic(p_name text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
begin
  if v_name = '' then
    return null;
  end if;
  if length(v_name) > 80 then
    raise exception 'O nome da clínica é demasiado grande.' using errcode = '22023';
  end if;

  select c.id into v_id
  from public.clinics c
  where lower(btrim(c.name)) = lower(v_name)
  order by (c.created_by = (select auth.uid())) desc nulls last, c.created_at
  limit 1;

  if v_id is null then
    insert into public.clinics (name) values (v_name) returning id into v_id;
  end if;
  return v_id;
end;
$$;

revoke all on function public.find_or_create_clinic(text) from public, anon;
grant execute on function public.find_or_create_clinic(text) to authenticated;

-- ---------------------------------------------------------------------------
-- record_vet_visit: passa a aceitar "clinic_id" (clínica já conhecida) ou "clinic_name"
-- (nova, criada na mesma transação). "vet_name" e "clinic" deixam de ser gravados.
-- ---------------------------------------------------------------------------
create or replace function public.record_vet_visit(payload jsonb)
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
  v_clinic_id uuid;
  v_rows integer;
begin
  if v_pet_id is null then
    raise exception 'Falta o animal.' using errcode = '22023';
  end if;
  if not public.is_pet_member(v_pet_id) then
    raise exception 'Sem acesso a este animal.' using errcode = '42501';
  end if;

  v_clinic_id := coalesce(
    (payload ->> 'clinic_id')::uuid,
    public.find_or_create_clinic(payload ->> 'clinic_name')
  );

  insert into public.vet_visits (pet_id, visited_on, reason, clinic_id, notes)
  values (
    v_pet_id, v_date,
    nullif(btrim(payload ->> 'reason'), ''),
    v_clinic_id,
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
-- Apagar conta: as clínicas criadas pela pessoa e que já não estão ligadas a nenhum animal
-- ou consulta (depois de apagar os animais só dela) são removidas. As que ainda servem
-- outros animais ficam, sem autor.
-- ---------------------------------------------------------------------------
create or replace function public.delete_account(p_pet_ids uuid[] default '{}')
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

  -- Clínicas minhas que ficaram sem animais nem consultas.
  delete from public.clinics c
  where c.created_by = v_uid
    and not exists (select 1 from public.pets p where p.clinic_id = c.id)
    and not exists (select 1 from public.vet_visits v where v.clinic_id = c.id);

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
