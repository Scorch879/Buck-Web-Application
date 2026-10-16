-- SEC-018: profiles.email mirrors auth.users.email (kept in sync by
-- handle_user_profile_update, which runs without an end-user JWT). The owner
-- UPDATE policy let a signed-in user rewrite their own profiles.email, and the
-- password-reset lookup trusts that column. Pin it for end-user writes.
--
-- Down:
--   drop trigger if exists pin_profile_email on public.profiles;
--   drop function if exists public.pin_profile_email();

create or replace function public.pin_profile_email()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- auth.uid() is null for the auth-sync trigger and service-role writes.
  if (select auth.uid()) is not null and new.email is distinct from old.email then
    new.email = old.email;
  end if;
  return new;
end;
$$;

revoke execute on function public.pin_profile_email() from public, anon, authenticated;

drop trigger if exists pin_profile_email on public.profiles;
create trigger pin_profile_email
before update of email on public.profiles
for each row execute function public.pin_profile_email();
