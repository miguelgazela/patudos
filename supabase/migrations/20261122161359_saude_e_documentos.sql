-- Saúde (consultas, pesos, eventos, medicação), presets de cuidados e documentos.
-- Acesso sempre por animal (pet_members). Ler: membros. Criar: dono e cuidador.
-- Editar/apagar: o dono qualquer registo do animal; o cuidador só os que criou.

-- Pode editar/apagar um registo deste animal criado por p_created_by?
create function public.can_edit_pet_record(p_pet_id uuid, p_created_by uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_pet_owner(p_pet_id)
    or (public.is_pet_member(p_pet_id) and p_created_by = (select auth.uid()));
$$;

revoke all on function public.can_edit_pet_record(uuid, uuid) from public, anon;
grant execute on function public.can_edit_pet_record(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- care_presets: modelos de vacinas/desparasitações (só leitura para a app)
-- ---------------------------------------------------------------------------
create table public.care_presets (
  id uuid primary key default gen_random_uuid(),
  species text not null check (species in ('dog', 'cat')),
  type text not null check (type in ('vaccine', 'deworming_internal', 'deworming_external')),
  name text not null check (length(btrim(name)) > 0),
  description text,
  interval_months integer not null check (interval_months > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (species, name)
);

alter table public.care_presets enable row level security;
revoke all on public.care_presets from anon, authenticated;
grant select on public.care_presets to authenticated;

create policy "care_presets_select_authenticated" on public.care_presets
  for select to authenticated using (true);

insert into public.care_presets (species, type, name, description, interval_months, sort_order) values
  ('dog', 'vaccine', 'Antirrábica', 'Raiva', 12, 10),
  ('dog', 'vaccine', 'Polivalente', 'Esgana, parvovirose, hepatite e leptospirose', 12, 20),
  ('dog', 'vaccine', 'Tosse do canil', null, 12, 30),
  ('dog', 'vaccine', 'Leishmaniose', null, 12, 40),
  ('dog', 'deworming_internal', 'Desparasitação interna', 'Comprimido ou pasta', 3, 50),
  ('dog', 'deworming_external', 'Desparasitação externa', 'Pipeta, coleira ou comprimido', 1, 60),
  ('cat', 'vaccine', 'Trivalente', 'Panleucopenia, calicivírus e herpesvírus', 12, 10),
  ('cat', 'vaccine', 'Leucemia felina (FeLV)', null, 12, 20),
  ('cat', 'vaccine', 'Antirrábica', 'Raiva', 12, 30),
  ('cat', 'deworming_internal', 'Desparasitação interna', 'Comprimido ou pasta', 3, 40),
  ('cat', 'deworming_external', 'Desparasitação externa', 'Pipeta, coleira ou comprimido', 1, 50);

-- ---------------------------------------------------------------------------
-- vet_visits
-- ---------------------------------------------------------------------------
create table public.vet_visits (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  visited_on date not null default ((now() at time zone 'Europe/Lisbon')::date),
  reason text check (reason is null or length(btrim(reason)) > 0),
  vet_name text,
  clinic text,
  notes text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, pet_id)
);

create index vet_visits_pet_idx on public.vet_visits (pet_id, visited_on desc);

-- ---------------------------------------------------------------------------
-- weights
-- ---------------------------------------------------------------------------
create table public.weights (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  measured_on date not null default ((now() at time zone 'Europe/Lisbon')::date),
  weight_kg numeric(6, 2) not null check (weight_kg > 0 and weight_kg < 1000),
  vet_visit_id uuid,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (vet_visit_id, pet_id) references public.vet_visits (id, pet_id)
    on delete set null (vet_visit_id)
);

create index weights_pet_idx on public.weights (pet_id, measured_on desc);
create index weights_visit_idx on public.weights (vet_visit_id);

-- ---------------------------------------------------------------------------
-- health_events
-- ---------------------------------------------------------------------------
create table public.health_events (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  type text not null check (type in
    ('vaccine', 'deworming_internal', 'deworming_external', 'surgery', 'lab_test', 'other')),
  occurred_on date not null default ((now() at time zone 'Europe/Lisbon')::date),
  title text not null check (length(btrim(title)) > 0),
  product text,
  preset_id uuid references public.care_presets (id) on delete set null,
  notes text,
  next_due_on date,
  remind boolean not null default true,
  vet_visit_id uuid,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (next_due_on is null or next_due_on >= occurred_on),
  foreign key (vet_visit_id, pet_id) references public.vet_visits (id, pet_id)
    on delete set null (vet_visit_id)
);

create index health_events_pet_idx on public.health_events (pet_id, occurred_on desc);
create index health_events_due_idx on public.health_events (pet_id, next_due_on)
  where next_due_on is not null;
create index health_events_visit_idx on public.health_events (vet_visit_id);

-- ---------------------------------------------------------------------------
-- medications
-- ---------------------------------------------------------------------------
create table public.medications (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  dose text,
  schedule_rrule text,
  starts_on date not null default ((now() at time zone 'Europe/Lisbon')::date),
  ends_on date,
  notes text,
  remind boolean not null default true,
  vet_visit_id uuid,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on),
  foreign key (vet_visit_id, pet_id) references public.vet_visits (id, pet_id)
    on delete set null (vet_visit_id)
);

create index medications_pet_idx on public.medications (pet_id, starts_on desc);
create index medications_visit_idx on public.medications (vet_visit_id);

-- ---------------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  kind text not null check (kind in ('invoice', 'health_record', 'insurance', 'microchip', 'other')),
  title text not null check (length(btrim(title)) > 0),
  storage_path text not null,
  mime_type text,
  document_date date,
  vet_visit_id uuid,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- O ficheiro tem de estar na pasta do próprio animal: {pet_id}/{ficheiro}
  check (storage_path like pet_id::text || '/_%'),
  foreign key (vet_visit_id, pet_id) references public.vet_visits (id, pet_id)
    on delete set null (vet_visit_id)
);

