# Buck Supabase Setup

This folder holds Buck's database schema as versioned SQL migrations. The web app, the mobile app and `Buck_AI` all use this one Supabase database.

## Run Order

Apply every file in [`migrations/`](./migrations/) in filename order (the timestamp prefix is the order). The first is `202606010001_initial_buck_schema.sql`. New migrations are added with a later timestamp, never by editing an applied one.

You can apply them with the Supabase CLI (`supabase db push`) or paste each file into the Supabase SQL Editor in order.

## Tables

All tables are in the `public` schema.

- `profiles`: one row per Supabase Auth user, plus the active wallet pointer and saving attitude.
- `wallets`: user-owned wallets and balances (soft-deleted with `deleted_at`).
- `categories`: user-owned expense and income categories (`kind`); the `Uncategorized` and `Other` fallbacks are protected.
- `expenses`: user-owned expenses, optionally linked to a wallet, goal and category.
- `incomes`: user-owned income records.
- `goals`: user-owned saving goals and progress (soft-deleted with `deleted_at`).
- `feedback`: bug reports and feature requests, readable by admins.
- `ai_advisories`, `ai_forecasts`, `ai_usage_events`: saved AI Advisor and Forecaster output and AI usage counts.
- `account_deletion_requests`: server-managed deletion confirmations and 10-day recovery windows.
- `auth_security_events`: hashed (HMAC) rate-limit events for auth e-mail actions.
- `mfa_recovery_codes`, `mfa_email_recovery_requests`: 2FA backup codes and e-mail recovery (ADR-048).
- `oauth_app_grants`: connected-app approvals (ADR-049).

## Security

Every app table has Row Level Security enabled. Policies only let an authenticated user read or change rows where `auth.uid()` matches the row owner. With 2FA on, RESTRICTIVE policies also require `private.mfa_satisfied()` (ADR-048).

Ownership guard triggers stop a user from attaching another user's wallet, goal or category to their own profile or expense by guessing an ID.

Account deletion requests are read-only to the account owner. Creating, confirming, recovering and purging them goes through server routes that use `SUPABASE_SERVICE_ROLE_KEY`.

## New User Defaults

An `auth.users` trigger runs when a user signs up. It:

- creates their `profiles` row
- copies their e-mail and display name when available
- seeds Buck's default expense and income categories

## Realtime

The `supabase_realtime` publication includes `wallets`, `categories`, `goals`, `expenses`, `incomes` and `profiles`. `FinancialProvider` listens to these to keep the dashboard cache current.

## Account Deletion

The Settings page uses a soft-delete flow:

1. The user requests deletion from `/dashboard/settings`.
2. Buck verifies the current password for e-mail/password users.
3. Buck e-mails a confirmation link to the account address.
4. Clicking the link schedules deletion and starts a 10-day recovery window.
5. During the window, the user can sign in and recover from Settings.
6. After the window ends, the purge endpoint permanently deletes the Supabase Auth user, and owned rows cascade.

The purge runs daily from Vercel Cron (`buck/vercel.json`, `POST /api/account/deletion/purge`). It accepts `Authorization: Bearer <CRON_SECRET>` (Vercel Cron) or `Bearer <ACCOUNT_PURGE_SECRET>` (manual runs).

Every deployed domain needs `/auth/callback` in Supabase Auth Redirect URLs, because the confirmation e-mail returns through the normal auth callback.

E-mail templates to paste into Supabase are in [`docs/guides/supabase/SUPABASE_EMAIL_TEMPLATES.txt`](../../docs/guides/supabase/SUPABASE_EMAIL_TEMPLATES.txt).
