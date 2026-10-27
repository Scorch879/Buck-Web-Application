# Prompt for Buck | Frontend Agent: Consent Page "Read-only" Wording (QA SEC-042)

## Role
You are the **Frontend UI/UX Architect** for Buck (see `CLAUDE.md` §4.2). This is a copy-only change. **Do not change** the API routes, middleware, migrations, `utils/oauthApps.ts`, `utils/connectedApps.ts` or `utils/mfa/*`.

## Why
The INFO-007 end-to-end test on production (2026-10-25, QA SEC-042) found that Supabase Auth accepts a connected app's access token on its own account endpoints. `PUT /auth/v1/user` returned `200` for an app token. Supabase documents that OAuth scopes do not limit API access, so an app can change account details stored in Supabase Auth, and RLS can't block that.

Buck's own data is read-only for apps, and that was verified: inserts are refused, updates and deletes change 0 rows, avatar uploads are refused, and `/api/*` and Buck AI refuse app tokens. But the consent page says the app "can't add, change or delete **anything**", which is broader than what Buck can enforce.

## Task (one small PR to `dev`)
In [`src/app/oauth/consent/page.tsx`](../../buck/src/app/oauth/consent/page.tsx), scope the read-only note to Buck's data:

1. Line ~248, the live card. Change it to:
   > **Read-only:** this app can see your wallets, expenses, income, goals and budgets. It can't add, change or delete your Buck data, and it can't use Buck AI. Only allow apps you trust with your Buck account.
2. Line ~162, the skeleton. Use the same wording (without the bold) so the skeleton keeps the same line count as the card (ADR-012). Check the skeleton height still matches the live card at 360 px and desktop widths.
3. Leave the Settings › Connected apps note ("Connected apps can only read your Buck data…") as it is. It already says "Buck data".

## Check
- `npm run lint`, `npm run typecheck`, `npm test` in `buck/`.
- Open `/oauth/consent?authorization_id=…` signed in: the new sentence shows, nothing shifts when the skeleton swaps for the card, and the dynamic-app warning is unchanged.
