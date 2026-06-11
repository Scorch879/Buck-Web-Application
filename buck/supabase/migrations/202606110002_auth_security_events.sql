-- Private auth security event log.
-- Stores hashed identifiers only, so reset throttling does not retain raw
-- email addresses or IP addresses.

begin;

create table if not exists public.auth_security_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  ip_hash text not null,
  email_hash text,
  outcome text not null,
  created_at timestamptz not null default now(),
  constraint auth_security_events_event_type_check
    check (event_type in ('password_reset')),
  constraint auth_security_events_outcome_check
    check (
      outcome in (
        'sent',
        'not_found',
        'rate_limited',
        'provider_error',
        'lookup_error'
      )
    )
);

create index if not exists auth_security_events_ip_window_idx
  on public.auth_security_events(event_type, ip_hash, created_at desc);

create index if not exists auth_security_events_email_window_idx
  on public.auth_security_events(event_type, email_hash, created_at desc)
  where email_hash is not null;

alter table public.auth_security_events enable row level security;

revoke all on table public.auth_security_events from anon, authenticated;

commit;
