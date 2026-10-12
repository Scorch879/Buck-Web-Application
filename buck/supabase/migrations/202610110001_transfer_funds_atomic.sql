-- Atomic inter-wallet transfer (CLAUDE.md 3.6). wallets.budget is the wallet balance.
-- SECURITY INVOKER: the caller's RLS ("Wallets are manageable by owner") applies,
-- and ownership is additionally asserted against auth.uid().
-- Down: drop function if exists public.transfer_funds_atomic(uuid, uuid, numeric);

create or replace function public.transfer_funds_atomic(
  p_source_wallet_id uuid,
  p_target_wallet_id uuid,
  p_amount numeric
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_amount numeric(14, 2);
  v_source_balance numeric;
  v_target_balance numeric;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if p_source_wallet_id is null or p_target_wallet_id is null
     or p_source_wallet_id = p_target_wallet_id then
    raise exception 'Source and target wallets must be two different wallets' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Transfer amount must be greater than zero' using errcode = '22023';
  end if;
  v_amount := round(p_amount, 2);
  if v_amount <= 0 or v_amount > 999999999999.99 then
    raise exception 'Transfer amount out of range' using errcode = '22003';
  end if;

  -- Lock both rows in a stable order to avoid deadlocks on concurrent opposite transfers.
  perform 1
  from public.wallets
  where id in (p_source_wallet_id, p_target_wallet_id)
    and user_id = v_uid
    and deleted_at is null
  order by id
  for update;

  select budget into v_source_balance
  from public.wallets
  where id = p_source_wallet_id and user_id = v_uid and deleted_at is null;

  select budget into v_target_balance
  from public.wallets
  where id = p_target_wallet_id and user_id = v_uid and deleted_at is null;

  if v_source_balance is null or v_target_balance is null then
    raise exception 'Wallet not found' using errcode = 'P0002';
  end if;
  if v_source_balance < v_amount then
    raise exception 'Insufficient funds in source wallet' using errcode = '23514';
  end if;

  update public.wallets set budget = budget - v_amount where id = p_source_wallet_id;
  update public.wallets set budget = budget + v_amount where id = p_target_wallet_id;

  return jsonb_build_object(
    'source_wallet_id', p_source_wallet_id,
    'target_wallet_id', p_target_wallet_id,
    'amount', v_amount,
    'source_balance', v_source_balance - v_amount,
    'target_balance', v_target_balance + v_amount
  );
end;
$$;

revoke all on function public.transfer_funds_atomic(uuid, uuid, numeric) from public, anon;
grant execute on function public.transfer_funds_atomic(uuid, uuid, numeric) to authenticated;
