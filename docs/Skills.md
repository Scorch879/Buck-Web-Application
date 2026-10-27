# Skills.md: System Capabilities, Functions & API Catalog

This catalog documents the functions, tools, database interactions, API endpoints, and hooks available across the **Buck Budget Tracker Web Application**.

---

## 1. Supabase Data Layer Skills (`buck/src/utils/supabaseData.ts`)

### 1.1 Profile & Avatar Management

| Function Signature | Parameters | Return Type | Description |
|---|---|---|---|
| [`getUserProfile(userId)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L331) | `userId: string` | `Promise<BuckProfile \| null>` | Fetches user profile record from `public.profiles`. |
| [`updateUserProfileName(userId, username)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L435) | `userId: string`, `username: string` | `Promise<void>` | Updates display name in `profiles` and Supabase Auth metadata. |
| [`getUserAvatarSignedUrl(avatarPath, expiresIn)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L486) | `avatarPath: string`, `expiresIn?: number` (default 3600) | `Promise<string>` | Generates secure signed URL for private avatar image in `profile-avatars` bucket. |
| [`replaceUserAvatar(userId, file)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L506) | `userId: string`, `file: File` | `Promise<{ avatarPath: string }>` | Uploads new avatar (max 2MB, JPEG/PNG/WebP), updates profile avatar path, removes old avatars. |
| [`removeUserAvatar(userId, avatarPath)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L561) | `userId: string`, `avatarPath: string \| null` | `Promise<void>` | Deletes avatar files from storage bucket and nullifies avatar columns in profile. |
| [`listConnectedApps()`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L2322) | — | `Promise<ConnectedAppGrant[]>` | Apps the user allowed to read their data (ADR-049), via `supabase.auth.oauth.listGrants()`: `clientId`, `name`, `website`, `logoUrl` (Buck's logo proxy path or `null`, ADR-051), `scopes`, `grantedAt`. |
| [`disconnectConnectedApp(clientId)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L2344) | `clientId: string` | `Promise<void>` | Revokes a connected app's grant (`revokeGrant`); the app stops working at once and a trigger clears Buck's record. |

### 1.2 Categories Management

