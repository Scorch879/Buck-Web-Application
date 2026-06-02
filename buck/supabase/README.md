# Buck Supabase Setup

This folder contains the Supabase database setup for replacing Firebase/Firestore.

## Run Order

Run this migration first:

```sql
supabase/migrations/202606010001_initial_buck_schema.sql
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

## Security

Every app table has Row Level Security enabled. The policies only allow an authenticated user to read or mutate rows where `auth.uid()` matches the row owner.

The migration also adds ownership guard triggers so a user cannot attach another user's wallet, goal, or category to their own profile or expense by guessing an ID.

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
