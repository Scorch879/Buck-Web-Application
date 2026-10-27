-- Disconnect stops a connected app at once, everywhere (ADR-049, QA SEC-041).
--
-- Disconnecting an app deletes its Supabase Auth session, so refresh fails
-- and Buck's MCP server (which asks Supabase Auth) refuses the token. But
-- PostgREST only checks the JWT signature and expiry, so an app calling the
-- Supabase REST API directly could keep reading with its last access token
-- until it expired.
--
-- private.app_session_live() is true for every non-app caller, and for an app
-- only while the auth session named in its token still exists for that user
-- and client. A RESTRICTIVE policy ANDs it with the owner and 2FA policies.
-- `(select ...)` makes Postgres evaluate it once per statement.
--
-- Down:
--   drop policy if exists "<table>: apps need a live session" on public.<table>;  (each table below)
--   drop policy if exists "Avatar files: apps need a live session" on storage.objects;
--   drop function if exists private.app_session_live();

begin;

create or replace function private.app_session_live()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    not private.is_oauth_app()
    or exists (
      select 1
      from auth.sessions s
      where s.user_id = auth.uid()
        and s.id::text = auth.jwt() ->> 'session_id'
        and s.oauth_client_id::text = auth.jwt() ->> 'client_id'
        and (s.not_after is null or s.not_after > now())
    );
$$;

comment on function private.app_session_live() is
  'True for non-app callers, and for a connected app only while its Supabase Auth session still exists (it is deleted on disconnect). Used by restrictive RLS policies (SEC-041).';

revoke execute on function private.app_session_live() from public, anon;
grant execute on function private.app_session_live() to authenticated, service_role;

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
    execute format('drop policy if exists %I on public.%I', t || ': apps need a live session', t);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated '
      'using ((select private.app_session_live())) with check ((select private.app_session_live()))',
      t || ': apps need a live session',
      t
    );
  end loop;
end;
$$;

drop policy if exists "Avatar files: apps need a live session" on storage.objects;
create policy "Avatar files: apps need a live session"
  on storage.objects
  as restrictive
  for all
  to authenticated
  using (bucket_id <> 'profile-avatars' or (select private.app_session_live()))
  with check (bucket_id <> 'profile-avatars' or (select private.app_session_live()));

commit;
