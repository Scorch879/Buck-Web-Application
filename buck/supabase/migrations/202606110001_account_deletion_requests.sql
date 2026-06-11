-- Buck account deletion requests
-- Adds a server-managed 10-day recovery window for account deletion.

begin;

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  token_hash text,
  requested_at timestamptz not null default now(),
  confirmation_expires_at timestamptz,
  confirmed_at timestamptz,
  recovery_until timestamptz,
  canceled_at timestamptz,
  purge_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_deletion_email_not_blank check (length(btrim(email)) > 0),
  constraint account_deletion_recovery_requires_confirmation check (
    recovery_until is null or confirmed_at is not null
  ),
  constraint account_deletion_token_before_confirmation check (
    confirmed_at is not null or token_hash is not null
  )
);

create index if not exists account_deletion_requests_user_id_idx
  on public.account_deletion_requests(user_id, requested_at desc);

create index if not exists account_deletion_requests_recovery_idx
  on public.account_deletion_requests(recovery_until)
  where confirmed_at is not null
    and canceled_at is null
    and purge_started_at is null;

create unique index if not exists account_deletion_one_open_request_per_user_idx
  on public.account_deletion_requests(user_id)
  where canceled_at is null
    and purge_started_at is null;

drop trigger if exists set_account_deletion_requests_updated_at
  on public.account_deletion_requests;
create trigger set_account_deletion_requests_updated_at
before update on public.account_deletion_requests
for each row execute function public.set_updated_at();

alter table public.account_deletion_requests enable row level security;

drop policy if exists "Account deletion requests are readable by owner"
  on public.account_deletion_requests;
create policy "Account deletion requests are readable by owner"
on public.account_deletion_requests
for select
to authenticated
using ((select auth.uid()) = user_id);

grant select on public.account_deletion_requests to authenticated;
grant all on public.account_deletion_requests to service_role;

commit;
