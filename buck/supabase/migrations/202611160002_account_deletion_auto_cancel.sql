-- Account deletion login auto-cancellation and dashboard notice tracking.
-- Stores whether a confirmed 10-day scheduled deletion was automatically
-- canceled by a user sign-in, whether a cancellation notification email was sent,
-- and whether the user dismissed the dashboard banner notice.

alter table public.account_deletion_requests
  add column if not exists auto_canceled_on_login boolean not null default false,
  add column if not exists auto_cancel_notice_dismissed_at timestamptz default null,
  add column if not exists cancel_reason text default null,
  add column if not exists cancellation_email_sent_at timestamptz default null;

alter table public.account_deletion_requests
  drop constraint if exists account_deletion_requests_cancel_reason_check;

alter table public.account_deletion_requests
  add constraint account_deletion_requests_cancel_reason_check
  check (cancel_reason is null or cancel_reason in ('user_login', 'manual_recovery'));

create index if not exists account_deletion_requests_notice_idx
  on public.account_deletion_requests (user_id, canceled_at desc)
  where auto_canceled_on_login = true and auto_cancel_notice_dismissed_at is null;
