-- Name the model behind older advice in get_admin_telemetry() (2026-11-09).
--
-- Advice saved before metadata.generated_with existed fell back to 'gemini' for
-- any model that was not 'rules', so 16 cards written by
-- meta-llama/Llama-3.3-70B-Instruct-Turbo (an earlier provider) showed as
-- Gemini on the admin "Written by AI" card. The fallback now reads the model
-- name: gemini-* is Gemini, Groq's model ids are Groq, anything else is
-- 'other' (advisories_other, new key). advisories_ai now counts every card
-- that is not rules. The SEC-044 admin gate and all other keys are unchanged.
--
-- Down: re-run the function from 202611060001_admin_telemetry_groq_counts.sql.

begin;

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
  -- Allow the service role, a direct database session with no request JWT
  -- (SQL editor / migrations), or an admin whose session passed 2FA.
  -- `current_user` is the function owner inside SECURITY DEFINER, so it cannot
  -- be used here; `session_user` is `authenticator` for every API request.
  if v_jwt_role <> 'service_role'
     and not (session_user in ('postgres', 'supabase_admin') and v_jwt_role = '')
     and (v_app_role <> 'admin' or not private.mfa_satisfied()) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  -- 1. Platform & Website Health Aggregate Counts
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
    'total_goals', (select count(*) from public.goals),
    'active_goals', (select count(*) from public.goals where completed = false),
    'completed_goals', (select count(*) from public.goals where completed = true),
    'total_categories', (select count(*) from public.categories),
    'total_feedback', (select count(*) from public.feedback),
    'hashed_feedback', (
      select count(*)
        from public.feedback
       where user_email ~ '^[0-9a-f]{64}$'
    )
  ) into v_platform;

  -- 2. Buck_AI Deployment & Model Telemetry + Anonymized AI Data Logs
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

  -- 3. Security Audit Events
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
