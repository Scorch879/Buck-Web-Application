-- Optional two-factor authentication (ADR-048): backend tables and the rule.
--
-- 1. private.mfa_satisfied(): the single "2FA passed" rule shared by RLS
--    (202610240003_mfa_enforce_rls.sql), the Next.js middleware
--    (utils/mfa/assurance.ts) and Buck_AI (shared/auth.py). A session passes
--    when it is aal2, or when the user has no verified MFA factor (2FA off).
--    Passkey sign-ins are aal1 and do NOT pass on their own: a password-only
--    attacker could otherwise register a passkey at aal1 and skip TOTP.
-- 2. mfa_recovery_codes: HMAC-SHA256 hashes of single-use backup codes.
-- 3. mfa_email_recovery_requests: email recovery with a 24 h cool-off.
-- 4. auth_security_events accepts MFA events and an optional user_id.
-- 5. purge_expired_data() also drops finished email recovery requests.
--
-- Tables 2 and 3 are service-role only (RLS on, no policies, privileges
-- revoked), like auth_security_events: the API routes own every read/write.
--
-- Down:
--   create or replace function public.purge_expired_data() ... (202610160001 body)
--   alter table public.auth_security_events drop column if exists user_id;
--   (restore the two check constraints from 202606110002)
--   drop table if exists public.mfa_email_recovery_requests;
--   drop table if exists public.mfa_recovery_codes;
--   drop function if exists private.mfa_satisfied();
--   drop schema if exists private;

begin;

-- 1. The rule ---------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    or not exists (
      select 1
      from auth.mfa_factors f
      where f.user_id = auth.uid()
        and f.status = 'verified'
    );
$$;

comment on function private.mfa_satisfied() is
  'True when the caller passed 2FA (aal2) or has no verified MFA factor. Used by restrictive RLS policies.';

revoke execute on function private.mfa_satisfied() from public, anon;
grant execute on function private.mfa_satisfied() to authenticated, service_role;

-- 2. Backup codes -------------------------------------------------------------

create table if not exists public.mfa_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null unique,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create index if not exists mfa_recovery_codes_user_unused_idx
  on public.mfa_recovery_codes(user_id)
  where used_at is null;

alter table public.mfa_recovery_codes enable row level security;
revoke all on table public.mfa_recovery_codes from anon, authenticated;

drop policy if exists "Service role manages mfa recovery codes" on public.mfa_recovery_codes;
create policy "Service role manages mfa recovery codes"
  on public.mfa_recovery_codes for all to service_role using (true) with check (true);

-- 3. Email recovery -----------------------------------------------------------

create table if not exists public.mfa_email_recovery_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  requested_at timestamptz not null default now(),
  confirmation_expires_at timestamptz not null,
  confirmed_at timestamptz,
  available_at timestamptz,
  completed_at timestamptz,
  canceled_at timestamptz,
  constraint mfa_email_recovery_available_after_confirm
    check (available_at is null or confirmed_at is not null)
);

-- At most one open request per user.
create unique index if not exists mfa_email_recovery_one_open_idx
  on public.mfa_email_recovery_requests(user_id)
  where completed_at is null and canceled_at is null;

alter table public.mfa_email_recovery_requests enable row level security;
revoke all on table public.mfa_email_recovery_requests from anon, authenticated;

drop policy if exists "Service role manages mfa email recovery" on public.mfa_email_recovery_requests;
create policy "Service role manages mfa email recovery"
  on public.mfa_email_recovery_requests for all to service_role using (true) with check (true);

-- 4. Security events ----------------------------------------------------------

alter table public.auth_security_events
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.auth_security_events
  drop constraint if exists auth_security_events_event_type_check;
alter table public.auth_security_events
  add constraint auth_security_events_event_type_check
  check (
    event_type in (
      'password_reset',
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
      'canceled'
    )
  );

create index if not exists auth_security_events_user_window_idx
  on public.auth_security_events(event_type, user_id, created_at desc)
  where user_id is not null;

-- Covers the user_id FK for the auth.users delete cascade.
create index if not exists auth_security_events_user_id_idx
  on public.auth_security_events(user_id)
  where user_id is not null;

-- 5. Retention ----------------------------------------------------------------

create or replace function public.purge_expired_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_events integer; v_usage integer; v_forecasts integer; v_advisories integer; v_mfa integer;
begin
  delete from public.auth_security_events where created_at < now() - interval '30 days';
  get diagnostics v_events = row_count;
  delete from public.ai_usage_events where created_at < now() - interval '1 day';
  get diagnostics v_usage = row_count;
  delete from public.ai_forecasts where expires_at is not null and expires_at < now() - interval '30 days';
  get diagnostics v_forecasts = row_count;
  delete from public.ai_advisories a
   using (select id, row_number() over (partition by user_id order by created_at desc) as rn from public.ai_advisories) r
   where a.id = r.id and r.rn > 50;
  get diagnostics v_advisories = row_count;
  -- Finished, canceled or never-confirmed email recoveries older than 30 days.
  delete from public.mfa_email_recovery_requests
   where requested_at < now() - interval '30 days'
     and (completed_at is not null or canceled_at is not null or confirmed_at is null);
  get diagnostics v_mfa = row_count;
  return jsonb_build_object(
    'security_events', v_events, 'usage_events', v_usage, 'forecasts', v_forecasts,
    'advisories', v_advisories, 'mfa_email_recoveries', v_mfa
  );
end;
$$;

revoke execute on function public.purge_expired_data() from public, anon, authenticated;
grant execute on function public.purge_expired_data() to service_role;

commit;
