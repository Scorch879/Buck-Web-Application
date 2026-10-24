# Global Hydration Mismatch Fix

## Issue Overview
A critical React hydration mismatch error occurred on dashboard pages (such as `ForecastPage`). 
The error (`react-dom-client.development.js:4505 Uncaught Error: Hydration failed because the server rendered HTML didn't match the client`) was triggered by the introduction of the `sessionStorage` caching mechanism.

### The Cause
1. **Server-Side Render (SSR):** During SSR, the Next.js server has no access to the browser's `sessionStorage`. Therefore, the `DashboardDataCache` was evaluated as empty. Components like `ForecastPage` read `hasInitialData === false`, causing the server to render a `<DashboardPageSkeleton />`.
2. **Client-Side Hydration:** When the browser downloaded the HTML and React attempted its first hydration pass, the `FinancialProvider` synchronously read the local `sessionStorage` cache. This caused `hasInitialData === true`. The client immediately attempted to render `<main className="forecast-page">`.
3. **Mismatch Crash:** React compared the server's `<div className="dashboard-skeleton">` against the client's `<main>` tag, found a discrepancy, discarded the server HTML, and threw a hydration mismatch error.

## The Solution (`AuthGuard.tsx`)
To fix this without destroying the caching benefits or causing unnecessary background API fetches, the hydration boundary was moved to the highest level layout component (`AuthGuard.tsx`).

### Implementation Details
- An `isHydrated` state block was added to `AuthGuard`.
- During the SSR phase and the *exact moment* of initial client hydration, `isHydrated` is strictly `false`.
- This forces the client to identically mirror the server's `<DashboardPageSkeleton />` for the first render frame, perfectly satisfying React's strict hydration rules.
- Once the initial render is complete, a `useEffect` immediately triggers `setIsHydrated(true)`. 
- The `FinancialProvider` and its children (the actual Dashboard pages) are only mounted *after* hydration finishes.
- When they mount purely on the client side, they synchronously read the cache, immediately display the full UI without a skeleton flash, and gracefully execute the "stale-while-revalidate" background fetch.

### Files Modified
- `src/component/AuthGuard.tsx`: Added `isHydrated` boolean state and a `useEffect` hydration barrier.

This pattern permanently shields all nested Dashboard pages from local-storage related hydration mismatches.
