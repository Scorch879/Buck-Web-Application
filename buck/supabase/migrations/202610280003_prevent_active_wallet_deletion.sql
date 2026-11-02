-- Prevent deleting an active wallet or a wallet with remaining funds (2026-10-28).
--
-- Extends `public.check_wallet_deletion()` from 202606130001_strict_deletions.sql
-- so a wallet can only be soft-deleted (`deleted_at IS NOT NULL`) or hard-deleted
-- when:
--   1. Its balance is empty (`OLD.budget <= 0`), AND
--   2. It is NOT the user's currently active wallet (`profiles.active_wallet_id`).
--
-- Down:
--   Restore `public.check_wallet_deletion()` from 202606130001_strict_deletions.sql.

begin;

create or replace function public.check_wallet_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.budget > 0 then
      raise exception 'Cannot delete a wallet that still has a budget. Please empty it first.';
    end if;

    if exists (
      select 1
        from public.profiles p
       where p.id = old.user_id
         and p.active_wallet_id = old.id
    ) then
      raise exception 'Cannot delete the active wallet. Please set another wallet as active first.';
    end if;

    return old;
  end if;

  if tg_op = 'UPDATE' then
    if new.deleted_at is not null and old.deleted_at is null then
      if old.budget > 0 then
        raise exception 'Cannot delete a wallet that still has a budget. Please empty it first.';
      end if;

      if exists (
        select 1
          from public.profiles p
         where p.id = old.user_id
           and p.active_wallet_id = old.id
      ) then
        raise exception 'Cannot delete the active wallet. Please set another wallet as active first.';
      end if;
    end if;

    return new;
  end if;

  return old;
end;
$$;

revoke execute on function public.check_wallet_deletion() from public, anon, authenticated;
grant execute on function public.check_wallet_deletion() to postgres, service_role;

drop trigger if exists trg_check_wallet_deletion on public.wallets;
create trigger trg_check_wallet_deletion
  before delete or update on public.wallets
  for each row
  execute function public.check_wallet_deletion();

commit;
