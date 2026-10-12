-- Admin RLS on public.feedback: switch from a hardcoded e-mail comparison to the
-- server-managed `app_metadata.role = 'admin'` JWT claim (BUG-005). Users cannot
-- edit app_metadata, so the claim cannot be self-assigned.
--
-- REQUIRED before/with this migration: grant the claim to each admin account, then
-- have that admin sign in again (the claim is read from the JWT, which refreshes
-- within an hour):
--   update auth.users
--      set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
--    where lower(email) = lower('<ADMIN_EMAIL value>');
--
-- Down: re-create the three policies from 202606140001_security_and_policy_hardening.sql
--       (they compared (select auth.jwt()) ->> 'email' to the admin address).

drop policy if exists "Admin can view feedback" on public.feedback;
drop policy if exists "Admin can update feedback" on public.feedback;
drop policy if exists "Admin can delete feedback" on public.feedback;

create policy "Admin can view feedback"
  on public.feedback
  for select
  to authenticated
  using ((((select auth.jwt()) -> 'app_metadata') ->> 'role') = 'admin');

create policy "Admin can update feedback"
  on public.feedback
  for update
  to authenticated
  using ((((select auth.jwt()) -> 'app_metadata') ->> 'role') = 'admin')
  with check ((((select auth.jwt()) -> 'app_metadata') ->> 'role') = 'admin');

create policy "Admin can delete feedback"
  on public.feedback
  for delete
  to authenticated
  using ((((select auth.jwt()) -> 'app_metadata') ->> 'role') = 'admin');
