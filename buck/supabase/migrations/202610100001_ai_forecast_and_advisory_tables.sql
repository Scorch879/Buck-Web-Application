-- Migration: 202610100001_ai_forecast_and_advisory_tables.sql
-- Description: Introduces persistent tables for AI Forecasts and AI Advisories with strict RLS,
-- ownership validation triggers, performance indexes, and automatic timestamp management.

BEGIN;

-- ==============================================================================
-- 1. CREATE AI FORECASTS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.ai_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
    wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL,
    period_type TEXT NOT NULL DEFAULT 'monthly' CHECK (period_type IN ('weekly', 'monthly', 'quarterly', 'custom')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    projected_spending NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (projected_spending >= 0),
    projected_savings NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    ai_recommended_budget NUMERIC(14, 2) CHECK (ai_recommended_budget IS NULL OR ai_recommended_budget >= 0),
    daily_forecast JSONB NOT NULL DEFAULT '{}'::jsonb,
    actual_spending_snapshot NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (actual_spending_snapshot >= 0),
    summary TEXT NOT NULL DEFAULT '',
    warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
    confidence_score NUMERIC(4, 2) CHECK (confidence_score IS NULL OR (confidence_score >= 0.0 AND confidence_score <= 1.0)),
    model_name TEXT NOT NULL DEFAULT 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    generated_by TEXT NOT NULL DEFAULT 'on_demand' CHECK (generated_by IN ('on_demand', 'cron', 'system')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ,
    CONSTRAINT ai_forecasts_dates_valid CHECK (period_end >= period_start)
);

-- ==============================================================================
-- 2. CREATE AI ADVISORIES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.ai_advisories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL,
    goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    advisory_type TEXT NOT NULL CHECK (
        advisory_type IN (
            'daily_tip',
            'weekly_review',
            'monthly_strategy',
            'category_alert',
            'goal_recommendation',
            'emergency_warning'
        )
    ),
    title TEXT NOT NULL DEFAULT 'Financial Advisory',
    suggestion TEXT NOT NULL DEFAULT '',
    advice TEXT NOT NULL DEFAULT '',
    financial_health_score INTEGER CHECK (financial_health_score IS NULL OR (financial_health_score BETWEEN 0 AND 100)),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    is_read BOOLEAN NOT NULL DEFAULT false,
    is_dismissed BOOLEAN NOT NULL DEFAULT false,
    model_name TEXT NOT NULL DEFAULT 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    generated_by TEXT NOT NULL DEFAULT 'on_demand' CHECK (generated_by IN ('on_demand', 'cron', 'system')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    valid_until TIMESTAMPTZ
);

-- ==============================================================================
-- 3. UPDATED_AT TRIGGERS
-- ==============================================================================
DROP TRIGGER IF EXISTS set_ai_forecasts_updated_at ON public.ai_forecasts;
CREATE TRIGGER set_ai_forecasts_updated_at
  BEFORE UPDATE ON public.ai_forecasts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_ai_advisories_updated_at ON public.ai_advisories;
CREATE TRIGGER set_ai_advisories_updated_at
  BEFORE UPDATE ON public.ai_advisories
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ==============================================================================
-- 4. RELATION OWNERSHIP VALIDATION TRIGGERS
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.ensure_ai_forecast_relations_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.goal_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.goals
      WHERE id = NEW.goal_id AND user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Goal does not belong to the forecast owner.';
    END IF;
  END IF;

  IF NEW.wallet_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.wallets
      WHERE id = NEW.wallet_id AND user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Wallet does not belong to the forecast owner.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_forecasts_check_owner ON public.ai_forecasts;
CREATE TRIGGER ai_forecasts_check_owner
  BEFORE INSERT OR UPDATE ON public.ai_forecasts
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_ai_forecast_relations_owner();

CREATE OR REPLACE FUNCTION public.ensure_ai_advisory_relations_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.goal_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.goals
      WHERE id = NEW.goal_id AND user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Goal does not belong to the advisory owner.';
    END IF;
  END IF;

  IF NEW.wallet_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.wallets
      WHERE id = NEW.wallet_id AND user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Wallet does not belong to the advisory owner.';
    END IF;
  END IF;

  IF NEW.category_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.categories
      WHERE id = NEW.category_id AND user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Category does not belong to the advisory owner.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_advisories_check_owner ON public.ai_advisories;
CREATE TRIGGER ai_advisories_check_owner
  BEFORE INSERT OR UPDATE ON public.ai_advisories
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_ai_advisory_relations_owner();

REVOKE EXECUTE ON FUNCTION public.ensure_ai_forecast_relations_owner() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_ai_advisory_relations_owner() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_ai_forecast_relations_owner() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_ai_advisory_relations_owner() TO postgres, service_role;

-- ==============================================================================
-- 5. PERFORMANCE INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS ai_forecasts_user_period_idx
  ON public.ai_forecasts(user_id, period_type, period_start DESC);

CREATE INDEX IF NOT EXISTS ai_forecasts_user_created_idx
  ON public.ai_forecasts(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_advisories_user_active_idx
  ON public.ai_advisories(user_id, is_dismissed, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_advisories_user_type_idx
  ON public.ai_advisories(user_id, advisory_type);

-- ==============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.ai_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_advisories ENABLE ROW LEVEL SECURITY;

-- 6a. ai_forecasts
DROP POLICY IF EXISTS "AI forecasts are manageable by owner" ON public.ai_forecasts;
CREATE POLICY "AI forecasts are manageable by owner"
  ON public.ai_forecasts
  FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role manages ai_forecasts" ON public.ai_forecasts;
CREATE POLICY "Service role manages ai_forecasts"
  ON public.ai_forecasts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 6b. ai_advisories
DROP POLICY IF EXISTS "AI advisories are manageable by owner" ON public.ai_advisories;
CREATE POLICY "AI advisories are manageable by owner"
  ON public.ai_advisories
  FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role manages ai_advisories" ON public.ai_advisories;
CREATE POLICY "Service role manages ai_advisories"
  ON public.ai_advisories
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==============================================================================
-- 7. GRANTS
-- ==============================================================================
GRANT ALL ON TABLE public.ai_forecasts TO authenticated;
GRANT ALL ON TABLE public.ai_forecasts TO service_role;
GRANT ALL ON TABLE public.ai_advisories TO authenticated;
GRANT ALL ON TABLE public.ai_advisories TO service_role;

COMMIT;
