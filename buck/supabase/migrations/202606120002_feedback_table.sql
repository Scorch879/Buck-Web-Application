-- Baseline for public.feedback (table pre-existed in the live project without a migration).
-- Policies are defined in 202606140001_security_and_policy_hardening.sql.
-- Down: drop table if exists public.feedback;

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  category text not null,
  title text not null,
  details text not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.feedback enable row level security;
