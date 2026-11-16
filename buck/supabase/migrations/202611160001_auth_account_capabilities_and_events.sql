-- Auth account capabilities RPCs and expanded auth_security_events constraints.
--
-- 1. public.get_auth_account_capabilities(p_email text): service_role-only helper
--    to inspect an account's confirmation status, identities (email vs google),
--    password presence, and verified WebAuthn/passkey credentials without
--    enumerating auth.users via listUsers().
-- 2. public.get_auth_user_capabilities(p_user_id uuid): same shape keyed by user id
--    for authenticated settings/callback checks.
-- 3. public.auth_security_events: allow 'sign_up' and 'resend_confirmation'
--    event_type values and 'blocked_provider' and 'already_exists' outcomes.
--
-- Down:
--   drop function if exists public.get_auth_user_capabilities(uuid);
--   drop function if exists public.get_auth_account_capabilities(text);
--   (restore the two auth_security_events check constraints from 202610240002)

begin;

create or replace function public.get_auth_account_capabilities(p_email text)
returns table (
  "exists" boolean,
  email_confirmed boolean,
  has_email_identity boolean,
  has_google_identity boolean,
  has_password boolean,
  has_passkey boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with target_user as (
    select u.id, u.email_confirmed_at, u.encrypted_password
    from auth.users u
    where p_email is not null
      and btrim(p_email) <> ''
      and lower(u.email) = lower(btrim(p_email))
      and u.deleted_at is null
    order by u.created_at asc
    limit 1
  )
  select
    exists(select 1 from target_user) as "exists",
    coalesce((select tu.email_confirmed_at is not null from target_user tu), false) as email_confirmed,
    exists(
      select 1
      from target_user tu
      join auth.identities i on i.user_id = tu.id
      where i.provider = 'email'
    ) as has_email_identity,
    exists(
      select 1
      from target_user tu
      join auth.identities i on i.user_id = tu.id
      where i.provider = 'google'
    ) as has_google_identity,
    coalesce((select coalesce(tu.encrypted_password, '') <> '' from target_user tu), false) as has_password,
    (
      exists(
        select 1
        from target_user tu
        join auth.mfa_factors f on f.user_id = tu.id
        where f.status = 'verified'
          and f.factor_type = 'webauthn'
      )
      or exists(
        select 1
        from target_user tu
        join auth.webauthn_credentials w on w.user_id = tu.id
      )
    ) as has_passkey;
$$;

comment on function public.get_auth_account_capabilities(text) is
  'Service-role helper returning provider, password, confirmation, and passkey capabilities for an email.';

revoke execute on function public.get_auth_account_capabilities(text) from public, anon, authenticated;
grant execute on function public.get_auth_account_capabilities(text) to service_role;

create or replace function public.get_auth_user_capabilities(p_user_id uuid)
returns table (
  "exists" boolean,
  email_confirmed boolean,
  has_email_identity boolean,
  has_google_identity boolean,
  has_password boolean,
  has_passkey boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with target_user as (
    select u.id, u.email_confirmed_at, u.encrypted_password
    from auth.users u
    where p_user_id is not null
      and u.id = p_user_id
      and u.deleted_at is null
    limit 1
  )
  select
    exists(select 1 from target_user) as "exists",
    coalesce((select tu.email_confirmed_at is not null from target_user tu), false) as email_confirmed,
    exists(
      select 1
      from target_user tu
      join auth.identities i on i.user_id = tu.id
      where i.provider = 'email'
    ) as has_email_identity,
    exists(
      select 1
      from target_user tu
      join auth.identities i on i.user_id = tu.id
      where i.provider = 'google'
    ) as has_google_identity,
    coalesce((select coalesce(tu.encrypted_password, '') <> '' from target_user tu), false) as has_password,
    (
      exists(
        select 1
        from target_user tu
        join auth.mfa_factors f on f.user_id = tu.id
        where f.status = 'verified'
          and f.factor_type = 'webauthn'
      )
      or exists(
        select 1
        from target_user tu
        join auth.webauthn_credentials w on w.user_id = tu.id
      )
    ) as has_passkey;
$$;

comment on function public.get_auth_user_capabilities(uuid) is
  'Service-role helper returning provider, password, confirmation, and passkey capabilities for a user id.';

revoke execute on function public.get_auth_user_capabilities(uuid) from public, anon, authenticated;
grant execute on function public.get_auth_user_capabilities(uuid) to service_role;

alter table public.auth_security_events
  drop constraint if exists auth_security_events_event_type_check;

alter table public.auth_security_events
  add constraint auth_security_events_event_type_check
  check (
    event_type in (
      'password_reset',
      'sign_up',
      'resend_confirmation',
      'mfa_recovery_code',
      'mfa_recovery_codes_generated',
      'mfa_email_recovery',
      'mfa_reset_admin'
    )
  );

alter table public.auth_security_events
  drop constraint if exists auth_security_events_outcome_check;

alter table public.auth_security_events
  add constraint auth_security_events_outcome_check
  check (
    outcome in (
      'sent',
      'not_found',
      'rate_limited',
      'provider_error',
      'lookup_error',
      'success',
      'invalid',
      'expired',
      'confirmed',
      'canceled',
      'blocked_provider',
      'already_exists'
    )
  );

commit;
