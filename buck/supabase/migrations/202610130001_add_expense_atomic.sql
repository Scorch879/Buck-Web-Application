-- Atomic expense insert + wallet debit. wallets.budget is the wallet balance.
-- SECURITY INVOKER: the caller's RLS applies, and ownership is additionally asserted against auth.uid().
-- The conditional UPDATE row-locks the wallet, so concurrent web/mobile writers cannot overdraw it.
-- Down: drop function if exists public.add_expense_atomic(uuid, numeric, uuid, text, date, text, uuid);

create or replace function public.add_expense_atomic(
  p_wallet_id uuid,
  p_amount numeric,
  p_category_id uuid,
  p_category_name text,
  p_spent_on date,
  p_description text,
  p_goal_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_amount numeric(14, 2);
  v_row public.expenses;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if p_wallet_id is null then
    raise exception 'Wallet is required' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Expense amount must be greater than zero' using errcode = '22023';
  end if;
  v_amount := round(p_amount, 2);
  if v_amount <= 0 or v_amount > 999999999999.99 then
    raise exception 'Expense amount out of range' using errcode = '22003';
  end if;

  update public.wallets
  set budget = budget - v_amount
  where id = p_wallet_id
    and user_id = v_uid
    and deleted_at is null
    and budget >= v_amount;

  if not found then
    if exists (
      select 1 from public.wallets
      where id = p_wallet_id and user_id = v_uid and deleted_at is null
    ) then
      raise exception 'Expense exceeds your wallet balance.' using errcode = '23514';
    end if;
    raise exception 'Wallet not found' using errcode = 'P0002';
  end if;

  insert into public.expenses (
    user_id, wallet_id, goal_id, category_id, category_name, amount, description, spent_on
  )
  values (
    v_uid, p_wallet_id, p_goal_id, p_category_id,
    coalesce(nullif(btrim(p_category_name), ''), 'Uncategorized'),
    v_amount,
    coalesce(nullif(btrim(p_description), ''), 'Expense'),
    coalesce(p_spent_on, current_date)
  )
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

revoke all on function public.add_expense_atomic(uuid, numeric, uuid, text, date, text, uuid) from public, anon;
grant execute on function public.add_expense_atomic(uuid, numeric, uuid, text, date, text, uuid) to authenticated;
