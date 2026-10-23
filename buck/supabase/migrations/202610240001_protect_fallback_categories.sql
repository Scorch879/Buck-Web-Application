-- Protect the fallback categories at the database level.
--
-- 'Uncategorized' (expense) and 'Other' (income) are what the app, the AI
-- categorizer and ensure_expense_relations_owner() fall back to, so every user
-- must always have them. Until now only the Categories page hid their buttons;
-- a direct API call could delete or rename them.
--
-- * DELETE of a fallback is rejected, except when the owning auth user is gone
--   (account purge cascades through auth.users -> categories).
-- * Renaming a fallback or changing its kind is rejected. Colour, icon and
--   sort order stay editable.
-- * The trigger has a WHEN clause, so it runs only for the ~2 fallback rows
--   per user: zero overhead for every other category write.
-- * Idempotent backfill: any user missing a fallback gets it back.
--
-- SECURITY DEFINER (search_path pinned) so the purge-cascade check can read
-- auth.users whatever role performs the delete; EXECUTE is revoked from API
-- roles because trigger functions are never called directly.
--
-- Down:
--   drop trigger if exists protect_fallback_categories on public.categories;
--   drop function if exists public.protect_fallback_categories();

begin;

create or replace function public.protect_fallback_categories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    -- Account deletion cascades here after the auth user row is already gone.
    if not exists (select 1 from auth.users u where u.id = old.user_id) then
      return old;
    end if;
    raise exception 'The "%" category is required and cannot be deleted.', old.name
      using errcode = '23514';
  end if;

  if new.name is distinct from old.name or new.kind is distinct from old.kind then
    raise exception 'The "%" category is required and cannot be renamed or changed.', old.name
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke execute on function public.protect_fallback_categories() from public, anon, authenticated;

drop trigger if exists protect_fallback_categories on public.categories;
create trigger protect_fallback_categories
before delete or update of name, kind on public.categories
for each row
when (
  (old.kind = 'expense' and lower(old.name) = 'uncategorized')
  or (old.kind = 'income' and lower(old.name) = 'other')
)
execute function public.protect_fallback_categories();

-- Backfill (no-op when every user already has both; uses the unique index
-- on (user_id, kind, lower(name)) to skip existing rows).
insert into public.categories (user_id, name, kind, sort_order)
select p.id, d.name, d.kind, d.sort_order
from public.profiles p
cross join (values ('Uncategorized', 'expense', 170), ('Other', 'income', 70)) as d(name, kind, sort_order)
on conflict do nothing;

commit;
