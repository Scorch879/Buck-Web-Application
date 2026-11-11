-- Soft-delete support for goals (2026-11-11).
--
-- Mirrors `wallets.deleted_at` (ADR-003) on `public.goals` so deleting a goal
-- (including funded or active goals) soft-deletes the row (`deleted_at = now()`,
-- `is_active = false`) instead of hard-deleting it. Linked expenses
-- (`expenses.goal_id`), saved progress (`current_amount`), AI recommendations,
-- and detected saving attitudes remain intact so the user can restore a deleted
-- goal at any time.
--
-- Changes:
--   1. Add `deleted_at timestamptz default null` and `goals_active_not_deleted`
--      constraint to `public.goals`.
--   2. Scope `goals_one_active_goal_per_user_idx` to `WHERE is_active AND deleted_at IS NULL`
--      and add `goals_user_id_active_idx` for non-deleted goals.
--   3. Update `public.goals_activation()` so soft-deleting deactivates the goal,
--      and restoring an unfinished goal auto-activates it when the user has no
--      other active goal.
--   4. Update `public.set_active_goal()`, `public.add_goal_progress()`, and
--      `public.save_goal_attitude()` to ignore soft-deleted goals (`deleted_at IS NULL`).
--   5. Update `public.check_goal_deletion()` so soft-deletion via UPDATE succeeds
--      for funded goals while direct hard DELETE of non-deleted funded goals remains blocked.
--   6. Update `public.get_admin_telemetry()` goal counts to exclude soft-deleted goals.

begin;

-- 1. Soft-delete column & active constraint ----------------------------------
alter table public.goals
  add column if not exists deleted_at timestamptz default null;

update public.goals
   set is_active = false
 where is_active and deleted_at is not null;

alter table public.goals
  drop constraint if exists goals_active_not_deleted;

alter table public.goals
  add constraint goals_active_not_deleted check (not (is_active and deleted_at is not null));

-- 2. Partial indexes ---------------------------------------------------------
drop index if exists public.goals_one_active_goal_per_user_idx;
create unique index goals_one_active_goal_per_user_idx
  on public.goals (user_id)
  where is_active and deleted_at is null;

create index if not exists goals_user_id_active_idx
  on public.goals (user_id, created_at desc)
  where deleted_at is null;

