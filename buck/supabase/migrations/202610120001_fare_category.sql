-- BUG-021: add the canonical `Fare` category (Claude.md 3.2).
-- `Uncategorized` is kept: ensure_expense_relations_owner() and the AI classifier
-- both fall back to it, so each user now has the 17 canonical categories plus the
-- fallback (18 rows).
--
-- Down:
--   update public.expenses e set category_id = null
--     from public.categories c where c.id = e.category_id and c.name = 'Fare';
--   delete from public.categories where name = 'Fare';
--   -- then restore handle_new_user() from 202606010001_initial_buck_schema.sql.

-- 1. Backfill `Fare` for every existing user.
insert into public.categories (user_id, name, sort_order)
select p.id, 'Fare', 15
from public.profiles p
where not exists (
  select 1
  from public.categories c
  where c.user_id = p.id and c.name = 'Fare'
);

-- 2. Link expenses that were stored as 'Fare' with no category_id.
update public.expenses e
set category_id = c.id
from public.categories c
where c.user_id = e.user_id
  and c.name = 'Fare'
  and e.category_name = 'Fare'
  and e.category_id is null;

-- 3. Seed `Fare` for new users. EXECUTE grants from the hardening migration are
--    preserved by CREATE OR REPLACE.
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

  insert into public.categories (user_id, name, sort_order)
  values
    (new.id, 'Food', 10),
    (new.id, 'Fare', 15),
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
