-- Connected apps via the Supabase OAuth 2.1 server (ADR-049).
--
-- An OAuth access token looks like a normal session token plus a `client_id`
-- claim, and Supabase gives it the same data access as the user. Buck narrows
-- that down:
--
-- 1. Read-only. RESTRICTIVE insert/update/delete policies reject any token
--    with a client_id, on every user table and on avatar files. All write
--    RPCs are SECURITY INVOKER, so they are covered too.
-- 2. 2FA-approved. Supabase's consent endpoint accepts an aal1 session, so a
--    password-only attacker could approve an app for a 2FA user. Buck's own
--    consent route (/api/oauth/authorizations/[id]/consent) approves only from
--    a session that passed 2FA and records the consent here. For a user with
--    2FA on, an app's token sees data only while that recorded consent is the
--    active one. Users without 2FA are unaffected.
--
-- private.mfa_satisfied() keeps its rule for normal sessions
-- (aal2 OR no verified factor) and adds the connected-app branch.
--
-- Down:
--   drop policy if exists "<table>: apps read-only (insert|update|delete)" on public.<table>;
--   drop policy if exists "Avatar files: apps read-only (insert|update|delete)" on storage.objects;
--   create or replace function private.mfa_satisfied() ... (202610240002 body)
--   drop trigger if exists buck_forget_oauth_app_grant on auth.oauth_consents;
--   drop function if exists private.forget_oauth_app_grant();
--   drop function if exists public.get_oauth_app_registration(uuid);
--   drop function if exists public.record_oauth_app_grant(uuid, uuid, boolean);
--   drop function if exists private.is_oauth_app();
--   drop table if exists public.oauth_app_grants;

begin;

-- 1. Consents approved through Buck's consent route ------------------------------

