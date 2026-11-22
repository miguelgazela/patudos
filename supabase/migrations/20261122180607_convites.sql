-- Convites para cuidar de um animal (Fase 2).
-- O dono convida por email; quem entra com esse email (código OTP) aceita automaticamente.

create table public.pet_invites (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and position('@' in email) > 1),
  role text not null default 'caregiver' check (role in ('owner', 'caregiver')),
  invited_by uuid default auth.uid() references public.profiles (id) on delete set null,
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);

-- No máximo um convite pendente por animal e email (o reenvio reaproveita-o).
create unique index pet_invites_pending_idx
  on public.pet_invites (pet_id, email)
  where accepted_at is null and cancelled_at is null;
create index pet_invites_email_idx on public.pet_invites (email);

alter table public.pet_invites enable row level security;

revoke all on public.pet_invites from anon, authenticated;
grant select on public.pet_invites to authenticated;
grant update (cancelled_at) on public.pet_invites to authenticated;

-- O dono vê todos os convites do animal; o convidado vê os seus pendentes e válidos (email do JWT).
create policy "pet_invites_select_owner" on public.pet_invites
  for select to authenticated
  using (public.is_pet_owner(pet_id));

create policy "pet_invites_select_invitee" on public.pet_invites
  for select to authenticated
  using (
    email = lower(coalesce((select auth.jwt()) ->> 'email', ''))
    and accepted_at is null and cancelled_at is null and expires_at > now()
  );

-- O dono cancela convites ainda não aceites.
create policy "pet_invites_cancel_owner" on public.pet_invites
  for update to authenticated
  using (public.is_pet_owner(pet_id) and accepted_at is null)
  with check (public.is_pet_owner(pet_id));

-- Criar / reenviar convite. Só o dono; recusa quem já é membro; reaproveita o pendente
-- (atualiza papel e validade). Devolve o id do convite.
create function public.invite_to_pet(p_pet_id uuid, p_email text, p_role text default 'caregiver')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_id uuid;
begin
  if not public.is_pet_owner(p_pet_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_role not in ('owner', 'caregiver') then
    raise exception 'invalid_role' using errcode = '22023';
  end if;
  if position('@' in v_email) <= 1 then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  if exists (
    select 1
    from public.pet_members m
    join public.profiles p on p.id = m.user_id
    where m.pet_id = p_pet_id and lower(p.email) = v_email
  ) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;

  insert into public.pet_invites (pet_id, email, role, invited_by)
  values (p_pet_id, v_email, p_role, (select auth.uid()))
  on conflict (pet_id, email) where accepted_at is null and cancelled_at is null
  do update set role = excluded.role,
                expires_at = now() + interval '14 days',
                invited_by = excluded.invited_by
  returning id into v_id;

  return v_id;
end;
$$;

-- Aceita todos os convites pendentes e válidos para o email verificado de quem tem sessão.
-- Devolve os animais a que passou a ter acesso.
create function public.accept_pet_invites()
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
  v_invite record;
begin
  if v_uid is null or v_email = '' then
    return;
  end if;

  for v_invite in
    select id, pet_id, role
    from public.pet_invites
    where email = v_email
      and accepted_at is null and cancelled_at is null and expires_at > now()
    order by created_at
    for update
  loop
    -- Quem já é membro mantém o papel que tem; o convite fica só como aceite.
    insert into public.pet_members (pet_id, user_id, role)
    values (v_invite.pet_id, v_uid, v_invite.role)
    on conflict (pet_id, user_id) do nothing;

    update public.pet_invites set accepted_at = now() where id = v_invite.id;
    return next v_invite.pet_id;
  end loop;
end;
$$;

revoke all on function public.invite_to_pet(uuid, text, text), public.accept_pet_invites() from public, anon;
grant execute on function public.invite_to_pet(uuid, text, text), public.accept_pet_invites() to authenticated;
