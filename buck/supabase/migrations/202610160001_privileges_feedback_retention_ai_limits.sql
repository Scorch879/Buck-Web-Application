-- Security audit 2026-10-16: least privilege, feedback integrity, retention,
-- and a shared (database-backed) AI rate limiter.
--
-- 1. anon had full DML/TRUNCATE on every public table and authenticated had
--    TRUNCATE/REFERENCES/TRIGGER; RLS was the only barrier. Revoke the excess.
-- 2. feedback: length limits, and user_email must be the caller's own e-mail.
-- 3. ai_usage_events + ai_rate_limit_take(): per-user sliding window that works
--    across serverless instances (Buck_AI used a per-instance in-memory limiter).
-- 4. purge_expired_data(): retention for security events, usage events,
--    expired forecasts and old advisories (run daily by /api/account/deletion/purge).
--
-- Down:
--   drop function if exists public.purge_expired_data();
--   drop function if exists public.ai_rate_limit_take(text, integer, integer);
--   drop table if exists public.ai_usage_events;
--   alter table public.feedback drop constraint if exists feedback_title_len,
--     drop constraint if exists feedback_details_len, drop constraint if exists feedback_email_len;
--   drop policy if exists "Users can submit feedback" on public.feedback;
--   create policy "Users can submit feedback" on public.feedback for insert to authenticated
--     with check ((select auth.uid()) is not null and length(btrim(user_email)) > 0
--       and length(btrim(title)) > 0 and length(btrim(details)) > 0);
--   grant all on all tables in schema public to anon;
--   grant truncate, references, trigger on all tables in schema public to authenticated;

begin;

-- 3. AI usage events -------------------------------------------------------
create table if not exists public.ai_usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  bucket text not null check (bucket in ('chat', 'insight', 'tip', 'categorize')),
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_events_user_bucket_created_idx
  on public.ai_usage_events (user_id, bucket, created_at desc);

alter table public.ai_usage_events enable row level security;

-- Select + insert only: a user cannot delete their own events to reset the limit.
drop policy if exists "AI usage readable by owner" on public.ai_usage_events;
create policy "AI usage readable by owner" on public.ai_usage_events
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "AI usage insertable by owner" on public.ai_usage_events;
create policy "AI usage insertable by owner" on public.ai_usage_events
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- Returns 0 when allowed (and records the call), otherwise seconds to wait.
create or replace function public.ai_rate_limit_take(
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
  v_oldest timestamptz;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 1000
     or p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 3600 then
    raise exception 'Invalid rate limit arguments' using errcode = '22023';
  end if;

  -- Serialise concurrent calls for the same user and bucket.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || p_bucket, 0));

  select count(*), min(created_at)
    into v_count, v_oldest
    from public.ai_usage_events
   where user_id = v_uid
     and bucket = p_bucket
     and created_at > now() - make_interval(secs => p_window_seconds);

  if v_count >= p_limit then
    return greatest(1, ceil(extract(epoch from (v_oldest + make_interval(secs => p_window_seconds) - now())))::integer);
  end if;

  insert into public.ai_usage_events (user_id, bucket) values (v_uid, p_bucket);
  return 0;
end;
$$;

revoke execute on function public.ai_rate_limit_take(text, integer, integer) from public, anon;
grant execute on function public.ai_rate_limit_take(text, integer, integer) to authenticated;

-- 2. feedback --------------------------------------------------------------
alter table public.feedback
  drop constraint if exists feedback_title_len,
  drop constraint if exists feedback_details_len,
  drop constraint if exists feedback_email_len;
alter table public.feedback
  add constraint feedback_title_len check (char_length(title) <= 200),
  add constraint feedback_details_len check (char_length(details) <= 5000),
  add constraint feedback_email_len check (char_length(user_email) <= 254);

drop policy if exists "Users can submit feedback" on public.feedback;
create policy "Users can submit feedback" on public.feedback
  for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and length(btrim(user_email)) > 0
    and length(btrim(title)) > 0
    and length(btrim(details)) > 0
    and lower(user_email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  );

-- 4. Retention -------------------------------------------------------------
create or replace function public.purge_expired_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_events integer;
  v_usage integer;
  v_forecasts integer;
  v_advisories integer;
begin
  delete from public.auth_security_events where created_at < now() - interval '30 days';
  get diagnostics v_events = row_count;

  delete from public.ai_usage_events where created_at < now() - interval '1 day';
  get diagnostics v_usage = row_count;

  delete from public.ai_forecasts where expires_at is not null and expires_at < now() - interval '30 days';
  get diagnostics v_forecasts = row_count;

  -- Keep each user's newest 50 advisories (history shows 20).
  delete from public.ai_advisories a
   using (
     select id, row_number() over (partition by user_id order by created_at desc) as rn
       from public.ai_advisories
   ) r
   where a.id = r.id and r.rn > 50;
  get diagnostics v_advisories = row_count;

  return jsonb_build_object(
    'security_events', v_events, 'usage_events', v_usage,
    'forecasts', v_forecasts, 'advisories', v_advisories
  );
end;
$$;

revoke execute on function public.purge_expired_data() from public, anon, authenticated;
grant execute on function public.purge_expired_data() to service_role;

-- 1. Least privilege (after all tables exist, so the new table is covered) --
revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
alter default privileges in schema public revoke all on tables from anon;

commit;