| Function Signature | Parameters | Return Type | Description |
|---|---|---|---|
| [`ensureDefaultCategories(userId)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L624) | `userId: string` | `Promise<BuckCategory[]>` | Seeds default 17 expense categories if none exist for user; returns sorted category list. |
| [`listCategories(userId)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L652) | `userId: string` | `Promise<BuckCategory[]>` | Fetches user categories ordered by `sort_order` and `name`. |
| [`addCategory(userId, name)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L673) | `userId: string`, `name: string` | `Promise<BuckCategory>` | Inserts a custom category for the user. |
| [`updateCategoryName(userId, categoryId, name)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L696) | `userId: string`, `categoryId: string`, `name: string` | `Promise<BuckCategory>` | Renames an existing category owned by user. |
| [`deleteCategory(userId, categoryId)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L719) | `userId: string`, `categoryId: string` | `Promise<void>` | Deletes category record (expenses retain category name or fall back to Uncategorized). |
| `listIncomeCategories(userId)` | `userId: string` | `Promise<BuckCategory[] \| null>` | Income categories (`kind = 'income'`), seeding the 7 defaults on first use; `null` until migration `202610130002` is applied (ADR-042). |
| `addCategory(userId, name, kind?)` | `name: string`, `kind: 'expense' \| 'income'` (default `'expense'`) | `Promise<BuckCategory>` | Adds a custom category of the given kind; duplicate names (per kind) throw a readable error. |
| `renameCategory(userId, category, newName)` | `category: BuckCategory`, `newName: string` | `Promise<void>` | Renames and copies the name onto `expenses.category_name` / `incomes.source`. |
| `deleteCategoryAndReassign(userId, category, fallback)` | `category`, `fallback: BuckCategory \| null` | `Promise<number>` | Moves the category's items to `Uncategorized` / `Other`, deletes it, returns the number of items moved. |
| `listUncategorizedExpenses(userId)` / `listUncategorizedIncomes(userId, incomeCategories)` | `userId`, income categories | `Promise<BuckExpense[]>` / `Promise<BuckIncome[]>` | Items still in the fallback bucket (input for AI auto-categorize). |
| `setExpenseCategory(userId, expenseId, category)` / `setIncomeCategory(userId, incomeId, name)` | ids + target category | `Promise<void>` | Re-files one item (used by AI auto-categorize). |
| `categorizeItem(kind, description, categories)` (`utils/aiApi.ts`) | `kind`, `description`, user category names | `Promise<string \| null>` | Asks `/ai/categorize_expense/` for a category and accepts only a name from the user's list. |

### 1.3 Wallets Management

| Function Signature | Parameters | Return Type | Description |
|---|---|---|---|
| [`listWallets(userId)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L1091) | `userId: string` | `Promise<BuckWallet[]>` | Returns all wallets (including soft-deleted) ordered by creation date descending. |
| [`getActiveWalletId(userId)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L1111) | `userId: string` | `Promise<string \| null>` | Queries `profiles.active_wallet_id` for current user. |
| [`setActiveWallet(userId, walletId)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L1131) | `userId: string`, `walletId: string \| null` | `Promise<void>` | Updates `profiles.active_wallet_id`. |
| [`getActiveWallet(userId)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L1154) | `userId: string` | `Promise<BuckWallet \| null>` | Resolves active wallet object if valid and not soft-deleted. |
| [`addWallet(userId, name, budget)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L1176) | `userId: string`, `name: string`, `budget: number` | `Promise<BuckWallet>` | Inserts new wallet record; sets as active if first wallet. |
| [`updateWallet(userId, walletId, name, budget)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L1211) | `userId: string`, `walletId: string`, `name: string`, `budget: number` | `Promise<BuckWallet>` | Updates wallet name and budget amount. |
| [`deleteWallet(userId, walletId)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L1237) | `userId: string`, `walletId: string` | `Promise<void>` | Soft deletes wallet by setting `deleted_at = now()`. |

### 1.4 Goals Management

| Function Signature | Parameters | Return Type | Description |
|---|---|---|---|
| [`listGoals(userId)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L873) | `userId: string` | `Promise<BuckGoal[]>` | Retrieves user financial goals ordered by `created_at desc`. |
| [`createGoalRecord(userId, goal)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L895) | `userId: string`, `goal: Partial<BuckGoal>` | `Promise<BuckGoal>` | Inserts savings goal (handles single active goal enforcement). |
| [`deleteGoalRecord(goalId)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L943) | `goalId: string` | `Promise<void>` | Deletes goal record from database. |
| [`updateGoalStatusRecord(goalId, isActive)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L962) | `goalId: string`, `isActive: boolean` | `Promise<void>` | Toggles active status of a goal. |
| [`setOnlyGoalActiveRecord(goalId)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L981) | `goalId: string` | `Promise<void>` | Atomically deactivates all goals and activates specified goal. |
| [`updateGoalRecord(goalId, updates)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L1009) | `goalId: string`, `updates: Partial<BuckGoal>` | `Promise<BuckGoal>` | Updates target amount, name, attitude profile, and dates. |
| [`updateGoalProgress(goalId, amountToAdd)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L1041) | `goalId: string`, `amountToAdd: number` | `Promise<BuckGoal>` | Increments goal `current_amount` and checks completion state. |
| [`updateGoalAiRecommendedBudget(userId, goalId, budget)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L1068) | `userId: string`, `goalId: string`, `budget: number` | `Promise<void>` | Persists AI suggested budget in goal record. |

### 1.5 Expenses & Composite Transaction Operations