create index documents_pet_idx on public.documents (pet_id, created_at desc);
create index documents_visit_idx on public.documents (vet_visit_id);

-- updated_at
create trigger vet_visits_set_updated_at before update on public.vet_visits
  for each row execute function public.set_updated_at();
create trigger weights_set_updated_at before update on public.weights
  for each row execute function public.set_updated_at();
create trigger health_events_set_updated_at before update on public.health_events
  for each row execute function public.set_updated_at();
create trigger medications_set_updated_at before update on public.medications
  for each row execute function public.set_updated_at();
create trigger documents_set_updated_at before update on public.documents
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS + permissões (pet_id, created_by e created_at ficam fora do UPDATE)
-- ---------------------------------------------------------------------------
alter table public.vet_visits enable row level security;
alter table public.weights enable row level security;
alter table public.health_events enable row level security;
alter table public.medications enable row level security;
alter table public.documents enable row level security;

revoke all on public.vet_visits, public.weights, public.health_events,
  public.medications, public.documents from anon, authenticated;

grant select, insert, delete on public.vet_visits, public.weights, public.health_events,
  public.medications, public.documents to authenticated;

grant update (visited_on, reason, vet_name, clinic, notes) on public.vet_visits to authenticated;
grant update (measured_on, weight_kg, vet_visit_id) on public.weights to authenticated;
grant update (type, occurred_on, title, product, preset_id, notes, next_due_on, remind, vet_visit_id)
  on public.health_events to authenticated;
grant update (name, dose, schedule_rrule, starts_on, ends_on, notes, remind, vet_visit_id)
  on public.medications to authenticated;
grant update (kind, title, document_date, vet_visit_id) on public.documents to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['vet_visits', 'weights', 'health_events', 'medications', 'documents']
  loop
    execute format($f$
      create policy "%1$s_select_member" on public.%1$s
        for select to authenticated
        using (public.is_pet_member(pet_id))
    $f$, t);
    execute format($f$
      create policy "%1$s_insert_member" on public.%1$s
        for insert to authenticated
        with check (public.is_pet_member(pet_id) and created_by = (select auth.uid()))
    $f$, t);
    execute format($f$
      create policy "%1$s_update_owner_or_creator" on public.%1$s
        for update to authenticated
        using (public.can_edit_pet_record(pet_id, created_by))
        with check (public.can_edit_pet_record(pet_id, created_by))
    $f$, t);
    execute format($f$
      create policy "%1$s_delete_owner_or_creator" on public.%1$s
        for delete to authenticated
        using (public.can_edit_pet_record(pet_id, created_by))
    $f$, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Bucket privado «documentos», caminho {pet_id}/{ficheiro}.
-- Membros leem e carregam; apaga/altera o dono ou quem carregou.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "documentos_select_member" on storage.objects
  for select to authenticated
  using (bucket_id = 'documentos' and public.is_pet_member(public.storage_pet_id(name)));

create policy "documentos_insert_member" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documentos' and public.is_pet_member(public.storage_pet_id(name)));

create policy "documentos_update_owner_or_uploader" on storage.objects
  for update to authenticated
  using (bucket_id = 'documentos'
         and public.can_edit_pet_record(public.storage_pet_id(name), owner))
  with check (bucket_id = 'documentos'
              and public.can_edit_pet_record(public.storage_pet_id(name), owner));

create policy "documentos_delete_owner_or_uploader" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documentos'
         and public.can_edit_pet_record(public.storage_pet_id(name), owner));
