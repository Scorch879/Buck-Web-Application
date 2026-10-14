# Buck_AI

The AI service for Buck, written in Python (FastAPI) on **Google Gemini Flash**. The web app and the mobile app call the same API.

Buck has two AIs, one per job:

| Folder | AI | Status |
|---|---|---|
| `BuckAI_Advisor/` | **AI Financial Advisor**: saved advice that updates itself, chat, goal tips, auto-categorize | Live |
| `BuckAI_Forecast/` | **AI Forecaster**: projections, spending pace, goal timing | Planned |

`shared/` holds the plumbing both AIs use: config, auth, Supabase access, the Gemini client, safety helpers and rate limits.

## How the Advisor keeps advice up to date

1. **Snapshot.** On each request it builds a numbers-only snapshot of the user's month from Supabase: spending, income, top categories, wallets and the active goal.
2. **Fingerprint.** It reduces that snapshot to a fingerprint of the facts that matter. Spending is rounded into steps of 5% of the budget (at least ₱500); the fingerprint also covers top categories, goal progress, wallet, income, the month and the saving attitude.
3. **Reuse.** If the newest saved advisory in `ai_advisories` has the same fingerprint, it is returned straight from the database, with no Gemini call.
4. **Regenerate.** If the data moved, Gemini writes new advice. It is shown the previous advice and what changed, so it can acknowledge progress or adjust its targets. The new advice is saved as a new row, and older rows stay as history.
5. **Cooldowns** (5 min after a data change, 60 s for a manual refresh) protect the free Gemini quota. During a cooldown the saved advice is returned with `stale: true`.
6. **Fallbacks.** If Gemini is missing, fails or is out of free quota, the Advisor writes rule-based advice that uses the same real numbers. It never replaces good advice with rule-based advice for unchanged data.

## API

Every call needs `Authorization: Bearer <Supabase access token>`, the token of the signed-in user. There is no API key for apps: a key shipped inside the mobile app could be extracted. The token is checked with Supabase Auth.

| Method & path | Body / query | Returns |
|---|---|---|
| `GET /` | | Health check: Advisor status and whether Gemini is configured |
| `GET /advisor/insight` | `?refresh=true` to force a refresh (60 s cooldown) | `{ id, title, suggestion, advice, financialHealthScore, priority, focus, changed[], generatedWith, createdAt, cached, stale }` |
| `GET /advisor/history` | `?limit=1..20` | Saved advisories, newest first |
| `POST /advisor/chat` | `{ question (≤500), history? [{role, content}] (≤8) }` | `text/event-stream` events: `meta` (`ai` or `fallback`), `delta`, `error`, `done` |
| `POST /advisor/categorize` | `{ kind: "expense" \| "income", descriptions: [1..25] }` | `{ categories: (name \| null)[] }`: only the user's own category names (Gemini is limited to an enum of them); `null` keeps the item in the fallback |
| `POST /advisor/goal-tip` | `{ goalId }` or `{ goalName, targetAmount, attitude, targetDate? }` | `{ tip }` (two sentences; empty when unavailable) |

Rate limits are counted per user and per server instance: chat 15/min, insight 20/min, tips 20/min, categorize 30/min (up to 25 items per request).

## Security

- **Database access runs as the user.** Every Supabase query uses the user's own token, so Postgres Row-Level Security applies. This service needs **no service-role key**.
- **What Gemini sees:** numbers only (totals, categories, goal figures). Free text is scrubbed of emails, phone numbers and account numbers, and angle brackets are stripped so user data can't break out of the `<financial_data>` block. The prompt treats data as data and refuses to recommend financial products.
- **Chat tools are read-only**, scoped to the caller, and every argument the model passes is validated and clamped.

## Run locally

```bash
cd Buck_AI
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements-dev.txt
copy .env.example .env          # then fill in values
uvicorn main:app --reload --port 8000
```

Tests, which run offline with fakes:

```bash
python -m unittest -v
```

## Deploy (free)

1. In Vercel, create a **new project** from this repo with **Root Directory = `Buck_AI`**. Vercel finds the FastAPI `app` in `main.py`. The Hobby plan is free.
2. Set these environment variables: `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `ALLOWED_ORIGINS` (your web app's URL).
3. In the **web** project, set `NEXT_PUBLIC_BUCK_AI_URL` to the Buck_AI URL.

**Staying at ₱0:**

- Use a Gemini key from [Google AI Studio](https://aistudio.google.com) on the free tier, and don't attach a billing account.
- When the free quota runs out, Gemini returns 429 and the Advisor serves its rule-based fallback.
- On the free tier, Google may use prompts to improve its products. Buck only sends PII-scrubbed numbers.
