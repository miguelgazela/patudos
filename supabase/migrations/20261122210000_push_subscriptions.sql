-- Fase 3, passo 2: subscrições de web push (uma por browser/dispositivo de cada utilizador).
--
-- Cada utilizador só vê e apaga as suas. Guardar passa por `save_push_subscription`
-- (security definer): o mesmo browser pode mudar de conta, e nesse caso a subscrição
-- (endpoint único) passa para o utilizador atual em vez de falhar por RLS.
-- O envio (Edge Function, service_role) lê todas e apaga as que o serviço de push dá como mortas.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%' or endpoint like 'http://%'),
  p256dh text not null check (length(p256dh) > 0),
  auth text not null check (length(auth) > 0),
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

revoke all on public.push_subscriptions from anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;

create policy "push_subscriptions_select_own" on public.push_subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "push_subscriptions_delete_own" on public.push_subscriptions
  for delete to authenticated
  using (user_id = (select auth.uid()));

create function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Sem sessão.' using errcode = '42501';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (v_uid, btrim(p_endpoint), btrim(p_p256dh), btrim(p_auth), left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
