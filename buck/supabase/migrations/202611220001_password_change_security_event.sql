-- Server-side password updates (POST /api/auth/password/update, SEC-045) log
-- their attempts in auth_security_events for rate limiting (ADR-005), so the
-- event_type check gains 'password_change'. Outcomes it uses already exist:
-- success, invalid, rate_limited, provider_error.
--
-- Down:
--   delete from public.auth_security_events where event_type = 'password_change';
--   then re-create the check without 'password_change'
--   (see 202611160001_auth_account_capabilities_and_events.sql).

begin;

alter table public.auth_security_events
  drop constraint if exists auth_security_events_event_type_check;

alter table public.auth_security_events
  add constraint auth_security_events_event_type_check
  check (
    event_type in (
      'password_reset',
      'password_change',
      'sign_up',
      'resend_confirmation',
      'mfa_recovery_code',
      'mfa_recovery_codes_generated',
      'mfa_email_recovery',
      'mfa_reset_admin'
    )
  );

commit;
