-- Migration: strict_deletions.sql
-- Enforces strict backend checks for deletions across the platform.

BEGIN;

-- 1. Prevent Soft and Hard Deletions of Wallets with a Budget > 0
CREATE OR REPLACE FUNCTION public.check_wallet_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If hard deleting
  IF TG_OP = 'DELETE' THEN
    IF OLD.budget > 0 THEN
      RAISE EXCEPTION 'Cannot delete a wallet that still has a budget. Please empty it first.';
    END IF;
  END IF;

  -- If soft deleting
  IF TG_OP = 'UPDATE' THEN
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
      IF OLD.budget > 0 THEN
        RAISE EXCEPTION 'Cannot delete a wallet that still has a budget. Please empty it first.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_wallet_deletion ON public.wallets;
CREATE TRIGGER trg_check_wallet_deletion
  BEFORE DELETE OR UPDATE ON public.wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.check_wallet_deletion();


-- 2. Prevent Deletion of Categories that are currently in use
CREATE OR REPLACE FUNCTION public.check_category_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.expenses
    WHERE category_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'Cannot delete a category that is currently used in expenses.';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_category_deletion ON public.categories;
CREATE TRIGGER trg_check_category_deletion
  BEFORE DELETE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.check_category_deletion();


-- 3. Prevent Deletion of Goals with a current_amount > 0
CREATE OR REPLACE FUNCTION public.check_goal_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.current_amount > 0 THEN
    RAISE EXCEPTION 'Cannot delete a goal that has funds allocated to it (current_amount > 0).';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_goal_deletion ON public.goals;
CREATE TRIGGER trg_check_goal_deletion
  BEFORE DELETE ON public.goals
  FOR EACH ROW
  EXECUTE FUNCTION public.check_goal_deletion();

COMMIT;
