-- Anular um tributo («Afinal não faleceu»): as memórias apagam-se com ele.
-- Quando `deceased_on` passa a nulo, as memórias do animal saem. A app apaga as fotos do Storage
-- antes (o Storage não se apaga por SQL).

create function public.drop_memories_when_not_deceased()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.pet_memories where pet_id = new.id;
  return new;
end;
$$;

create trigger pets_drop_memories
  after update of deceased_on on public.pets
  for each row
  when (old.deceased_on is not null and new.deceased_on is null)
  execute function public.drop_memories_when_not_deceased();
