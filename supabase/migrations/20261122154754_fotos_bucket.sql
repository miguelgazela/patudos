-- Fotos dos animais: bucket privado «fotos», caminho {pet_id}/{ficheiro}.
-- Membros leem; só o dono escreve e apaga. (As colunas de pets já existem:
-- color, birth_date, birth_date_is_estimate, photo_path, archived_at.)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Primeiro segmento do caminho como uuid; null se não for um uuid válido.
create function public.storage_pet_id(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(p_name, '/', 1)::uuid
    else null
  end;
$$;

grant execute on function public.storage_pet_id(text) to authenticated;

create policy "fotos_select_member" on storage.objects
  for select to authenticated
  using (bucket_id = 'fotos' and public.is_pet_member(public.storage_pet_id(name)));

create policy "fotos_insert_owner" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotos' and public.is_pet_owner(public.storage_pet_id(name)));

create policy "fotos_update_owner" on storage.objects
  for update to authenticated
  using (bucket_id = 'fotos' and public.is_pet_owner(public.storage_pet_id(name)))
  with check (bucket_id = 'fotos' and public.is_pet_owner(public.storage_pet_id(name)));

create policy "fotos_delete_owner" on storage.objects
  for delete to authenticated
  using (bucket_id = 'fotos' and public.is_pet_owner(public.storage_pet_id(name)));
