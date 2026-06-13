# Admin Backend & Caching Refactoring

## 1. Global Context Caching (`FinancialContext.tsx`)
To significantly improve load times and prevent redundant API calls when navigating between Dashboard pages and Admin tabs, the entire Admin data state was moved into the global memory cache.

### Added to `DashboardDataCache` Interface:
- `adminFeedback`: Caches the raw user feedback data (`BuckFeedback[] | null`).
- `adminVercelDeployments`: Caches the Vercel deployment logs (`any[] | null`).
- `adminSupabaseLogs`: Caches the Supabase auth logs (`any[] | null`).
- Cache timestamps (`adminFeedbackFetchedAt`, `adminVercelFetchedAt`, `adminSupabaseFetchedAt`) to track when the data was last pulled, preventing immediate refetching if the cache is fresh.

### Added to `FinancialContextState`:
- **Loading Flags:** `isFetchingAdminFeedback`, `isFetchingAdminVercel`, `isFetchingAdminSupabase`.
- **Fetch Functions:** 
  - `fetchAdminFeedback()`: Fetches from `supabaseData.ts`.
  - `fetchAdminVercelDeployments()`: Fetches from `/api/admin/vercel`.
  - `fetchAdminSupabaseLogs()`: Fetches from `/api/admin/supabase`.

## 2. Refactored Component Logic (`admin/page.tsx`)
- **State Migration:** Removed local React state variables for the raw array data (e.g., `const [feedback, setFeedback] = useState()`). The component now consumes the data directly from `useFinancial()`.
- **Tab-Triggered Fetches:** When a user switches to a specific tab (e.g., Vercel Deployments), a `useEffect` checks if the data is already cached. If the cache is empty, it triggers the specific fetch function from the context.
- **Client-Side Filtering:** The raw arrays kept in the cache are never mutated by the search bar or filters. Instead, the component uses `useMemo`-like derived states to apply `searchQuery`, `sortBy`, and `filterCategory` dynamically on the fly before rendering.

## 3. Security Considerations
- **Memory-Only Cache:** To prevent sensitive admin logs from persisting across sessions or users, the cache is held purely in React Memory (Context state). It is **not** written to `localStorage` or `sessionStorage`. When the app reloads or the browser is closed, the cache is securely wiped.
- **Role Validation:** The page still strictly enforces that only the authorized administrator email (`buckthebudgettracker@gmail.com`) is allowed to view or trigger these fetches.
