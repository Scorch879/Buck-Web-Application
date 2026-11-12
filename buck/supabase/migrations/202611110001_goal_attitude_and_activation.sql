-- Goals: detected saving attitude, one active goal, atomic progress (2026-11-11).
--
-- 1. goals.attitude is required and limited to Normal / Moderate / Aggressive.
--    It is detected by the AI Financial Advisor (Buck_AI/shared/attitude.py)
--    from the cut in spending the goal needs; attitude_basis keeps the figures
--    behind it and attitude_detected_at when it was last checked.
-- 2. One active goal, kept by the database:
--    - a completed goal is never active (trigger + check);
--    - a user's goal is made active on insert when they have no active goal;
--    - set_active_goal() switches the active goal in one transaction (the
--      web used two requests, which could leave no goal active).
-- 3. add_goal_progress() adds to current_amount atomically (the web wrote a
--    total computed in the browser, so two quick saves could lose one).
-- 4. save_goal_attitude() lets Buck_AI store the detected attitude as the user.
--
-- All functions are SECURITY INVOKER: RLS (owner, 2FA, read-only apps) applies.
--
-- Down:
--   drop function public.save_goal_attitude(uuid, text, jsonb);
--   drop function public.add_goal_progress(uuid, numeric);
--   drop function public.set_active_goal(uuid);
--   drop trigger goals_activation on public.goals; drop function public.goals_activation();
--   alter table public.goals drop constraint goals_active_not_completed,
--     drop constraint goals_attitude_check, drop column attitude_basis,
--     drop column attitude_detected_at, alter column attitude drop not null,
--     alter column attitude drop default;

begin;

-- 1. Attitude --------------------------------------------------------------
update public.goals
   set attitude = 'Normal'
 where attitude is null or attitude not in ('Normal', 'Moderate', 'Aggressive');

alter table public.goals
  alter column attitude set default 'Normal',
  alter column attitude set not null,
  add constraint goals_attitude_check check (attitude in ('Normal', 'Moderate', 'Aggressive')),
  add column if not exists attitude_detected_at timestamptz,
  add column if not exists attitude_basis jsonb;

-- 2. One active goal --------------------------------------------------------
update public.goals set is_active = false where is_active and completed;

alter table public.goals
  add constraint goals_active_not_completed check (not (is_active and completed));

create or replace function public.goals_activation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- A finished goal stops being the one the Advisor and Forecaster plan for.
  if new.completed then
    new.is_active := false;
  elsif tg_op = 'INSERT' and not new.is_active then
    -- Serialise per user so two goals created at once can't both turn active.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text, 0));
    if not exists (
      select 1 from public.goals g where g.user_id = new.user_id and g.is_active
    ) then
      new.is_active := true;
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.goals_activation() from public, anon, authenticated;

drop trigger if exists goals_activation on public.goals;
create trigger goals_activation
  before insert or update of completed, is_active on public.goals
  for each row execute function public.goals_activation();

create or replace function public.set_active_goal(p_goal_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  perform 1 from public.goals where id = p_goal_id and user_id = v_uid and not completed for update;
  if not found then
    raise exception 'Goal not found or already completed' using errcode = 'P0002';
  end if;
  -- Deactivate first: the unique index allows one active goal per user.
  update public.goals set is_active = false
   where user_id = v_uid and is_active and id <> p_goal_id;
  update public.goals set is_active = true
   where id = p_goal_id and user_id = v_uid;
end;
$$;

-- 3. Atomic progress ---------------------------------------------------------
create or replace function public.add_goal_progress(p_goal_id uuid, p_amount numeric)
returns table (current_amount numeric, completed boolean, is_active boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_amount numeric := round(p_amount, 2);
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if v_amount is null or v_amount <= 0 or v_amount > 999999999999.99 then
    raise exception 'Amount must be more than 0' using errcode = '22023';
  end if;
  return query
    update public.goals g
       set current_amount = g.current_amount + v_amount,
           completed = g.current_amount + v_amount >= g.target_amount
     where g.id = p_goal_id and g.user_id = v_uid and not g.completed
    returning g.current_amount, g.completed, g.is_active;
  if not found then
    raise exception 'Goal not found or already completed' using errcode = 'P0002';
  end if;
end;
$$;

-- 4. Detected attitude -------------------------------------------------------
create or replace function public.save_goal_attitude(p_goal_id uuid, p_attitude text, p_basis jsonb)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if p_attitude not in ('Normal', 'Moderate', 'Aggressive') then
    raise exception 'Unknown saving attitude' using errcode = '22023';
  end if;
  if p_basis is not null and (jsonb_typeof(p_basis) <> 'object' or pg_catalog.octet_length(p_basis::text) > 4000) then
    raise exception 'Invalid attitude basis' using errcode = '22023';
  end if;
  -- Write only on a change, so repeat reads don't churn updated_at or Realtime.
  update public.goals
     set attitude = p_attitude, attitude_basis = p_basis, attitude_detected_at = now()
   where id = p_goal_id and user_id = v_uid
     and (attitude is distinct from p_attitude or attitude_basis is distinct from p_basis);
  return found;
end;
$$;

revoke execute on function public.set_active_goal(uuid) from public, anon;
revoke execute on function public.add_goal_progress(uuid, numeric) from public, anon;
revoke execute on function public.save_goal_attitude(uuid, text, jsonb) from public, anon;
grant execute on function public.set_active_goal(uuid) to authenticated;
grant execute on function public.add_goal_progress(uuid, numeric) to authenticated;
grant execute on function public.save_goal_attitude(uuid, text, jsonb) to authenticated;

commit;
