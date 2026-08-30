# Implementation.md: Execution Details, Setup & Hardcoded Constraints

This document details runtime setup procedures, environment configurations, low-level execution logic for complex modules, edge cases, and hardcoded system constraints for the **Buck Budget Tracker Web Application**.

---

## 1. Environment Variable Specification

### 1.1 Next.js Frontend & Server Environment (`buck/.env.local`)

| Variable Name | Scope | Required | Default / Description |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client & Server | **Yes** | HTTPS URL of the Supabase project instance. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client & Server | **Yes** | Public anonymous API key for client queries. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server Only | **Yes** | Admin service role key (bypasses RLS for account purging and password reset checks). |
| `SESSION_COOKIE_SECRET` | Server Only | **Yes** | Secret string used for HMAC-SHA256 signing of session activity cookies. |
| `AUTH_RATE_LIMIT_SECRET` | Server Only | Optional | Secret key for hashing IP and email in `auth_security_events`. (Falls back to `SESSION_COOKIE_SECRET`). |
| `NEXT_PUBLIC_SITE_URL` | Client & Server | Optional | Production canonical URL (e.g. `https://buck-app.vercel.app`) used for email redirects. |
| `NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_MINUTES` | Client & Server | Optional | Default: `30`. Minutes of inactivity before auto sign-out. |
| `NEXT_PUBLIC_SESSION_WARNING_SECONDS` | Client Only | Optional | Default: `60`. Seconds before timeout to display the session expiration countdown modal. |
| `ACCOUNT_PURGE_SECRET` | Server Only | Optional | Bearer token required to trigger `/api/account/deletion/purge`. |
| `SUPABASE_MANAGEMENT_TOKEN` | Server Only | Optional | Access token for Supabase Management API (used in Admin logs). |
| `SUPABASE_PROJECT_REF` | Server Only | Optional | Project reference ID for Supabase logs endpoint. |
| `VERCEL_ACCESS_TOKEN` | Server Only | Optional | Vercel API token for deployment metrics. |
| `VERCEL_PROJECT_ID` | Server Only | Optional | Vercel project ID for deployment monitoring. |

### 1.2 Python FastAPI Microservice Environment (`buck/BuckAI_Backend/.env.local`)

| Variable Name | Scope | Required | Description |
|---|---|---|---|
| `TOGETHER_API_KEY` | Python Server | **Yes** | API key for Together AI inference (`meta-llama/Llama-3.3-70B-Instruct-Turbo-Free`). |

---

## 2. Step-by-Step Setup & Deployment

### 2.1 Next.js Frontend Application Setup

```bash
# 1. Navigate to the frontend directory
cd buck

# 2. Install dependencies (Node.js 18.18.0+)
npm install

# 3. Configure .env.local with Supabase credentials
cp .env.example .env.local  # or create manually

# 4. Start development server with Turbopack
npm run dev

# 5. Build for production deployment
npm run build
npm run start
```

### 2.2 Python FastAPI Backend Setup

```bash
# 1. Navigate to AI backend directory
cd buck/BuckAI_Backend

# 2. Create virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# 3. Install required packages
pip install -r requirements.txt

# 4. Configure .env.local with TOGETHER_API_KEY
# 5. Run FastAPI development server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 2.3 Supabase Database Migration Setup

Execute SQL migrations located in [`buck/supabase/migrations/`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/supabase/migrations/) in sequential order:
1. `202606010001_initial_buck_schema.sql` (Core tables, triggers, RLS policies, realtime publication).
2. `202606100001_profile_avatars.sql` (Storage bucket `profile-avatars` and RLS policies).
3. `202606110001_account_deletion_requests.sql` (10-day recovery window table and indexes).
4. `202606110002_auth_security_events.sql` (Rate limit hash log table).
5. `202606120001_soft_delete_wallets.sql` (`deleted_at` column on `wallets`).

---

## 3. Complex Module Execution Logic

### 3.1 Session Activity HMAC Signing & Verification ([`middleware.ts`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/middleware.ts#L171-L250))
- **Payload**: Base64URL-encoded JSON `{ sub: userId, ts: Date.now() }`.
- **Signing**: Uses Web Crypto API `crypto.subtle.importKey` with `HMAC-SHA256` and the server secret.
- **Verification**: On every dashboard request, extracts cookie `payload.signature`, performs `crypto.subtle.verify`, and calculates `Date.now() - activity.ts > timeoutMs`.

### 3.2 Password Policy Validation ([`passwordPolicy.ts`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/passwordPolicy.ts))
Enforces 5 discrete security criteria:
- Minimum length: $\ge 8$ characters.
- Lowercase letter: `/[a-z]/`.
- Uppercase letter: `/[A-Z]/`.
- Number: `/[0-9]/`.
- Special character: `/[^A-Za-z0-9]/`.
Returns a composite score (0 to 5) and localized validation messages.

### 3.3 Dynamic SVG Modal Perimeter Glow Math
- Uses Framer Motion's `useScroll` with `container` reference.
- Dynamic SVG `rect` uses `pathLength` mapped to `smoothProgress` with Spring physics (`damping: 24, stiffness: 220`).
- Incorporates `ResizeObserver` to evaluate whether modal content overflows viewport height before rendering glow borders.

### 3.4 Cross-Tab Session Synchronization ([`SessionManager.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/SessionManager.tsx#L100-L250))
- Employs a `BroadcastChannel("buck-session")` alongside `localStorage` event listeners.
- Throttles activity timestamps writes to once every 15,000 ms.
- If a user clicks "Stay Signed In" in any tab, an `activity` message wakes all sibling tabs.
- If a user logs out in one tab, a `signout` message terminates sessions globally across all open tabs.

---

## 4. Hardcoded System Constraints & Edge Cases

| Area | Constraint / Boundary | Code Reference |
|---|---|---|
| **Admin Privilege** | Hardcoded to email `buckthebudgettracker@gmail.com` | [`middleware.ts:378`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/middleware.ts#L378), [`admin/supabase/route.ts:20`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/api/admin/supabase/route.ts#L20), [`admin/vercel/route.ts:20`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/api/admin/vercel/route.ts#L20) |
| **Avatar Uploads** | Maximum size: 2,097,152 bytes (2 MB); MIME types: `image/jpeg`, `image/png`, `image/webp` | [`supabaseData.ts:75`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L75) |
| **Account Recovery** | Fixed 10-day recovery window (`RECOVERY_WINDOW_DAYS = 10`) | [`account/delete/confirm/route.ts:7`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/account/delete/confirm/route.ts#L7) |
| **Deletion Confirm** | Strict uppercase string match `"DELETE"` | [`deletion/request/route.ts:14`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/api/account/deletion/request/route.ts#L14) |
| **Rate Limiting** | Max 8 password resets per IP per 15 min; 40 per IP per 24 hr; 5 per email per 1 hr; 60s email cooldown | [`password-reset/route.ts:45-51`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/api/auth/password-reset/route.ts#L45-L51) |
| **Modal Bounds** | Desktop max width: `min(880px, 100%)`, max height: `min(82dvh, 760px)` | [`globals.css:780`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/globals.css) |
| **Currency Token** | Hardcoded to Philippine Peso (`PHP`, `₱`) across UI formatters and AI prompts | [`formatters.ts:4`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/formatters.ts#L4), [`ai_models.py:123`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/BuckAI_Backend/ai_models.py#L123) |
