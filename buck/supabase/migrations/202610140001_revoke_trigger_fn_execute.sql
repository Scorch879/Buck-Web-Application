-- ensure_income_wallet_owner() was re-created by 202610130002 and lost the
-- REVOKE from 202606140001, leaving EXECUTE open to PUBLIC/anon/authenticated.
-- It is a trigger function only; nothing should call it over the API.
--
-- Down:
--   grant execute on function public.ensure_income_wallet_owner() to public, anon, authenticated;

revoke execute on function public.ensure_income_wallet_owner() from public, anon, authenticated;