| Function Signature | Parameters | Return Type | Description |
|---|---|---|---|
| [`listExpenses(userId)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L738) | `userId: string` | `Promise<BuckExpense[]>` | Lists user expenses ordered by `spent_on desc`, `created_at desc`. |
| [`addExpense(userId, expense)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L787) | `userId: string`, `expense: Partial<BuckExpense>` | `Promise<BuckExpense>` | Inserts expense without touching wallet balance. |
| [`deleteExpense(userId, expenseId)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L854) | `userId: string`, `expenseId: string` | `Promise<void>` | Deletes expense by ID. |
| [`addExpenseWithWalletDeduction(...)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L1256) | `userId`, `expense`, `walletId`, `currentWalletBudget` | `Promise<BuckExpense>` | Atomic flow: inserts expense and deducts `amount` from wallet budget. |
| [`deleteExpenseAndRestoreWallet(...)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L1295) | `userId`, `expenseId`, `amount`, `walletId` | `Promise<void>` | Deletes expense and restores deducted amount to associated wallet budget. |

### 1.6 Realtime & Feedback

| Function Signature | Parameters | Return Type | Description |
|---|---|---|---|
| [`subscribeUserTable(table, userId, onChange)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L305) | `table: TableName`, `userId: string`, `onChange: () => void` | `() => void` (Unsubscribe) | Establishes Supabase Realtime channel listening to `postgres_changes` for user ID. |
| [`submitFeedback(email, category, title, details)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L1332) | `email: string`, `category: string`, `title: string`, `details: string` | `Promise<void>` | Submits bug report or feature feedback into `public.feedback`. |
| [`getAdminFeedback()`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L1356) | None | `Promise<BuckFeedback[]>` | Fetches all feedback entries (admin access). |

---

## 2. Next.js Server Route Handlers (`buck/src/app/api/`)

| Route Path | Method | Auth Required | Description |
|---|---|---|---|
| [`/api/auth/password-reset`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/api/auth/password-reset/route.ts#L331) | `POST` | No (Rate-Limited) | Validates email existence, checks IP/email sliding window limits in `auth_security_events`, sends Supabase reset OTP link. |
| [`/api/auth/sign-out`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/api/auth/sign-out/route.ts#L40) | `POST` | Authenticated | Clears SSR session cookies and terminates session. |
| [`/api/auth/mfa/status`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/api/auth/mfa/status/route.ts) | `GET` | Authenticated (aal1 ok; cookie or bearer) | `{ currentLevel, satisfied, enabled, factors[], recoveryCodesLeft, emailRecovery }` for Settings and `/verify-2fa` (ADR-048). |
| [`/api/auth/mfa/recovery-codes`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/api/auth/mfa/recovery-codes/route.ts) | `POST` | 2FA on and passed | Replaces the 10 backup codes and returns them in plain text once. |
| [`/api/auth/mfa/recovery-codes/redeem`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/api/auth/mfa/recovery-codes/redeem/route.ts) | `POST` | Authenticated, 2FA on (aal1 ok); 5 failures / 15 min | `{ code }`. A valid unused code turns 2FA off and signs out other sessions; client then calls `refreshSession()`. |
| [`/api/auth/mfa/email-recovery`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/api/auth/mfa/email-recovery/route.ts) | `POST` / `DELETE` | POST: 2FA on (aal1 ok), 3 / day. DELETE: 2FA passed | POST e-mails a recovery link (30 min). DELETE cancels a pending recovery. |
| [`/account/mfa/recover/confirm`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/account/mfa/recover/confirm/route.ts) | `GET` | Authenticated (via the e-mail link) | Confirms the recovery and starts the 24 h cool-off; redirects to `/verify-2fa?emailRecovery=…`. |
| [`/api/auth/mfa/email-recovery/complete`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/api/auth/mfa/email-recovery/complete/route.ts) | `POST` | Authenticated (aal1 ok) | After the cool-off, turns 2FA off and signs out other sessions (409 + `availableAt` before then). |
| [`/api/admin/users/[id]/mfa/reset`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/api/admin/users/%5Bid%5D/mfa/reset/route.ts) | `POST` | Admin with 2FA passed | Last-resort support reset of a user's 2FA (logged `mfa_reset_admin`). |
| [`/api/oauth/authorizations/[id]`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/api/oauth/authorizations/%5Bid%5D/route.ts) | `GET` | Web session, 2FA passed | Connected-app consent details: app (`logoUrl` is Buck's logo proxy path or `null`, ADR-051), scopes, `redirectHost`, `registration`, `access: "read-only"`; or `{ state: "redirect" }` if already approved (ADR-049). |
| [`/api/oauth/authorizations/[id]/consent`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/api/oauth/authorizations/%5Bid%5D/consent/route.ts) | `POST` | Web session only (no bearer), 2FA passed | `{ decision: "approve" \| "deny" }` → `{ redirectUrl }`. Approving records the grant (`record_oauth_app_grant`) so a 2FA user's app can read data. |
| [`/api/oauth/app-logo`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/api/oauth/app-logo/route.ts) | `GET ?client_id=<uuid>` | Web session only (bearer → 400), 2FA passed | A connected app's logo through Buck (ADR-051). `logo_uri` is looked up by client id with the service role (`auth.admin.oauth.getClient`), never read from the query. Fetched by [`fetchAppLogo()`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/appLogo.ts): https and port 443 only, public IPs only (checked in the socket `lookup`), up to 3 re-checked redirects, 256 KB, 5 s, PNG/JPEG/WebP/GIF sniffed from bytes (no SVG). `200` with the sniffed type, `nosniff`, `private, max-age=86400`; any refusal is an uncached `404`. |
| [`/api/mcp`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/api/mcp/route.ts) | `POST` (`GET`/`DELETE` → 405, `OPTIONS` CORS) | Connected-app bearer token only (`client_id` claim, checked with Supabase Auth); 401 + `WWW-Authenticate resource_metadata` otherwise | Buck MCP server (ADR-050), stateless Streamable HTTP. Read-only tools: `get_overview`, `list_wallets`, `list_categories`, `list_transactions`, `spending_summary`, `list_goals`, `get_saved_advice`. Queries run under RLS with the app's token. |
| [`/.well-known/oauth-protected-resource[/api/mcp]`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/.well-known/oauth-protected-resource/%5B%5B...path%5D%5D/route.ts) | `GET` | Public (CORS `*`, cached 1 h) | RFC 9728 metadata: `resource` = `<origin>/api/mcp`, `authorization_servers` = Supabase Auth (ADR-050). |
| [`/api/account/deletion/request`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/api/account/deletion/request/route.ts#L49) | `POST` | Authenticated | Verifies current password, verifies confirmation string `"DELETE"`, generates 32-byte token, sends confirmation OTP. |
| [`/account/delete/confirm`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/account/delete/confirm/route.ts#L30) | `GET` | Authenticated | Verifies token hash against `account_deletion_requests`, schedules 10-day recovery window, signs user out. |
| [`/api/account/deletion/recover`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/api/account/deletion/recover/route.ts#L6) | `POST` | Authenticated | Cancels scheduled deletion if within the 10-day recovery period. |
| [`/api/account/deletion/purge`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/api/account/deletion/purge/route.ts#L32) | `GET` (Vercel Cron, daily) / `POST` (manual) | Bearer Token (`CRON_SECRET`, or `ACCOUNT_PURGE_SECRET`, constant-time compare) | Cron endpoint: purges expired accounts, avatar folders, and `auth.users` records. |
| [`/api/cron/generate-insights`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/api/cron/generate-insights/route.ts#L15) | `GET`, `POST` | Bearer Token (`CRON_SECRET`; fails closed when unset) | Lists all profiles and, in batches of 5, generates and stores each user's weekly advisory (`ai_advisories`) and forecast (`ai_forecasts`). `maxDuration = 300`. |
| [`/api/profile/avatar`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/api/profile/avatar/route.ts#L75) | `GET` | Authenticated | Streams private profile avatar binary with SSR authentication check. |
| [`/api/admin/supabase`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/api/admin/supabase/route.ts#L7) | `GET` | Admin ([`isAdminUser`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/adminAccess.ts): confirmed account with `app_metadata.role = 'admin'` or email matching `ADMIN_EMAIL`; 403 otherwise) | Queries Supabase Management API for project authentication logs. |
| [`/api/admin/vercel`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/api/admin/vercel/route.ts#L7) | `GET` | Admin (`isAdminUser`, as above) | Queries Vercel API for deployment status and build records. |
| [`/api/forecast`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/api/forecast/route.ts#L18) | `POST` | Authenticated with 2FA passed (`getRequestAuth`; 401 when signed out, 401 `mfa_required` when the code is still owed) | Returns the cached `ai_forecasts` row for the period if younger than 7 days, otherwise generates one with the rule engine (`generateForecastInsights`) and stores it. Accepts the web cookie or a mobile bearer token (`getRequestUserId`). Body `{ periodType?: "weekly" \| "monthly" \| "quarterly" \| "custom", forceRefresh? }` (defaults to `monthly`; same 60 s refresh cooldown). |
---

## 3. Buck_AI Service (Python FastAPI + Google Gemini Flash, `Buck_AI/`)

> **Two AIs**: `BuckAI_Advisor` (AI Financial Advisor, live) and `BuckAI_Forecast` (AI Forecaster, planned). `shared/` = config, auth, Supabase, Gemini, safety, rate limits. Full guide: [`Buck_AI/README.md`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/Buck_AI/README.md).
> **Auth**: `Authorization: Bearer <Supabase access token>` from web or mobile, verified with Supabase Auth (`shared/auth.py`). No app API keys. Supabase is queried **as the user** (anon key + user token), so RLS applies; no service-role key.
> **Env**: `GEMINI_API_KEY`, `GEMINI_MODEL` (default `gemini-3.8-flash`), `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ALLOWED_ORIGINS`. Web reads `NEXT_PUBLIC_BUCK_AI_URL`.
> **Limits**: per user, per instance: chat 15/min, insight 20/min, tip 20/min, categorize 30/min.

| Endpoint | Method | Input | Output | Description |
|---|---|---|---|---|
| [`/advisor/insight`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/Buck_AI/BuckAI_Advisor/router.py#L36) | `GET` | `?refresh=true\|false` | `{ id, title, suggestion, advice, financialHealthScore, priority, focus, changed[], generatedWith, createdAt, cached, stale }` | Returns the latest saved `ai_advisories` row (`monthly_strategy`) while the data fingerprint matches; otherwise Gemini writes new advice (given the previous advice + changed facts) and saves a new row. Cooldowns: 5 min after a data change, 60 s for refresh (returns `stale: true` meanwhile). Rule-based fallback on AI failure. |
| [`/advisor/history`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/Buck_AI/BuckAI_Advisor/router.py#L45) | `GET` | `?limit=1..20` | `[insight]` | Saved advisories, newest first. |
| [`/advisor/chat`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/Buck_AI/BuckAI_Advisor/router.py#L63) | `POST` | `{ question ≤500, history? ≤8 {role: user\|assistant, content ≤1500} }` | `text/event-stream`: `meta` / `delta` / `error` / `done` | Grounded on the live snapshot and the saved advice; read-only tools `get_spending_summary`, `list_expenses`, `get_income`, `get_goals`, `get_wallets` (max 4 rounds). Offline summary when Gemini is unavailable or silent for 20 s. |
| [`/advisor/categorize`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/Buck_AI/BuckAI_Advisor/router.py#L122) | `POST` | `{ kind: expense\|income, descriptions[1..25] }` | `{ categories: (string\|null)[] }` | Advisor auto-categorize. Loads the user's own categories under RLS (minus the fallback), constrains Gemini to that enum plus `NONE`, re-matches every answer. All-null when AI is unavailable. |
| [`/advisor/goal-tip`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/Buck_AI/BuckAI_Advisor/router.py#L98) | `POST` | `{ goalId }` or `{ goalName, targetAmount, attitude, targetDate? }` | `{ tip }` | Exactly two sentences, ₱ per week/month scaled by attitude. Empty when unavailable. |

| Module | Key functions |
|---|---|
| `BuckAI_Advisor/snapshot.py` | `build_snapshot` (parallel RLS reads, Philippine time), `health_score` |
| `BuckAI_Advisor/fingerprint.py` | `fingerprint_parts`, `fingerprint`, `changed_facts` (bucketed: 5% of budget, min ₱500) |
| `BuckAI_Advisor/service.py` | `get_insight`, `saved_history`, `goal_tip`, `chat_events` |
| `BuckAI_Advisor/categorize.py` | `categorize`, `user_categories` |
| `BuckAI_Advisor/rules.py` | `rule_insight`, `priority_for`, `offline_chat_answer` |
| `shared/gemini.py` | `stream_with_tools`, `generate_json`, `GeminiUnavailable` |
| Web client | `utils/buckAi.ts` (`buckAiFetch`), `utils/advisorApi.ts` (`fetchAIAdvisorInsights`), `utils/aiApi.ts` (`categorizeItems`, `suggestCategory`, `streamAdvisorChat`, `getGoalTip`), `utils/goalForecast.ts` (`computeGoalForecast`, no AI) |

---

## 4. Frontend React Hooks & Contexts

### 4.1 Hooks
- [`useSupabaseSession()`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/hooks/useSupabaseSession.ts): Subscribes to Supabase auth state changes, managing current session, user identity, and loading state.
- [`useAuthPageTheme()`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/hooks/useAuthPageTheme.ts): Detects and applies light/dark theme preference to document root (`data-theme`).
- [`usePointerGradient(ref)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/hooks/usePointerGradient.ts): Tracks cursor coordinates across cards to update dynamic CSS radial gradients (`--mouse-x`, `--mouse-y`).

