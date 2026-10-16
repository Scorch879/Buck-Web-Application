-- Income categories + fully custom categories (Design.md ADR-042).
--
-- 1. `categories.kind` ('expense' | 'income'): one table, one management UI.
--    Name uniqueness becomes per user AND per kind (so "Other" can exist twice).
-- 2. `incomes.category_id` links an income to an income category. `source`
--    stays as the denormalised name (mobile + reports read it), resolved from
--    the category by trigger when category_id is set, or used to look the
--    category up when only a name is given (add_income_atomic sends p_source).
-- 3. Renaming a category copies the new name onto expenses.category_name and
--    incomes.source, so history never shows a stale label.
-- 4. Default income categories are seeded for existing users and by
--    handle_new_user() for new users.
-- RLS: categories policies already enforce (select auth.uid()) = user_id and
-- are unaffected by the new column; incomes policies likewise.
--
-- Down:
--   drop trigger if exists sync_category_name_after_update on public.categories;
--   drop function if exists public.sync_category_name();
--   alter table public.incomes drop column if exists category_id;
--   delete from public.categories where kind = 'income';
--   drop index if exists public.categories_user_id_kind_lower_name_key;
--   create unique index categories_user_id_lower_name_key
--     on public.categories(user_id, lower(name));
--   alter table public.categories drop column if exists kind;
--   -- then restore ensure_income_wallet_owner() from 202610110002_incomes.sql
--   -- and handle_new_user() from 202610120001_fare_category.sql,
--   -- and drop the categories.kind check from ensure_expense_relations_owner().

begin;

-- 1. Category kind --------------------------------------------------------
alter table public.categories
  add column if not exists kind text not null default 'expense';

alter table public.categories
  drop constraint if exists categories_kind_check;
alter table public.categories
  add constraint categories_kind_check check (kind in ('expense', 'income'));

drop index if exists public.categories_user_id_lower_name_key;
create unique index if not exists categories_user_id_kind_lower_name_key
  on public.categories(user_id, kind, lower(name));

create index if not exists categories_user_id_kind_sort_order_idx
  on public.categories(user_id, kind, sort_order);

-- 2. Income -> category link ---------------------------------------------
alter table public.incomes
  add column if not exists category_id uuid
  references public.categories(id) on delete set null;

create index if not exists incomes_category_id_idx
  on public.incomes(category_id);

-- Ownership + name resolution (replaces the version from 202610110002).
create or replace function public.ensure_income_wallet_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_name text;
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

  if new.category_id is not null then
    select c.name into v_name
    from public.categories c
    where c.id = new.category_id
      and c.user_id = new.user_id
      and c.kind = 'income';

    if v_name is null then
      raise exception 'Income category must be an income category owned by the income owner.'
        using errcode = '23514';
    end if;

    new.source = v_name;
  else
    if new.source is null or length(btrim(new.source)) = 0 then
      new.source = 'Other';
    end if;

    select c.id into new.category_id
    from public.categories c
    where c.user_id = new.user_id
      and c.kind = 'income'
      and lower(c.name) = lower(btrim(new.source))
    limit 1;
  end if;

  return new;
end;
$$;

-- Expenses may only link to expense categories (now that income categories
-- share the table). Otherwise identical to the live version.
create or replace function public.ensure_expense_relations_owner()
returns trigger
language plpgsql
set search_path to 'public'
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
      and categories.user_id = new.user_id
      and categories.kind = 'expense';

    if category_label is null then
      raise exception 'Expense category must be an expense category owned by the expense owner.'
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

-- 3. Keep denormalised names in sync on rename ----------------------------
create or replace function public.sync_category_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.name is distinct from old.name then
    if new.kind = 'income' then
      update public.incomes
      set source = new.name
      where category_id = new.id
        and user_id = new.user_id;
    else
      update public.expenses
      set category_name = new.name
      where category_id = new.id
        and user_id = new.user_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_category_name_after_update on public.categories;
create trigger sync_category_name_after_update
after update of name on public.categories
for each row execute function public.sync_category_name();

revoke execute on function public.sync_category_name() from public, anon, authenticated;

-- 4. Seed default income categories --------------------------------------
insert into public.categories (user_id, name, kind, sort_order)
select p.id, d.name, 'income', d.sort_order
from public.profiles p
cross join (
  values
    ('Salary', 10),
    ('Allowance', 20),
    ('Freelance', 30),
    ('Business', 40),
    ('Investment', 50),
    ('Gift', 60),
    ('Other', 70)
) as d(name, sort_order)
on conflict do nothing;

-- Link existing incomes to their category by name.
update public.incomes i
set category_id = c.id
from public.categories c
where c.user_id = i.user_id
  and c.kind = 'income'
  and lower(c.name) = lower(btrim(i.source))
  and i.category_id is null;

-- New users: expense defaults (unchanged from 202610120001) + income defaults.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
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

  insert into public.categories (user_id, name, kind, sort_order)
  values
    (new.id, 'Food', 'expense', 10),
    (new.id, 'Fare', 'expense', 15),
    (new.id, 'Gas Money', 'expense', 20),
    (new.id, 'Video Games', 'expense', 30),
    (new.id, 'Shopping', 'expense', 40),
    (new.id, 'Bills', 'expense', 50),
    (new.id, 'Education', 'expense', 60),
    (new.id, 'Electronics', 'expense', 70),
    (new.id, 'Entertainment', 'expense', 80),
    (new.id, 'Health', 'expense', 90),
    (new.id, 'Home', 'expense', 100),
    (new.id, 'Insurance', 'expense', 110),
    (new.id, 'Social', 'expense', 120),
    (new.id, 'Sport', 'expense', 130),
    (new.id, 'Tax', 'expense', 140),
    (new.id, 'Telephone', 'expense', 150),
    (new.id, 'Transportation', 'expense', 160),
    (new.id, 'Uncategorized', 'expense', 170),
    (new.id, 'Salary', 'income', 10),
    (new.id, 'Allowance', 'income', 20),
    (new.id, 'Freelance', 'income', 30),
    (new.id, 'Business', 'income', 40),
    (new.id, 'Investment', 'income', 50),
    (new.id, 'Gift', 'income', 60),
    (new.id, 'Other', 'income', 70)
  on conflict do nothing;

  return new;
end;
$$;

commit;
