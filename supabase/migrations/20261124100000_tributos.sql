-- Tributos: animais que faleceram.
--
--  * `pets.deceased_on` (+ `deceased_precision`: dia, mês ou ano) e `pets.tribute_text`.
--    Um animal falecido está sempre arquivado (por isso não gera lembretes, emails, feed .ics
--    nem aparece no «Hoje», que já ignoram os arquivados) e não conta para o limite de 30.
--  * `pet_memories`: memórias curtas dos membros (dono e cuidador), com foto opcional.
--    Cada pessoa edita e apaga as suas; o dono apaga qualquer uma.
--  * Storage: os membros podem carregar fotos de memórias em `fotos/{pet_id}/memorias/…` e
--    apagar as que carregaram (o dono já apaga tudo).

alter table public.pets
  add column deceased_on date,
  add column deceased_precision text not null default 'day'
    check (deceased_precision in ('day', 'month', 'year')),
  add column tribute_text text check (tribute_text is null or length(tribute_text) <= 1500),
  add constraint pets_deceased_is_archived
    check (deceased_on is null or archived_at is not null),
  add constraint pets_deceased_after_birth
    check (deceased_on is null or birth_date is null
           or extract(year from deceased_on) >= extract(year from birth_date));

grant update (deceased_on, deceased_precision, tribute_text) on public.pets to authenticated;

-- Limite de 30 animais ativos: um animal que já nasce arquivado («Em memória de…») não conta.
create or replace function public.guard_pet_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.archived_at is null and new.created_by is not null and (
    select count(*) from public.pet_members m
    join public.pets p on p.id = m.pet_id
    where m.user_id = new.created_by and m.role = 'owner' and p.archived_at is null
  ) >= 30 then
    raise exception 'pet_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create table public.pet_memories (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  body text not null check (length(btrim(body)) > 0 and length(body) <= 600),
  photo_path text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pet_memories_photo_in_pet
    check (photo_path is null or photo_path like pet_id::text || '/memorias/%')
);

create index pet_memories_pet_idx on public.pet_memories (pet_id, created_at);

create trigger pet_memories_set_updated_at
  before update on public.pet_memories
  for each row execute function public.set_updated_at();

alter table public.pet_memories enable row level security;

revoke all on public.pet_memories from anon, authenticated;
grant select, insert, delete on public.pet_memories to authenticated;
grant update (body, photo_path) on public.pet_memories to authenticated;

-- Só se deixam memórias de um animal que faleceu.
create function public.pet_is_deceased(p_pet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.pets where id = p_pet_id and deceased_on is not null);
$$;
revoke all on function public.pet_is_deceased(uuid) from public, anon;
grant execute on function public.pet_is_deceased(uuid) to authenticated;

create policy "pet_memories_select_member" on public.pet_memories
  for select to authenticated
  using (public.is_pet_member(pet_id));

create policy "pet_memories_insert_member" on public.pet_memories
  for insert to authenticated
  with check (
    public.is_pet_member(pet_id)
    and created_by = (select auth.uid())
    and public.pet_is_deceased(pet_id)
  );

create policy "pet_memories_update_author" on public.pet_memories
  for update to authenticated
  using (public.is_pet_member(pet_id) and created_by = (select auth.uid()))
  with check (public.is_pet_member(pet_id) and created_by = (select auth.uid()));

create policy "pet_memories_delete_author_or_owner" on public.pet_memories
  for delete to authenticated
  using (
    public.is_pet_owner(pet_id)
    or (public.is_pet_member(pet_id) and created_by = (select auth.uid()))
  );

-- Limites: 100 memórias por animal e 30 por hora por pessoa; armazenamento como os documentos.
create function public.guard_memory_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.pet_memories where pet_id = new.pet_id) >= 100 then
    raise exception 'memory_pet_limit' using errcode = 'P0001';
  end if;
  if new.created_by is not null then
    perform public.take_rate_limit(new.created_by, 'memory', array[interval '1 hour'], array[30]);
  end if;
  return new;
end;
$$;
create trigger pet_memories_limit before insert on public.pet_memories
  for each row execute function public.guard_memory_limit();

create trigger pet_memories_quota before insert on public.pet_memories
  for each row when (new.photo_path is not null)
  execute function public.guard_document_quota();

-- Storage: fotos das memórias.
create policy "fotos_insert_memoria_member" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fotos'
    and public.is_pet_member(public.storage_pet_id(name))
    and name like public.storage_pet_id(name)::text || '/memorias/%'
  );

create policy "fotos_delete_memoria_author" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'fotos'
    and name like public.storage_pet_id(name)::text || '/memorias/%'
    and owner_id = (select auth.uid())::text
  );
