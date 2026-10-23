# Prompt for Buck | Frontend Agent: Two-Factor Authentication UI (ADR-048)

## Role
You are the **Frontend UI/UX Architect** for Buck (see `CLAUDE.md` §4.2). You own the Next.js web UI only. The backend for two-factor authentication (2FA) is finished and merged via PR #202 (`maintenance-branch` → `dev`). **Do not change** the API routes, middleware, migrations or `utils/mfa/*`; if you need a backend change, write it up for the Backend Agent instead.

## Task
Build the web screens that let users turn on optional 2FA with an authenticator app (Aegis, Google Authenticator, 1Password, etc.), manage backup codes and passkeys, and pass the 2FA check after signing in.

Ship it in one PR to `dev`. Coordinate the release with the Flutter team: the mobile verify screen must ship at the same time, because once a user enrolls, the database returns no data to any session that has not entered the code.

## How the backend behaves (read before designing)
- **The rule:** a session passes 2FA when it is `aal2` (the user entered a code this session) **or** the user has no verified authenticator. Users without 2FA see no change.
- **Passkey sign-in does not pass 2FA.** A 2FA user who signs in with a passkey still enters the 6-digit code. Do not skip `/verify-2fa` after a passkey sign-in.
- An unsatisfied session is already redirected server-side to `/verify-2fa?redirectTo=<path>` (middleware, dashboard layout, `/auth/callback`). Any `/api/*` call returns `401 { error: "mfa_required", message }`. Buck_AI returns `403` with header `X-Buck-Error: mfa_required`. RLS returns empty data, so never render a dashboard for an unsatisfied session.
- Admins may be redirected to `/dashboard/settings?tab=security&enroll=2fa` when `ADMIN_REQUIRE_MFA=true`; admin APIs return `403 { error: "mfa_enrollment_required" }`.
- Every MFA route returns `Cache-Control: no-store`; errors are `{ error: string }`, rate limits are `429` with a `Retry-After` header.

### Supabase SDK calls (client-side, `@/utils/supabase` browser client, already has `experimental: { passkey: true }`)
| Action | Call |
|---|---|
| Start enroll | `supabase.auth.mfa.enroll({ factorType: "totp", friendlyName })` → `data.totp.qr_code` (SVG data URL), `data.totp.secret`, `data.id` |
| Confirm enroll / sign-in code | `supabase.auth.mfa.challengeAndVerify({ factorId, code })` |
| Current level | `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` → `{ currentLevel, nextLevel }` |
| Remove an app | `supabase.auth.mfa.unenroll({ factorId })` (needs aal2) |
| Passkeys | `supabase.auth.registerPasskey()`, `supabase.auth.signInWithPasskey()`, `supabase.auth.passkey.list/update/delete` (experimental, verify the exact names in supabase-js 2.106) |

After any server route that removes 2FA (backup code, email recovery), call `supabase.auth.refreshSession()` and then `router.refresh()`.

### Backend routes (same-origin fetch, cookies included)
| Route | Use | Success body |
|---|---|---|
| `GET /api/auth/mfa/status` | Load the Security section and the verify page | `{ currentLevel, satisfied, enabled, factors: [{ id, friendlyName, createdAt }], recoveryCodesLeft, emailRecovery: null \| { state: "awaiting_email", expiresAt } \| { state: "scheduled", availableAt } }` |
| `POST /api/auth/mfa/recovery-codes` | Right after enroll succeeds, and "Regenerate codes" | `{ codes: string[10], message }` (shown **once**) |
| `POST /api/auth/mfa/recovery-codes/redeem` `{ code }` | "Use a backup code" on `/verify-2fa` | `{ success, message }` → 2FA is now **off**; send the user to Settings › Security to set it up again. Errors: 400 invalid, 429 after 5 wrong tries / 15 min |
| `POST /api/auth/mfa/email-recovery` | "Email me a recovery link" on `/verify-2fa` | `{ success, state: "awaiting_email" \| "scheduled", availableAt?, message }`. 429 after 3 per day |
| `POST /api/auth/mfa/email-recovery/complete` | After the 24 h safety window | `{ success, message }`; `409 { error, availableAt }` while still waiting |
| `DELETE /api/auth/mfa/email-recovery` | "Cancel recovery" banner in Settings (needs a 2FA session) | `{ success, message }` |
| `POST /api/account/deletion/request` | Existing account deletion | New: `403 { error: "mfa_step_up_required", message }` when a 2FA user hasn't entered a code in the last 10 minutes |

The email link lands on `/account/mfa/recover/confirm`, which redirects to `/verify-2fa?emailRecovery=scheduled | invalid-link | link-expired | failed | not-configured`, or to `/sign-in?reason=mfa-recovery-sign-in-required` when signed out.

