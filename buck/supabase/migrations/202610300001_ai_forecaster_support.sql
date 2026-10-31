-- AI Forecaster (Buck_AI/BuckAI_Forecast, ADR-052) database support.
--
-- 1. ai_usage_events.bucket: allow 'forecast' so the Forecaster's rate limit
--    (shared/rate_limit.py LIMITS) is shared across Vercel instances instead
--    of falling back to each instance's local window.
-- 2. ai_forecasts / ai_advisories: model_name defaulted to a Llama model Buck
--    no longer uses (ADR-043). Rows name the Gemini model that answered, or
--    'rules'; make the default match.
--
-- Down:
--   alter table public.ai_usage_events drop constraint ai_usage_events_bucket_check;
--   alter table public.ai_usage_events add constraint ai_usage_events_bucket_check
--     check (bucket in ('chat', 'insight', 'tip', 'categorize'));  -- delete 'forecast' rows first
--   alter table public.ai_forecasts alter column model_name set default 'meta-llama/Llama-3.3-70B-Instruct-Turbo';
--   alter table public.ai_advisories alter column model_name set default 'meta-llama/Llama-3.3-70B-Instruct-Turbo';

begin;

alter table public.ai_usage_events drop constraint if exists ai_usage_events_bucket_check;
alter table public.ai_usage_events add constraint ai_usage_events_bucket_check
  check (bucket in ('chat', 'insight', 'tip', 'categorize', 'forecast'));

alter table public.ai_forecasts alter column model_name set default 'rules';
alter table public.ai_advisories alter column model_name set default 'rules';

commit;