-- 3. Activation trigger ------------------------------------------------------
create or replace function public.goals_activation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- A finished or soft-deleted goal stops being the one the Advisor and Forecaster plan for.
  if new.completed or new.deleted_at is not null then
    new.is_active := false;
  elsif (
    (tg_op = 'INSERT' and not new.is_active)
    or (tg_op = 'UPDATE' and old.deleted_at is not null and new.deleted_at is null and not new.is_active)
  ) then
    -- Serialise per user so two goals created or restored at once can't both turn active.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text, 0));
    if not exists (
      select 1
        from public.goals g
       where g.user_id = new.user_id
         and g.is_active
         and g.deleted_at is null
         and g.id <> new.id
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
  before insert or update of completed, is_active, deleted_at on public.goals
  for each row execute function public.goals_activation();

-- 4. Goal RPCs: ignore soft-deleted rows -------------------------------------
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
  perform 1
     from public.goals
    where id = p_goal_id
      and user_id = v_uid
      and not completed
      and deleted_at is null
      for update;
  if not found then
    raise exception 'Goal not found or already completed' using errcode = 'P0002';
  end if;
  -- Deactivate first: the unique index allows one active goal per user.
  update public.goals set is_active = false
   where user_id = v_uid and is_active and deleted_at is null and id <> p_goal_id;
  update public.goals set is_active = true
   where id = p_goal_id and user_id = v_uid and deleted_at is null;
end;
$$;

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
     where g.id = p_goal_id
       and g.user_id = v_uid
       and not g.completed
       and g.deleted_at is null
    returning g.current_amount, g.completed, g.is_active;
  if not found then
    raise exception 'Goal not found or already completed' using errcode = 'P0002';
  end if;
end;
$$;

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
  update public.goals
     set attitude = p_attitude, attitude_basis = p_basis, attitude_detected_at = now()
   where id = p_goal_id
     and user_id = v_uid
     and deleted_at is null
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

-- 5. Hard-delete guard (soft-delete via UPDATE is always allowed) ------------
create or replace function public.check_goal_deletion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.current_amount > 0 and old.deleted_at is null then
    raise exception 'Cannot hard-delete a goal that has funds allocated to it (current_amount > 0). Soft-delete the goal instead.';
  end if;

  return old;
end;
$$;

revoke execute on function public.check_goal_deletion() from public, anon, authenticated;
grant execute on function public.check_goal_deletion() to postgres, service_role;

drop trigger if exists trg_check_goal_deletion on public.goals;
create trigger trg_check_goal_deletion
  before delete on public.goals
  for each row
  execute function public.check_goal_deletion();

-- 6. Admin telemetry: exclude soft-deleted goals from active counts ----------
create or replace function public.get_admin_telemetry()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_jwt jsonb := coalesce(auth.jwt(), '{}'::jsonb);
  v_jwt_role text := coalesce(v_jwt ->> 'role', current_setting('request.jwt.claim.role', true), '');
  v_app_role text := coalesce((v_jwt -> 'app_metadata') ->> 'role', '');
  v_platform jsonb;
  v_buck_ai jsonb;
  v_security jsonb;
begin
  if v_jwt_role <> 'service_role'
     and not (session_user in ('postgres', 'supabase_admin') and v_jwt_role = '')
     and (v_app_role <> 'admin' or not private.mfa_satisfied()) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'total_users', (select count(*) from public.profiles),
    'mfa_enabled_users', (
      select count(distinct f.user_id)
        from auth.mfa_factors f
       where f.status = 'verified'
    ),
    'connected_oauth_apps', (select count(*) from public.oauth_app_grants),
    'pending_deletions', (
      select count(*)
        from public.account_deletion_requests
       where canceled_at is null
    ),
    'total_wallets', (select count(*) from public.wallets where deleted_at is null),
    'total_expenses', (select count(*) from public.expenses),
    'total_incomes', (select count(*) from public.incomes),
    'total_goals', (select count(*) from public.goals where deleted_at is null),
    'active_goals', (select count(*) from public.goals where deleted_at is null and completed = false),
    'completed_goals', (select count(*) from public.goals where deleted_at is null and completed = true),
    'total_categories', (select count(*) from public.categories),
    'total_feedback', (select count(*) from public.feedback),
    'hashed_feedback', (
      select count(*)
        from public.feedback
       where user_email ~ '^[0-9a-f]{64}$'
    )
  ) into v_platform;

  select jsonb_build_object(
    'advisories_total', (select count(*) from public.ai_advisories),
    'advisories_24h', (
      select count(*)
        from public.ai_advisories
       where created_at > now() - interval '24 hours'
    ),
    'advisories_7d', (
      select count(*)
        from public.ai_advisories
       where created_at > now() - interval '7 days'
    ),
    'advisories_gemini', (
      select count(*)
        from public.ai_advisories
       where coalesce(
         metadata ->> 'generated_with',
         case
           when model_name in ('rules', 'buck-rule-advisor') then 'rules'
           when model_name ilike 'gemini%' then 'gemini'
           when model_name ilike 'openai/gpt-oss%' or model_name ilike '%-versatile' or model_name ilike '%-instant' then 'groq'
           else 'other'
         end
       ) = 'gemini'
    ),
    'advisories_rules', (
      select count(*)
        from public.ai_advisories
       where coalesce(
         metadata ->> 'generated_with',
         case
           when model_name in ('rules', 'buck-rule-advisor') then 'rules'
           when model_name ilike 'gemini%' then 'gemini'
           when model_name ilike 'openai/gpt-oss%' or model_name ilike '%-versatile' or model_name ilike '%-instant' then 'groq'
           else 'other'
         end
       ) = 'rules'
    ),
    'advisories_groq', (
      select count(*)
        from public.ai_advisories
       where coalesce(
         metadata ->> 'generated_with',
         case
           when model_name in ('rules', 'buck-rule-advisor') then 'rules'
           when model_name ilike 'gemini%' then 'gemini'
           when model_name ilike 'openai/gpt-oss%' or model_name ilike '%-versatile' or model_name ilike '%-instant' then 'groq'
           else 'other'
         end
       ) = 'groq'
    ),
    'advisories_ai', (
      select count(*)
        from public.ai_advisories
       where coalesce(
         metadata ->> 'generated_with',
         case
           when model_name in ('rules', 'buck-rule-advisor') then 'rules'
           when model_name ilike 'gemini%' then 'gemini'
           when model_name ilike 'openai/gpt-oss%' or model_name ilike '%-versatile' or model_name ilike '%-instant' then 'groq'
           else 'other'
         end
       ) <> 'rules'
    ),
    'advisories_other', (
      select count(*)
        from public.ai_advisories
       where coalesce(
         metadata ->> 'generated_with',
         case
           when model_name in ('rules', 'buck-rule-advisor') then 'rules'
           when model_name ilike 'gemini%' then 'gemini'
           when model_name ilike 'openai/gpt-oss%' or model_name ilike '%-versatile' or model_name ilike '%-instant' then 'groq'
           else 'other'
         end
       ) = 'other'
    ),
    'avg_health_score', (
      select coalesce(round(avg(financial_health_score)::numeric, 1), 0)
        from public.ai_advisories
       where financial_health_score is not null
    ),
    'forecasts_total', (select count(*) from public.ai_forecasts),
    'forecasts_active', (
      select count(*)
        from public.ai_forecasts
       where expires_at is null or expires_at > now()
    ),
    'usage_24h', jsonb_build_object(
      'total', (select count(*) from public.ai_usage_events where created_at > now() - interval '24 hours'),
      'chat', (select count(*) from public.ai_usage_events where bucket = 'chat' and created_at > now() - interval '24 hours'),
      'insight', (select count(*) from public.ai_usage_events where bucket = 'insight' and created_at > now() - interval '24 hours'),
      'tip', (select count(*) from public.ai_usage_events where bucket = 'tip' and created_at > now() - interval '24 hours'),
      'categorize', (select count(*) from public.ai_usage_events where bucket = 'categorize' and created_at > now() - interval '24 hours')
    ),
    'model_breakdown', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'model_name', m.model_name,
          'count', m.cnt,
          'last_used_at', m.last_used_at
        )
        order by m.cnt desc, m.last_used_at desc
      )
      from (
        select
          model_name,
          count(*) as cnt,
          max(created_at) as last_used_at
        from public.ai_advisories
        group by model_name
      ) m
    ), '[]'::jsonb),
    'priority_breakdown', jsonb_build_object(
      'low', (select count(*) from public.ai_advisories where priority = 'low'),
      'medium', (select count(*) from public.ai_advisories where priority = 'medium'),
      'high', (select count(*) from public.ai_advisories where priority = 'high'),
      'urgent', (select count(*) from public.ai_advisories where priority = 'urgent')
    ),
    'recent_advisories', coalesce((
      select jsonb_agg(row_to_json(r)::jsonb)
      from (
        select
          a.id,
          a.advisory_type,
          a.priority,
          a.model_name,
          a.generated_by,
          coalesce(
            a.metadata ->> 'generated_with',
            case
              when a.model_name in ('rules', 'buck-rule-advisor') then 'rules'
              when a.model_name ilike 'gemini%' then 'gemini'
              when a.model_name ilike 'openai/gpt-oss%' or a.model_name ilike '%-versatile' or a.model_name ilike '%-instant' then 'groq'
              else 'other'
            end
          ) as generated_with,
          coalesce(a.metadata ->> 'focus', 'general') as focus,
          a.financial_health_score,
          pg_catalog.substr(
            pg_catalog.encode(
              pg_catalog.sha256(pg_catalog.convert_to(a.user_id::text, 'UTF8')),
              'hex'
            ),
            1,
            12
          ) as user_hash,
          a.created_at
        from public.ai_advisories a
        order by a.created_at desc
        limit 40
      ) r
    ), '[]'::jsonb),
    'recent_usage_events', coalesce((
      select jsonb_agg(row_to_json(u)::jsonb)
      from (
        select
          e.id,
          e.bucket,
          pg_catalog.substr(
            pg_catalog.encode(
              pg_catalog.sha256(pg_catalog.convert_to(e.user_id::text, 'UTF8')),
              'hex'
            ),
            1,
            12
          ) as user_hash,
          e.created_at
        from public.ai_usage_events e
        order by e.created_at desc
        limit 50
      ) u
    ), '[]'::jsonb),
    'recent_forecasts', coalesce((
      select jsonb_agg(row_to_json(f)::jsonb)
      from (
        select
          fc.id,
          fc.period_type,
          fc.model_name,
          fc.generated_by,
          fc.confidence_score,
          pg_catalog.substr(
            pg_catalog.encode(
              pg_catalog.sha256(pg_catalog.convert_to(fc.user_id::text, 'UTF8')),
              'hex'
            ),
            1,
            12
          ) as user_hash,
          fc.created_at
        from public.ai_forecasts fc
        order by fc.created_at desc
        limit 25
      ) f
    ), '[]'::jsonb)
  ) into v_buck_ai;

  select jsonb_build_object(
    'total_30d', (select count(*) from public.auth_security_events),
    'rate_limited_30d', (
      select count(*)
        from public.auth_security_events
       where outcome = 'rate_limited'
    ),
    'recent_events', coalesce((
      select jsonb_agg(row_to_json(s)::jsonb)
      from (
        select
          se.id,
          se.event_type,
          se.outcome,
          pg_catalog.substr(coalesce(se.ip_hash, ''), 1, 12) as ip_hash,
          case
            when se.user_id is not null then pg_catalog.substr(
              pg_catalog.encode(
                pg_catalog.sha256(pg_catalog.convert_to(se.user_id::text, 'UTF8')),
                'hex'
              ),
              1,
              12
            )
            when se.email_hash is not null then pg_catalog.substr(se.email_hash, 1, 12)
            else 'anonymous'
          end as actor_hash,
          se.created_at
        from public.auth_security_events se
        order by se.created_at desc
        limit 40
      ) s
    ), '[]'::jsonb)
  ) into v_security;

  return jsonb_build_object(
    'generated_at', now(),
    'platform', v_platform,
    'buck_ai', v_buck_ai,
    'security', v_security
  );
end;
$$;

comment on function public.get_admin_telemetry() is
  'Returns privacy-preserving platform health, Buck_AI telemetry, and anonymized operational logs for Super Admins.';

revoke execute on function public.get_admin_telemetry() from public, anon;
grant execute on function public.get_admin_telemetry() to authenticated, service_role;

commit;
