# Prompt for Buck | Frontend Agent: AI Forecaster Page (ADR-052)

## Role
You are the **Frontend UI/UX Architect** for Buck (see `CLAUDE.md` §4.2). The AI Forecaster backend is finished (ADR-052, QA BUG-035). **Do not change** anything in `Buck_AI/`, the API routes, migrations or the data functions in [`utils/forecastApi.ts`](../../buck/src/utils/forecastApi.ts) (`fetchAIForecastInsights`, `explainAIForecast`). You may add pure display helpers. If you need a backend change, write it up for the Backend Agent.

## What the page gets now
`fetchAIForecastInsights({ horizon })` returns `AIForecastInsights`. When it comes from Buck_AI, `source === "buck_ai"` and two extra fields are filled (types are in `forecastApi.ts`):

- `forecast: BuckForecast`, all amounts in PHP:
  - `days[]`: `{ date, p10, p50, p90, expected, cumulative{p10,p50,p90}, recurring[] }` for 30 or 60 days from tomorrow. p10–p90 is the 80% range, p50 the likely value.
  - `month`: `spentSoFar`, `restOfMonth` and `projectedTotal` (bands), `surplus{low, likely, high}` (negative = overspend) against `surplusBasis` ("income this month" or "current wallet balances").
  - `categories[]`: `{ name, expected, share, restOfMonth, trend: rising|falling|steady|new, recurring }`, largest first.
  - `wallets[]`: `{ name, active, balance, projectedSpend (band), runsOut{early, likely, late} | null, empty }`. `empty` = balance is ₱0 but spending usually comes out of it.
  - `target`: `{ attitude, multiplier, expectedDaily, dailyTarget, gapPerDay, restOfMonthTarget }`, the saving-attitude line.
  - `goal` (or `null`): `{ name, remaining, targetDate, requiredPerDay, freeCashPerDay, reachBy{early, likely, late}, onTrack }`.
  - `habits[]` (`{ kind, text }`), `recurring[]`, `excluded[]` (emergencies and one-offs left out), `movingAverages{d14, d30, d60}`, `warnings[]`.
  - `model`: `{ windowDays, observedDays, backtestError, bandCoverage, confidence (0–1), lowData, loggingGap, quietDays, lastExpense }`.
- `narrative`: `{ headline, explanation, habitNotes[], watchOut }`.
- `explanationPending`: the page already calls `explainAIForecast` and swaps in the Gemini text when it arrives (it can take 10–40 s). Show a quiet "Writing explanation…" state on the explanation card meanwhile; never block the numbers on it.
- `stale`: the explanation is from a few minutes ago and a fresh one comes after the cooldown.

When Buck_AI is unreachable, `source === "rules"`: only the old flat fields are filled (`summary`, `projectedSpending`, `projectedSavings`, `aiRecommendedBudget`, `warnings`, `dailyForecast`). The page must still render that case with the current cards and hide the new sections.

## Task (one PR to `dev`)
Redesign [`dashboard/forecast/page.tsx`](../../buck/src/app/dashboard/forecast/page.tsx) and its `style.css`:

1. **Horizon toggle**: segmented `[30 days] [60 days]` (same style as the Goals/Statistics segmented buttons). Changing it calls `fetchAIForecastInsights({ horizon })`. Cache per horizon in `FinancialContext` so switching back is instant.
2. **Daily chart** (Chart.js / `react-chartjs-2`, as on Statistics): shaded P10–P90 band, P50 line, a dashed attitude target line at `target.dailyTarget` (hide it when `multiplier === 1`), and a marker on days with `recurring` items (tooltip lists them). Add a Daily / Cumulative toggle; cumulative uses `days[].cumulative`. Tooltips show ₱ with 2 decimals and the date.
3. **Month card**: spent so far, likely month total with its range, and the surplus or shortfall against `surplusBasis` (Buck Coral `#FF3838` when `likely < 0`).
4. **Category cards**: top 5 by `expected`, with share bar, `restOfMonth` and a trend chip (rising / falling / steady / new).
5. **Wallet runway cards**: one per wallet with `projectedSpend`. Show "Likely runs out around {likely}" with the early–late range, "Lasts beyond this period" when `runsOut.likely` is `null`, and an "Empty" badge when `empty`.
6. **Goal card** (when `goal`): remaining, required per day, likely reach date with range, on-track chip.
7. **Habits and exclusions**: `habits[]` as chips; a collapsible "Left out of the baseline" list from `excluded[]` (date, category, amount, reason).
8. **Explanation card**: `narrative.headline` as the title, `explanation` as the body, `habitNotes` as bullets, `watchOut` as a callout. Small footer: "Based on your last {windowDays} days · confidence {confidence × 100}%". When `model.lowData` or `confidence < 0.3`, show a "Rough estimate" chip.
9. **Warnings**: keep the AI Warnings card, fed by `forecast.warnings` (the logging-gap warning comes first when present; style it as informational, not danger).
10. **Skeleton**: update [`component/skeletons/ForecastSkeleton.tsx`](../../buck/src/component/skeletons/ForecastSkeleton.tsx) to 1:1 parity with the new layout (toolbar with the horizon toggle, chart card, card grids). ADR-012, zero layout shift.
11. Copy: say "likely", "between ₱X and ₱Y", and never imply certainty. Don't add saving advice; that is the Advisor's job.

## Check
- `npm run lint`, `npm run typecheck`, `npm test` in `buck/`.
- Browser, signed in, with Buck_AI running (`NEXT_PUBLIC_BUCK_AI_URL`): 30 and 60 days both render; the explanation swaps from rule text to Gemini text without layout shift; Refresh works and shows the cooldown state; with Buck_AI stopped, the rule-engine fallback still renders. Light and dark themes; 375 px wide with no sideways scroll.