## Screens to build

### 1. `/verify-2fa` page (new, `buck/src/app/verify-2fa/`)
- 6-digit code input (`inputMode="numeric"`, `autoComplete="one-time-code"`, paste-friendly, auto-submit on 6 digits). Uses the first verified factor; if there are 2, let the user pick by friendly name with `@/component/CustomSelect`.
- On success: `router.replace(redirectTo)`. Only accept a `redirectTo` that starts with `/` and not `//`; default `/dashboard/home`.
- Secondary links: **Use a backup code** (input `XXXXX-XXXXX`, case-insensitive) and **Email me a recovery link**.
- Read `?emailRecovery=` and show the matching message. When `status.emailRecovery.state === "scheduled"`, show the time it unlocks (`availableAt`, local time) and a **Finish recovery** button that is enabled only after that time.
- A **Sign out** link (`/api/auth/sign-out`).
- Add a 1:1 skeleton in `DashboardSkeletons.tsx` or a page `loading.tsx` (ADR-012).

### 2. Settings › Security › "Two-factor authentication" (`buck/src/app/dashboard/settings/page.tsx`, the existing `security` tab)
- Off state: short explanation plus **Turn on**.
- Enroll flow in a modal (bounds `width: min(880px, 100%)`, `max-height: min(82dvh, 760px)`): name the app → show QR **and** the secret as copyable text (Aegis users often type it) → enter the 6-digit code → call `POST recovery-codes` and show the 10 codes once with **Copy** and **Download .txt**, plus a "I saved these" checkbox before closing.
- On state: list the authenticator apps (max 2; offer **Add a second app**), backup codes left (`recoveryCodesLeft`, warn at ≤ 3), **Regenerate codes**.
- Removing an app uses **`@/component/DangerDeleteDialog` (ADR-041)**: slide, "I understand", type the app's name. Removing the last app turns 2FA off; say so in the warning.
- If `emailRecovery` is set, show a red-tinted banner: "Someone asked to remove 2FA by email. It will be removed at <time>." with **Cancel recovery** (`DELETE /api/auth/mfa/email-recovery`).
- Support `?tab=security&enroll=2fa` (open the tab and start the enroll flow). The page does not read `tab` from the URL today.

### 3. Settings › Security › "Passkeys"
- **Add a passkey** (`registerPasskey`), list with rename, delete via DangerDeleteDialog.
- Copy: "Passkeys let you sign in without a password. If two-factor is on, you'll still enter your code."
- Hide the section with a note if the passkey API is missing or throws "not enabled".

### 4. Sign-in page (`buck/src/app/sign-in/page.tsx`)
- Add **Sign in with a passkey** (`signInWithPasskey`), and `autoComplete="username webauthn"` on the email field.
- After `signInUser` / passkey sign-in succeeds, check `getAuthenticatorAssuranceLevel()`; if `nextLevel === "aal2" && currentLevel === "aal1"`, go to `/verify-2fa?redirectTo=…` instead of the dashboard.
- Handle `?reason=mfa-recovery-sign-in-required` with a short notice.

### 5. Global handling
- One place (fetch wrapper or `FinancialProvider` error path) that turns `401 mfa_required` or `X-Buck-Error: mfa_required` into a redirect to `/verify-2fa?redirectTo=<current path>`. Check `AuthGuard.tsx` and `SessionManager.tsx` so they don't fight that redirect.
- Account deletion in Settings: on `403 mfa_step_up_required`, ask for the code inline (`challengeAndVerify`), then retry the request.

## Rules to follow
- Dropdowns: `@/component/CustomSelect` only (ADR-040). Deletes: `DangerDeleteDialog` only (ADR-041). Toasts: `toast.*` from the toaster (ADR-011), never `alert()`.
- Brand tokens from `globals.css`; typography per ADR-013; skeleton parity per ADR-012; works in light and dark.
- Accessible: labelled inputs, error text tied with `aria-describedby`, focus moves to the code field, ESLint `jsx-a11y` clean.
- No `any`; type every response above as an interface.
- Never log, store or put backup codes or secrets in URLs or `localStorage`.

## Done when
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` all pass.
- Manual run on localhost with a test account: enroll → sign out → sign in → `/verify-2fa` → code → dashboard; redeem a backup code; regenerate codes; remove an app via the three-step dialog; passkey add and sign-in (still asks for the code when 2FA is on); account deletion asks for a fresh code.
- Screenshots of each screen in light and dark, and at phone width.
- `Design.md` (ADR-048 UI notes), `Skills.md` and `Implementation.md` updated; any defects found in the backend logged in `QA_Report.md` for the Backend Agent.