### 4.2 State Contexts
- [`DashboardUserContext`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/context/DashboardUserContext.tsx): Provides authenticated user context (`user.uid`, `user.email`, `user.displayName`) to all dashboard routes.
- [`FinancialContext`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/context/FinancialContext.tsx): In-memory dashboard cache storing expenses, categories, goals, wallets, active wallet ID/budget, admin feedback, Vercel deployments, and Supabase logs across route transitions.

### 4.3 Notification Subsystem (`buck/src/component/toast/`)
- [`ToastContext`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/toast/ToastContext.tsx): Root state provider managing the active notification queue with automatic timeout tracking and pause-on-hover logic.
- [`useToast()`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/toast/ToastContext.tsx): Hook returning the unified dispatcher function supporting both `toast(message, type, options)` and fluent helpers (`toast.success()`, `toast.error()`, `toast.warning()`, `toast.info()`, `toast.loading()`, `toast.dismiss()`).
- [`toast`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/toast/ToastContext.tsx): Global standalone event bus function allowing notification emission from non-React utility files and event handlers.


### 4.4 Two-Factor & Passkey Client Helpers (ADR-048)
- [`utils/mfa/client.ts`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/mfa/client.ts): `fetchMfaStatus()`, `generateRecoveryCodes()`, `redeemRecoveryCode(code)`, `requestEmailRecovery()`, `completeEmailRecovery()` (throws `MfaRequestError` with `availableAt` on 409), `cancelEmailRecovery()`. Helpers: `getSafeMfaRedirect` (same-site path only, never `/verify-2fa`), `normalizeRecoveryCode` (`ABCDE-12345`), `sanitizeTotpInput` (digits, max 6), `isMfaRequiredResponse(response)`, `currentPageMfaVerifyPath()`.
- [`TotpCodeInput`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/mfa/TotpCodeInput.tsx): numeric `one-time-code` input that calls `onComplete` at 6 digits.
- [`TwoFactorSection`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/mfa/TwoFactorSection.tsx) / [`TwoFactorEnrollModal`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/mfa/TwoFactorEnrollModal.tsx) / [`RecoveryCodesPanel`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/mfa/RecoveryCodesPanel.tsx) / [`PasskeysSection`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/mfa/PasskeysSection.tsx): Settings › Security sections.
- [`MfaRequiredWatcher`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/mfa/MfaRequiredWatcher.tsx): sends any `mfa_required` response to `/verify-2fa`.
