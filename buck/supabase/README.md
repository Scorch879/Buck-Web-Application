# Buck Supabase Setup

This folder contains the Supabase database setup for replacing Firebase/Firestore.

## Run Order

Run these migrations in order:

```sql
supabase/migrations/202606010001_initial_buck_schema.sql
supabase/migrations/202606100001_profile_avatars.sql
supabase/migrations/202606110001_account_deletion_requests.sql
```

You can paste the file contents into the Supabase SQL Editor, or apply it later with the Supabase CLI.

## Firebase To Supabase Mapping

| Firebase path | Supabase table |
| --- | --- |
| `users/{uid}` | `profiles` |
| `users/{uid}/categories` | `categories` |
| `users/{uid}/expenses` | `expenses` |
| `wallets/{uid}/userWallets` | `wallets` |
| `goals/{uid}/userGoals` | `goals` |

## Tables

- `profiles`: one row per Supabase Auth user, plus the active wallet pointer.
- `wallets`: user-owned wallets and balances.
- `categories`: user-owned expense categories.
- `expenses`: user-owned expenses, optionally linked to a wallet, goal, and category.
- `goals`: user-owned saving goals, progress, and AI recommendation fields.
- `account_deletion_requests`: server-managed deletion confirmations and 10-day recovery windows.

## Security

Every app table has Row Level Security enabled. The policies only allow an authenticated user to read or mutate rows where `auth.uid()` matches the row owner.

The migration also adds ownership guard triggers so a user cannot attach another user's wallet, goal, or category to their own profile or expense by guessing an ID.

Account deletion requests are read-only to the account owner. Creating, confirming, recovering, and purging deletion requests must go through server routes that use `SUPABASE_SERVICE_ROLE_KEY`.

## New User Defaults

The migration creates an `auth.users` trigger. When a user signs up through Supabase Auth, it automatically:

- creates their `profiles` row
- copies their email and display name when available
- seeds Buck's default categories

## Realtime

Realtime publication is enabled for:

- `wallets`
- `categories`
- `goals`
- `expenses`

This is the Supabase equivalent of the Firestore `onSnapshot` behavior currently used by the dashboard.

## Account Deletion

The Settings page uses a soft-delete flow:

1. The user requests deletion from `/dashboard/settings`.
2. Buck verifies the current password for email/password users.
3. Buck sends a Supabase email confirmation link to the account email.
4. Clicking the link schedules deletion and starts a 10-day recovery window.
5. During the 10-day window, the user can sign in and recover from Settings.
6. After the window ends, a scheduled job can call the purge endpoint to permanently delete the Supabase Auth user and cascade owned database rows.

Required server-only environment variables:

```env
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ACCOUNT_PURGE_SECRET=use-a-long-random-secret
```

Recommended Vercel Cron target:

```txt
POST /api/account/deletion/purge
Authorization: Bearer ACCOUNT_PURGE_SECRET
```

Also make sure every deployed domain has `/auth/callback` in Supabase Auth Redirect URLs, because the deletion confirmation email returns through the normal auth callback.

## Next Code Migration Step

After the tables exist, replace Firebase with Supabase in this order:

1. Add `@supabase/supabase-js`.
2. Create `src/utils/supabase.ts`.
3. Replace auth in `src/component/authentication.tsx`.
4. Replace `useAuthGuard`.
5. Move wallet CRUD to `wallets`.
6. Move categories and expenses to `categories` and `expenses`.
7. Move goals to `goals`.
8. Remove `firebase` and `src/utils/firebase.ts` after no imports remain.
