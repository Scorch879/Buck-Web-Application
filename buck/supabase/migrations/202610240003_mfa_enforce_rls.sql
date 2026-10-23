-- Kernel-level 2FA enforcement (ADR-048).
--
-- A RESTRICTIVE policy is ANDed with the existing owner policies, so a
-- session of a user with a verified authenticator sees and writes nothing
-- until it is aal2. Users without 2FA are unaffected (private.mfa_satisfied()
-- is true for them). This covers every client at once: web, the Flutter app,
-- Buck_AI (which queries as the user), Realtime and the SECURITY INVOKER RPCs
-- (add_expense_atomic, add_income_atomic, transfer_funds_atomic, ...).
--
-- service_role and the SECURITY DEFINER triggers are not affected.
-- `(select ...)` makes Postgres evaluate the function once per statement.
--
-- Down:
--   drop policy if exists "<table>: 2FA required" on public.<table>;  (each table below)
--   drop policy if exists "Avatar files: 2FA required" on storage.objects;

begin;

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
    execute format('drop policy if exists %I on public.%I', t || ': 2FA required', t);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated '
      'using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()))',
      t || ': 2FA required',
      t
    );
  end loop;
end;
$$;

-- Storage holds only avatars today; other buckets are left as they are.
drop policy if exists "Avatar files: 2FA required" on storage.objects;
create policy "Avatar files: 2FA required"
  on storage.objects
  as restrictive
  for all
  to authenticated
  using (bucket_id <> 'profile-avatars' or (select private.mfa_satisfied()))
  with check (bucket_id <> 'profile-avatars' or (select private.mfa_satisfied()));

commit;
