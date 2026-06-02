-- Buck Budget Tracker - initial Supabase schema
-- Run this in the Supabase SQL Editor, or apply it with the Supabase CLI.
-- This replaces the Firebase/Firestore document paths with user-owned
-- Postgres tables protected by Row Level Security.

begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  email text,
  active_wallet_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  budget numeric(14, 2) not null default 0 check (budget >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  drop constraint if exists profiles_active_wallet_id_fkey;

alter table public.profiles
  add constraint profiles_active_wallet_id_fkey
  foreign key (active_wallet_id)
  references public.wallets(id)
  on delete set null;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text,
  icon text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_name_not_blank check (length(btrim(name)) > 0)
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_name text not null,
  target_amount numeric(14, 2) not null check (target_amount > 0),
  current_amount numeric(14, 2) not null default 0 check (current_amount >= 0),
  attitude text,
  target_date date,
  is_active boolean not null default false,
  completed boolean not null default false,
  ai_recommendation text,
  ai_recommended_budget numeric(14, 2) check (
    ai_recommended_budget is null or ai_recommended_budget >= 0
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint goals_name_not_blank check (length(btrim(goal_name)) > 0)
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_id uuid references public.wallets(id) on delete set null,
  goal_id uuid references public.goals(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  category_name text not null default 'Uncategorized',
  amount numeric(14, 2) not null check (amount > 0),
  description text not null default '',
  spent_on date not null default current_date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_category_name_not_blank check (
    length(btrim(category_name)) > 0
  )
);

create index if not exists profiles_active_wallet_id_idx
  on public.profiles(active_wallet_id);

create index if not exists wallets_user_id_created_at_idx
  on public.wallets(user_id, created_at desc);

create unique index if not exists categories_user_id_lower_name_key
  on public.categories(user_id, lower(name));

create index if not exists categories_user_id_sort_order_idx
  on public.categories(user_id, sort_order, name);

create unique index if not exists goals_one_active_goal_per_user_idx
  on public.goals(user_id)
  where is_active;

create index if not exists goals_user_id_created_at_idx
  on public.goals(user_id, created_at desc);

create index if not exists expenses_user_id_spent_on_idx
  on public.expenses(user_id, spent_on desc);

create index if not exists expenses_user_id_goal_id_idx
  on public.expenses(user_id, goal_id);

create index if not exists expenses_user_id_category_id_idx
  on public.expenses(user_id, category_id);

create index if not exists expenses_user_id_wallet_id_idx
  on public.expenses(user_id, wallet_id);

create or replace function public.ensure_profile_active_wallet_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.active_wallet_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.wallets
    where wallets.id = new.active_wallet_id
      and wallets.user_id = new.id
  ) then
    raise exception 'Active wallet must belong to the profile owner.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.ensure_expense_relations_owner()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  category_label text;
begin
  if new.wallet_id is not null and not exists (
    select 1 from public.wallets
    where wallets.id = new.wallet_id
      and wallets.user_id = new.user_id
  ) then
    raise exception 'Expense wallet must belong to the expense owner.'
      using errcode = '23514';
  end if;

  if new.goal_id is not null and not exists (
    select 1 from public.goals
    where goals.id = new.goal_id
      and goals.user_id = new.user_id
  ) then
    raise exception 'Expense goal must belong to the expense owner.'
      using errcode = '23514';
  end if;

  if new.category_id is not null then
    select categories.name
    into category_label
    from public.categories
    where categories.id = new.category_id
      and categories.user_id = new.user_id;

    if category_label is null then
      raise exception 'Expense category must belong to the expense owner.'
        using errcode = '23514';
    end if;

    if new.category_name is null
      or length(btrim(new.category_name)) = 0
      or new.category_name = 'Uncategorized'
    then
      new.category_name = category_label;
    end if;
  end if;

  if new.category_name is null or length(btrim(new.category_name)) = 0 then
    new.category_name = 'Uncategorized';
  end if;

  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_wallets_updated_at on public.wallets;
create trigger set_wallets_updated_at
before update on public.wallets
for each row execute function public.set_updated_at();

drop trigger if exists set_categories_updated_at on public.categories;
create trigger set_categories_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists set_goals_updated_at on public.goals;
create trigger set_goals_updated_at
before update on public.goals
for each row execute function public.set_updated_at();

drop trigger if exists set_expenses_updated_at on public.expenses;
create trigger set_expenses_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

drop trigger if exists ensure_profile_active_wallet_owner on public.profiles;
create trigger ensure_profile_active_wallet_owner
before insert or update on public.profiles
for each row execute function public.ensure_profile_active_wallet_owner();

drop trigger if exists ensure_expense_relations_owner on public.expenses;
create trigger ensure_expense_relations_owner
before insert or update on public.expenses
for each row execute function public.ensure_expense_relations_owner();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text;
begin
  display_name := coalesce(
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, email, username)
  values (new.id, new.email, display_name)
  on conflict (id) do update
  set
    email = excluded.email,
    username = coalesce(public.profiles.username, excluded.username);

  insert into public.categories (user_id, name, sort_order)
  values
    (new.id, 'Food', 10),
    (new.id, 'Gas Money', 20),
    (new.id, 'Video Games', 30),
    (new.id, 'Shopping', 40),
    (new.id, 'Bills', 50),
    (new.id, 'Education', 60),
    (new.id, 'Electronics', 70),
    (new.id, 'Entertainment', 80),
    (new.id, 'Health', 90),
    (new.id, 'Home', 100),
    (new.id, 'Insurance', 110),
    (new.id, 'Social', 120),
    (new.id, 'Sport', 130),
    (new.id, 'Tax', 140),
    (new.id, 'Telephone', 150),
    (new.id, 'Transportation', 160),
    (new.id, 'Uncategorized', 170)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.categories enable row level security;
alter table public.goals enable row level security;
alter table public.expenses enable row level security;

drop policy if exists "Profiles are readable by owner" on public.profiles;
create policy "Profiles are readable by owner"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Profiles are insertable by owner" on public.profiles;
create policy "Profiles are insertable by owner"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "Profiles are updatable by owner" on public.profiles;
create policy "Profiles are updatable by owner"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "Wallets are manageable by owner" on public.wallets;
create policy "Wallets are manageable by owner"
on public.wallets
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Categories are manageable by owner" on public.categories;
create policy "Categories are manageable by owner"
on public.categories
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Goals are manageable by owner" on public.goals;
create policy "Goals are manageable by owner"
on public.goals
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Expenses are manageable by owner" on public.expenses;
create policy "Expenses are manageable by owner"
on public.expenses
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on
  public.profiles,
  public.wallets,
  public.categories,
  public.goals,
  public.expenses
to authenticated;

alter table public.wallets replica identity full;
alter table public.categories replica identity full;
alter table public.goals replica identity full;
alter table public.expenses replica identity full;

do $$
declare
  table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array['wallets', 'categories', 'goals', 'expenses']
    loop
      if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = table_name
      ) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end;
$$;

commit;
