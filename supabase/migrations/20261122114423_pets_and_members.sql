-- Animais e membros. O acesso é sempre por animal, através de pet_members.

create table public.pets (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  species text not null check (species in ('dog', 'cat')),
  breed text,
  sex text check (sex in ('female', 'male')),
  birth_date date,
  birth_date_is_estimate boolean not null default false,
  neutered boolean,
  microchip text,
  photo_path text,
  color text not null default 'laranja'
    check (color in ('laranja', 'azul', 'uva', 'framboesa', 'relva', 'mar', 'mel', 'ardosia')),
  notes text,
  archived_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pet_members (
  pet_id uuid not null references public.pets (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'caregiver')),
  notify boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (pet_id, user_id)
);

create index pet_members_user_id_idx on public.pet_members (user_id);

alter table public.pets enable row level security;
alter table public.pet_members enable row level security;

-- Funções auxiliares (security definer evita recursão nas políticas).
create function public.is_pet_member(p_pet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pet_members
    where pet_id = p_pet_id and user_id = (select auth.uid())
  );
$$;

create function public.is_pet_owner(p_pet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pet_members
    where pet_id = p_pet_id and user_id = (select auth.uid()) and role = 'owner'
  );
$$;

-- Partilho pelo menos um animal com este utilizador?
create function public.shares_pet_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.pet_members me
    join public.pet_members other on other.pet_id = me.pet_id
    where me.user_id = (select auth.uid()) and other.user_id = p_user_id
  );
$$;

revoke all on function public.is_pet_member(uuid), public.is_pet_owner(uuid), public.shares_pet_with(uuid) from public, anon;
grant execute on function public.is_pet_member(uuid), public.is_pet_owner(uuid), public.shares_pet_with(uuid) to authenticated;

-- updated_at
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger pets_set_updated_at
  before update on public.pets
  for each row execute function public.set_updated_at();

-- Quem cria o animal fica dono.
create function public.add_creator_as_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.pet_members (pet_id, user_id, role)
    values (new.id, new.created_by, 'owner');
  end if;
  return new;
end;
$$;

create trigger pets_add_creator_as_owner
  after insert on public.pets
  for each row execute function public.add_creator_as_owner();

-- Um animal nunca fica sem dono; só donos mudam papéis.
create function public.guard_pet_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.role is distinct from old.role
     and not public.is_pet_owner(old.pet_id) then
    raise exception 'Só o dono pode alterar papéis.' using errcode = '42501';
  end if;

  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    -- Bloqueia o animal para serializar remoções/despromoções concorrentes.
    -- Se o animal já não existe (remoção em cascata), não há nada a proteger.
    perform 1 from public.pets where id = old.pet_id for update;
    if found and not exists (
      select 1 from public.pet_members
      where pet_id = old.pet_id and role = 'owner' and user_id <> old.user_id
    ) then
      raise exception 'O animal tem de ter pelo menos um dono.' using errcode = 'P0001';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger pet_members_guard
  before update or delete on public.pet_members
  for each row execute function public.guard_pet_members();

-- Permissões (colunas imutáveis ficam de fora do UPDATE).
revoke all on public.pets, public.pet_members from anon, authenticated;
grant select, insert on public.pets to authenticated;
grant update (name, species, breed, sex, birth_date, birth_date_is_estimate, neutered,
              microchip, photo_path, color, notes, archived_at) on public.pets to authenticated;
grant select, insert, delete on public.pet_members to authenticated;
grant update (role, notify) on public.pet_members to authenticated;

-- pets
create policy "pets_select_member" on public.pets
  for select to authenticated
  using (public.is_pet_member(id) or created_by = (select auth.uid()));

create policy "pets_insert_authenticated" on public.pets
  for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "pets_update_owner" on public.pets
  for update to authenticated
  using (public.is_pet_owner(id))
  with check (public.is_pet_owner(id));

-- pet_members
create policy "pet_members_select_member" on public.pet_members
  for select to authenticated
  using (public.is_pet_member(pet_id));

create policy "pet_members_insert_owner" on public.pet_members
  for insert to authenticated
  with check (public.is_pet_owner(pet_id));

-- O dono gere tudo; cada membro pode alterar o seu próprio «notify» (o papel é protegido pelo trigger).
create policy "pet_members_update_owner_or_self" on public.pet_members
  for update to authenticated
  using (public.is_pet_owner(pet_id) or user_id = (select auth.uid()))
  with check (public.is_pet_owner(pet_id) or user_id = (select auth.uid()));

-- O dono remove membros; qualquer membro pode sair («Deixar de cuidar»).
create policy "pet_members_delete_owner_or_self" on public.pet_members
  for delete to authenticated
  using (public.is_pet_owner(pet_id) or user_id = (select auth.uid()));

-- profiles: ver quem partilha animais comigo
create policy "profiles_select_shared" on public.profiles
  for select to authenticated
  using (public.shares_pet_with(id));
