# Prompt for Buck | Frontend Agent: Connected Apps UI (ADR-049)

## Role
You are the **Frontend UI/UX Architect** for Buck (see `CLAUDE.md` §4.2). You own the Next.js web UI only. The backend for connected apps (Supabase OAuth 2.1 server) is finished on `maintenance-branch`. **Do not change** the API routes, middleware, migrations, `utils/oauthApps.ts` or `utils/mfa/*`. If you need a backend change, write it up for the Backend Agent instead.

## Task
Build two screens:
1. **`/oauth/consent`**: the page where a user lets another app (an AI agent or MCP client, one of our own apps, or a third-party app) read their Buck data, or says no.
2. **Settings › "Connected apps"**: a list of apps the user has allowed, each with a way to disconnect it.

Ship it in one PR to `dev`.

## How the backend behaves (read before designing)
- An app sends the user to `https://<site>/oauth/consent?authorization_id=<id>`. Middleware already makes sure the user is signed in, has passed 2FA and is not idle. It sends signed-out users to `/sign-in?redirectTo=...`, and the user comes back here after signing in. The page never needs to handle the signed-out case itself.
- **Connected apps can only read.** The database blocks every write from an app token, so the screen must say "read-only" plainly.
- **Self-registered apps.** `registration: "dynamic"` means the app registered itself (MCP clients do this) and Buck has not reviewed it. Show a warning. `"manual"` means the Buck team registered it. `"unknown"` means the lookup failed; treat it like `"dynamic"`.
- Always show `redirectHost`. Look-alike apps stand out by the host they send the user back to.
- A user with 2FA who approves here is recorded as verified. Approving through Supabase directly would not work for them. Always use the Buck routes below, never `supabase.auth.oauth.approveAuthorization` in the browser.
- Errors look like `{ error: string }`. Every response has `Cache-Control: no-store`. A `401 { error: "mfa_required" }` should not happen because middleware handles it first; if it does, send the user to `/verify-2fa?redirectTo=<current URL>`.

### Backend routes (same-origin fetch, cookies included, **no** Authorization header)
| Route | Use | Success body |
|---|---|---|
| `GET /api/oauth/authorizations/<authorization_id>` | Load the consent screen | `{ state: "consent", authorizationId, app: { id, name, website, logoUrl, registration }, redirectUri, redirectHost, scopes: string[], access: "read-only" }`, or `{ state: "redirect", redirectUrl }` when the user already approved this app: go there straight away |
| `POST /api/oauth/authorizations/<authorization_id>/consent` body `{ decision: "approve" \| "deny" }` | Allow / Deny buttons | `{ redirectUrl }`: then call `window.location.assign(redirectUrl)` |

Status codes: `400` means the link is bad (show "This link isn't valid"), `404` means expired or already used (show "Start again from the app"), and `500`/`502` mean show the error and offer a retry. Disable both buttons while a request is in flight, and send only one decision.

### Supabase SDK calls (Settings list, browser client `@/utils/supabase`)
| Action | Call |
|---|---|
| List connected apps | `supabase.auth.oauth.listGrants()` → `[{ client: { id, name, uri, logo_uri }, scopes, granted_at }]` |
| Disconnect | `supabase.auth.oauth.revokeGrant({ clientId })` |

Check the exact field names against `@supabase/auth-js` 2.108 (`OAuthGrant`). After disconnecting, the app stops working at once; the backend's trigger also clears Buck's record.

## Screens
### `/oauth/consent`
- A centred card that follows the auth pages' look (`sign-in` styles, brand tokens in `CLAUDE.md` §6.7). It is not inside the dashboard chrome.
- The card shows:
  - The app logo, or an initial if there is none.
  - The **app name**.
  - The website link, if there is one.
  - "wants to access your Buck account".
- A scopes list in plain words:
  - `openid` → "Confirm who you are".
  - `email` → "See your email address".
  - `profile` → "See your username and avatar".
  - `phone` → "See your phone number".
  - Any other scope is shown as it is.
- A fixed line: "**Read-only:** this app can see your wallets, expenses, income, goals and budgets. It can't add, change or delete anything, and it can't use Buck AI."
- "You'll be sent to **{redirectHost}**".
- If `registration !== "manual"`, show an amber warning (Buck Gold): "Buck hasn't reviewed this app. Only allow it if you trust it and started this yourself."
- Buttons: **Deny** (secondary) and **Allow** (primary, Buck Orange). Keyboard order is Deny then Allow, with no autofocus on Allow.
- Add a 1:1 skeleton for the loading state (ADR-012).
- Missing `authorization_id` → show the "This link isn't valid" state; don't make a request.
- If the user was signed in by another tab while this page was open, a `401` means reload the page.

### Settings › Security › "Connected apps"
- This goes after the 2FA and Passkeys sections.
- Each row shows the logo or initial, the name, the website host, "Connected {date}", the scopes, and a red "Disconnect" button (at least 36px).
- Disconnect **must** use `DangerDeleteDialog` (ADR-041). The name to type is the app name.
- After a successful disconnect, show a toast with `toast.success` and refresh the list.
- Empty state: "No apps connected. Apps you allow to read your Buck data will show here."
- Helper text: "If you turn on two-factor authentication, reconnect your apps so they keep working."
- Add a skeleton row set that matches the list (ADR-012).

## Done when
- `npm run lint`, `npm run typecheck` and `npm test` all pass.
- The consent page renders all states: loading, consent (manual), consent (dynamic warning), redirect, invalid link, expired, and error.
- Allow and Deny each send the browser to the returned `redirectUrl`.
- Disconnect works through the three-step dialog.
- Screenshots at desktop and 375px, in light and dark mode.