create table if not exists public.oauth_app_grants (
  consent_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null,
  mfa_verified boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists oauth_app_grants_user_client_idx
  on public.oauth_app_grants(user_id, client_id);

alter table public.oauth_app_grants enable row level security;
revoke all on public.oauth_app_grants from anon, authenticated;

drop policy if exists "Service role manages oauth app grants" on public.oauth_app_grants;
create policy "Service role manages oauth app grants"
  on public.oauth_app_grants
  for all
  to service_role
  using (true)
  with check (true);

-- Called by the consent route right after Supabase approved the request. It
-- looks up the consent Supabase just stored, so the grant is tied to that exact
-- consent: revoking and re-approving elsewhere creates a new, unrecorded one.
create or replace function public.record_oauth_app_grant(
  p_user_id uuid,
  p_client_id uuid,
  p_mfa_verified boolean
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_consent_id uuid;
begin
  select c.id
    into v_consent_id
    from auth.oauth_consents c
   where c.user_id = p_user_id
     and c.client_id = p_client_id
     and c.revoked_at is null
   order by c.granted_at desc
   limit 1;

  if v_consent_id is null then
    raise exception 'No active consent for this app.' using errcode = 'P0002';
  end if;

  insert into public.oauth_app_grants (consent_id, user_id, client_id, mfa_verified)
  values (v_consent_id, p_user_id, p_client_id, p_mfa_verified)
  on conflict (consent_id) do update
    set mfa_verified = public.oauth_app_grants.mfa_verified or excluded.mfa_verified;

  return v_consent_id;
end;
$$;

revoke execute on function public.record_oauth_app_grant(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.record_oauth_app_grant(uuid, uuid, boolean) to service_role;

-- The consent screen warns about apps that registered themselves (dynamic
-- registration, used by MCP / AI clients) instead of being added by Buck.
create or replace function public.get_oauth_app_registration(p_client_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select c.registration_type::text
  from auth.oauth_clients c
  where c.id = p_client_id
    and c.deleted_at is null;
$$;

revoke execute on function public.get_oauth_app_registration(uuid) from public, anon, authenticated;
grant execute on function public.get_oauth_app_registration(uuid) to service_role;

-- auth.oauth_consents keeps one row per (user, app): revoking and re-approving
-- updates that row instead of adding one. Any change to it (revoke, re-approve,
-- new scopes) or its deletion drops Buck's record, so only an approval made
-- through the consent route, which records again afterwards, counts.
create or replace function private.forget_oauth_app_grant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.oauth_app_grants where consent_id = old.id;
  return null;
end;
$$;

revoke execute on function private.forget_oauth_app_grant() from public, anon, authenticated;

drop trigger if exists buck_forget_oauth_app_grant on auth.oauth_consents;
create trigger buck_forget_oauth_app_grant
  after update or delete on auth.oauth_consents
  for each row
  execute function private.forget_oauth_app_grant();

-- 2. Connected-app helpers and the 2FA rule ---------------------------------------

create or replace function private.is_oauth_app()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'client_id', '') <> '';
$$;

comment on function private.is_oauth_app() is
  'True when the caller is a connected app (OAuth access token with a client_id claim).';

revoke execute on function private.is_oauth_app() from public, anon;
grant execute on function private.is_oauth_app() to authenticated, service_role;

create or replace function private.mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    not exists (
      select 1
      from auth.mfa_factors f
      where f.user_id = auth.uid()
        and f.status = 'verified'
    )
    or case
      when coalesce(auth.jwt() ->> 'client_id', '') = '' then
        coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      else exists (
        select 1
        from public.oauth_app_grants g
        join auth.oauth_consents c on c.id = g.consent_id
        where g.user_id = auth.uid()
          and g.mfa_verified
          and c.user_id = auth.uid()
          and c.client_id::text = auth.jwt() ->> 'client_id'
          and c.revoked_at is null
      )
    end;
$$;

comment on function private.mfa_satisfied() is
  'True when the caller has no verified MFA factor, or is an aal2 session, or is a connected app whose active consent was approved after 2FA. Used by restrictive RLS policies.';

-- 3. Connected apps are read-only --------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'account_deletion_requests',
    'ai_advisories',
    'ai_forecasts',
    'ai_usage_events',
    'categories',
    'expenses',
    'feedback',
    'goals',
    'incomes',
    'profiles',
    'wallets'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || ': apps read-only (insert)', t);
    execute format('drop policy if exists %I on public.%I', t || ': apps read-only (update)', t);
    execute format('drop policy if exists %I on public.%I', t || ': apps read-only (delete)', t);
    execute format(
      'create policy %I on public.%I as restrictive for insert to authenticated '
      'with check (not (select private.is_oauth_app()))',
      t || ': apps read-only (insert)', t
    );
    execute format(
      'create policy %I on public.%I as restrictive for update to authenticated '
      'using (not (select private.is_oauth_app())) with check (not (select private.is_oauth_app()))',
      t || ': apps read-only (update)', t
    );
    execute format(
      'create policy %I on public.%I as restrictive for delete to authenticated '
      'using (not (select private.is_oauth_app()))',
      t || ': apps read-only (delete)', t
    );
  end loop;
end;
$$;

drop policy if exists "Avatar files: apps read-only (insert)" on storage.objects;
drop policy if exists "Avatar files: apps read-only (update)" on storage.objects;
drop policy if exists "Avatar files: apps read-only (delete)" on storage.objects;

create policy "Avatar files: apps read-only (insert)"
  on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'profile-avatars' or not (select private.is_oauth_app()));

create policy "Avatar files: apps read-only (update)"
  on storage.objects as restrictive for update to authenticated
  using (bucket_id <> 'profile-avatars' or not (select private.is_oauth_app()))
  with check (bucket_id <> 'profile-avatars' or not (select private.is_oauth_app()));

create policy "Avatar files: apps read-only (delete)"
  on storage.objects as restrictive for delete to authenticated
  using (bucket_id <> 'profile-avatars' or not (select private.is_oauth_app()));

commit;
