-- Income tracking (shared by Buck web + mobile).
-- wallets.budget is the wallet balance: an income credits it, mirroring how
-- expenses debit it. add_income_atomic / delete_income_atomic keep the income
-- row and the wallet balance in one transaction.
-- Down:
--   drop function if exists public.delete_income_atomic(uuid);
--   drop function if exists public.add_income_atomic(uuid, numeric, text, text, date);
--   drop table if exists public.incomes;
--   drop function if exists public.ensure_income_wallet_owner();

begin;

create table if not exists public.incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_id uuid references public.wallets(id) on delete set null,
  source text not null default 'Other',
  amount numeric(14, 2) not null check (amount > 0),
  description text not null default '',
  received_on date not null default current_date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint incomes_source_not_blank check (length(btrim(source)) > 0)
);

create index if not exists incomes_user_id_received_on_idx
  on public.incomes(user_id, received_on desc);

create index if not exists incomes_wallet_id_idx
  on public.incomes(wallet_id);

drop trigger if exists set_incomes_updated_at on public.incomes;
create trigger set_incomes_updated_at
before update on public.incomes
for each row execute function public.set_updated_at();

create or replace function public.ensure_income_wallet_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.wallet_id is not null and not exists (
    select 1
    from public.wallets
    where wallets.id = new.wallet_id
      and wallets.user_id = new.user_id
  ) then
    raise exception 'Income wallet must belong to the income owner.'
      using errcode = '23514';
  end if;

  if new.source is null or length(btrim(new.source)) = 0 then
    new.source = 'Other';
  end if;

  return new;
end;
$$;

drop trigger if exists ensure_income_wallet_owner on public.incomes;
create trigger ensure_income_wallet_owner
before insert or update on public.incomes
for each row execute function public.ensure_income_wallet_owner();

alter table public.incomes enable row level security;

drop policy if exists "Incomes are manageable by owner" on public.incomes;
create policy "Incomes are manageable by owner"
on public.incomes
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.incomes to authenticated;

alter table public.incomes replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'incomes'
     )
  then
    alter publication supabase_realtime add table public.incomes;
  end if;
end;
$$;

-- Records an income and credits the wallet balance atomically.
-- SECURITY INVOKER: caller RLS applies; ownership is also asserted.
create or replace function public.add_income_atomic(
  p_wallet_id uuid,
  p_amount numeric,
  p_source text,
  p_description text default '',
  p_received_on date default current_date
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_amount numeric(14, 2);
  v_balance numeric;
  v_income_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if p_wallet_id is null then
    raise exception 'A wallet is required to record income' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Income amount must be greater than zero' using errcode = '22023';
  end if;
  v_amount := round(p_amount, 2);
  if v_amount <= 0 or v_amount > 999999999999.99 then
    raise exception 'Income amount out of range' using errcode = '22003';
  end if;

  select budget into v_balance
  from public.wallets
  where id = p_wallet_id and user_id = v_uid and deleted_at is null
  for update;

  if v_balance is null then
    raise exception 'Wallet not found' using errcode = 'P0002';
  end if;

  insert into public.incomes (user_id, wallet_id, source, amount, description, received_on)
  values (
    v_uid,
    p_wallet_id,
    coalesce(nullif(btrim(p_source), ''), 'Other'),
    v_amount,
    coalesce(btrim(p_description), ''),
    coalesce(p_received_on, current_date)
  )
  returning id into v_income_id;

  update public.wallets set budget = budget + v_amount where id = p_wallet_id;

  return jsonb_build_object(
    'income_id', v_income_id,
    'wallet_id', p_wallet_id,
    'amount', v_amount,
    'wallet_balance', v_balance + v_amount
  );
end;
$$;

-- Deletes an income and removes its amount from the wallet (never below 0).
create or replace function public.delete_income_atomic(p_income_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_income record;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select id, wallet_id, amount into v_income
  from public.incomes
  where id = p_income_id and user_id = v_uid
  for update;

  if v_income.id is null then
    raise exception 'Income not found' using errcode = 'P0002';
  end if;

  if v_income.wallet_id is not null then
    update public.wallets
    set budget = greatest(budget - v_income.amount, 0)
    where id = v_income.wallet_id and user_id = v_uid;
  end if;

  delete from public.incomes where id = v_income.id;

  return jsonb_build_object('income_id', v_income.id, 'amount', v_income.amount);
end;
$$;

revoke all on function public.add_income_atomic(uuid, numeric, text, text, date) from public, anon;
grant execute on function public.add_income_atomic(uuid, numeric, text, text, date) to authenticated;
revoke all on function public.delete_income_atomic(uuid) from public, anon;
grant execute on function public.delete_income_atomic(uuid) to authenticated;

commit;
