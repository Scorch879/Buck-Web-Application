-- Migration: 202606140001_security_and_policy_hardening.sql
-- Hardens database security, fixes search_path vulnerabilities, resolves duplicate RLS policies,
-- removes unnecessary auth function re-evaluations, and adds missing covering indexes.

BEGIN;

-- ==============================================================================
-- 1. FIX FUNCTION SEARCH PATH MUTABILITY (function_search_path_mutable)
-- ==============================================================================
ALTER FUNCTION public.check_wallet_deletion() SET search_path = public;
ALTER FUNCTION public.check_category_deletion() SET search_path = public;
ALTER FUNCTION public.check_goal_deletion() SET search_path = public;
ALTER FUNCTION public.ensure_expense_relations_owner() SET search_path = public;
ALTER FUNCTION public.ensure_profile_active_wallet_owner() SET search_path = public;
ALTER FUNCTION public.set_updated_at() SET search_path = public;

-- ==============================================================================
-- 2. REVOKE DIRECT EXECUTE PERMISSION ON SECURITY DEFINER & TRIGGER FUNCTIONS
--    (anon_security_definer_function_executable / authenticated_security_definer_function_executable)
-- ==============================================================================
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_user_profile_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_wallet_deletion() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_category_deletion() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_goal_deletion() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_expense_relations_owner() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_profile_active_wallet_owner() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- Ensure internal roles retain execute rights
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.handle_user_profile_update() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.check_wallet_deletion() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.check_category_deletion() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.check_goal_deletion() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_expense_relations_owner() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_profile_active_wallet_owner() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO postgres, service_role;

-- ==============================================================================
-- 3. RESOLVE RLS ADVISORIES & DUPLICATE POLICIES (multiple_permissive_policies & auth_rls_initplan)
-- ==============================================================================

-- 3a. Auth Security Events (RLS Enabled No Policy fix)
DROP POLICY IF EXISTS "Service role manages auth security events" ON public.auth_security_events;
CREATE POLICY "Service role manages auth security events"
  ON public.auth_security_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3b. Categories
DROP POLICY IF EXISTS "Users can manage own categories" ON public.categories;
DROP POLICY IF EXISTS "Categories are manageable by owner" ON public.categories;
CREATE POLICY "Categories are manageable by owner"
  ON public.categories
  FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- 3c. Expenses
DROP POLICY IF EXISTS "Users can manage own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Expenses are manageable by owner" ON public.expenses;
CREATE POLICY "Expenses are manageable by owner"
  ON public.expenses
  FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- 3d. Goals
DROP POLICY IF EXISTS "Users can manage own goals" ON public.goals;
DROP POLICY IF EXISTS "Goals are manageable by owner" ON public.goals;
CREATE POLICY "Goals are manageable by owner"
  ON public.goals
  FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- 3e. Profiles
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can upsert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are readable by owner" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are insertable by owner" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are updatable by owner" ON public.profiles;

CREATE POLICY "Profiles are readable by owner"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "Profiles are insertable by owner"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "Profiles are updatable by owner"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- 3f. Wallets
DROP POLICY IF EXISTS "Users can create own wallets" ON public.wallets;
DROP POLICY IF EXISTS "Users can delete own wallets" ON public.wallets;
DROP POLICY IF EXISTS "Users can read own wallets" ON public.wallets;
DROP POLICY IF EXISTS "Users can update own wallets" ON public.wallets;
DROP POLICY IF EXISTS "Wallets are manageable by owner" ON public.wallets;

CREATE POLICY "Wallets are manageable by owner"
  ON public.wallets
  FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- 3g. Feedback
DROP POLICY IF EXISTS "Allow admin to view feedback" ON public.feedback;
DROP POLICY IF EXISTS "Admin can view all feedback" ON public.feedback;
DROP POLICY IF EXISTS "Allow admin to update feedback" ON public.feedback;
DROP POLICY IF EXISTS "Allow admin to delete feedback" ON public.feedback;
DROP POLICY IF EXISTS "Allow anyone to insert feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users can insert their own feedback." ON public.feedback;
DROP POLICY IF EXISTS "Admin can view feedback" ON public.feedback;
DROP POLICY IF EXISTS "Admin can update feedback" ON public.feedback;
DROP POLICY IF EXISTS "Admin can delete feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users can submit feedback" ON public.feedback;

CREATE POLICY "Admin can view feedback"
  ON public.feedback
  FOR SELECT
  TO authenticated
  USING (((SELECT auth.jwt()) ->> 'email') = 'buckthebudgettracker@gmail.com');

CREATE POLICY "Admin can update feedback"
  ON public.feedback
  FOR UPDATE
  TO authenticated
  USING (((SELECT auth.jwt()) ->> 'email') = 'buckthebudgettracker@gmail.com')
  WITH CHECK (((SELECT auth.jwt()) ->> 'email') = 'buckthebudgettracker@gmail.com');

CREATE POLICY "Admin can delete feedback"
  ON public.feedback
  FOR DELETE
  TO authenticated
  USING (((SELECT auth.jwt()) ->> 'email') = 'buckthebudgettracker@gmail.com');

CREATE POLICY "Users can submit feedback"
  ON public.feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND length(btrim(user_email)) > 0
    AND length(btrim(title)) > 0
    AND length(btrim(details)) > 0
  );

-- ==============================================================================
-- 4. MISSING COVERING INDEXES FOR PERFORMANCE & FOREIGN KEY INTEGRITY
-- ==============================================================================
CREATE INDEX IF NOT EXISTS expenses_wallet_id_idx ON public.expenses(wallet_id);
CREATE INDEX IF NOT EXISTS expenses_goal_id_idx ON public.expenses(goal_id);
CREATE INDEX IF NOT EXISTS expenses_category_id_idx ON public.expenses(category_id);
CREATE INDEX IF NOT EXISTS wallets_user_id_active_idx ON public.wallets(user_id) WHERE deleted_at IS NULL;

COMMIT;
