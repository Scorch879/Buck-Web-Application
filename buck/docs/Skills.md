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

### 1.2 Categories Management

| Function Signature | Parameters | Return Type | Description |
|---|---|---|---|
| [`ensureDefaultCategories(userId)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L624) | `userId: string` | `Promise<BuckCategory[]>` | Seeds default 17 expense categories if none exist for user; returns sorted category list. |
| [`listCategories(userId)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L652) | `userId: string` | `Promise<BuckCategory[]>` | Fetches user categories ordered by `sort_order` and `name`. |
| [`addCategory(userId, name)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L673) | `userId: string`, `name: string` | `Promise<BuckCategory>` | Inserts a custom category for the user. |
| [`updateCategoryName(userId, categoryId, name)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L696) | `userId: string`, `categoryId: string`, `name: string` | `Promise<BuckCategory>` | Renames an existing category owned by user. |
| [`deleteCategory(userId, categoryId)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L719) | `userId: string`, `categoryId: string` | `Promise<void>` | Deletes category record (expenses retain category name or fall back to Uncategorized). |

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
| [`/api/auth/sign-out`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/api/auth/sign-out/route.ts) | `POST` | Authenticated | Clears SSR session cookies and terminates session. |
| [`/api/account/deletion/request`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/api/account/deletion/request/route.ts#L57) | `POST` | Authenticated | Verifies current password, verifies confirmation string `"DELETE"`, generates 32-byte token, sends confirmation OTP. |
| [`/account/delete/confirm`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/account/delete/confirm/route.ts#L30) | `GET` | Authenticated | Verifies token hash against `account_deletion_requests`, schedules 10-day recovery window, signs user out. |
| [`/api/account/deletion/recover`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/api/account/deletion/recover/route.ts) | `POST` | Authenticated | Cancels scheduled deletion if within the 10-day recovery period. |
| [`/api/account/deletion/purge`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/api/account/deletion/purge/route.ts#L34) | `POST` | Bearer Token (`ACCOUNT_PURGE_SECRET`) | Cron endpoint: purges expired accounts, avatar folders, and `auth.users` records. |
| [`/api/profile/avatar`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/api/profile/avatar/route.ts) | `GET` | Authenticated | Streams private profile avatar binary with SSR authentication check. |
| [`/api/admin/supabase`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/api/admin/supabase/route.ts#L6) | `GET` | Admin Email Check | Queries Supabase Management API for project authentication logs. |
| [`/api/admin/vercel`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/api/admin/vercel/route.ts#L6) | `GET` | Admin Email Check | Queries Vercel API for deployment status and build records. |
| [`/api/advisor`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/api/advisor/route.ts#L3) | `POST` | Authenticated | Advisor API endpoint (Currently stubbed mock output). |
| [`/api/forecast`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/api/forecast/route.ts#L3) | `POST` | Authenticated | Forecasting API endpoint (Currently stubbed mock output). |

---

## 3. Python FastAPI AI Engine Skills (`buck/BuckAI_Backend/main.py`)

| Endpoint | Method | Input Schema | Output Schema | Description |
|---|---|---|---|---|
| [`/ai/goal_recommendation/`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/BuckAI_Backend/main.py#L55) | `POST` | `GoalInput { goal_name, target_amount, attitude, target_date }` | `{"recommendation": string}` | Generates 2-sentence actionable saving advice using LLaMA 3.3 70B Turbo with attitude multipliers. |
| [`/ai/saving_tip/`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/BuckAI_Backend/main.py#L70) | `POST` | `TipInput { category, user_context, target_date, created_at }` | `{"tip": string}` | Returns customized money-saving tip for category and target date in Philippine Peso. |
| [`/expenses/`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/BuckAI_Backend/main.py#L78) | `POST` | `ExpenseInput { user_id, goal_id, date, amount, description }` | `{"success": true, "category": string}` | Auto-categorizes expense with LLaMA and stores in memory `expenses_db`. |
| [`/expenses/{user_id}/{goal_id}/`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/BuckAI_Backend/main.py#L96) | `GET` | Path params `user_id`, `goal_id` | `List[dict]` | Returns in-memory expenses logged under user and goal. |
| [`/ai/forecast/`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/BuckAI_Backend/main.py#L101) | `POST` | `ForecastInput { goal: dict, budget: float }` | `{"forecast": string, "forecast_per_day": dict, "actual_per_day": dict, "days_left": int, "spent": float, "remaining": float, "ai_recommended_budget": float}` | Computes daily trajectory, days remaining, and LLM advice with budget extraction regex. |
| [`/ai/categorize_expense/`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/BuckAI_Backend/main.py#L162) | `POST` | `{"description": string}` | `{"category": string}` | Classifies text into one of 17 standard reference categories. |

---

## 4. Frontend React Hooks & Contexts

### 4.1 Hooks
- [`useSupabaseSession()`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/hooks/useSupabaseSession.ts): Subscribes to Supabase auth state changes, managing current session, user identity, and loading state.
- [`useAuthPageTheme()`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/hooks/useAuthPageTheme.ts): Detects and applies light/dark theme preference to document root (`data-theme`).
- [`usePointerGradient(ref)`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/hooks/usePointerGradient.ts): Tracks cursor coordinates across cards to update dynamic CSS radial gradients (`--mouse-x`, `--mouse-y`).

### 4.2 State Contexts
- [`DashboardUserContext`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/context/DashboardUserContext.tsx): Provides authenticated user context (`user.uid`, `user.email`, `user.displayName`) to all dashboard routes.
- [`FinancialContext`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/context/FinancialContext.tsx): In-memory dashboard cache storing expenses, categories, goals, wallets, active wallet ID/budget, admin feedback, Vercel deployments, and Supabase logs across route transitions.
