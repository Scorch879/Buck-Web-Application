# Admin Dashboard Updates

## 1. UI Redesign & Tabbed Navigation
The Admin Dashboard (`src/app/dashboard/admin/page.tsx`) was refactored from a vertical stacked layout to a sleek, side-tab navigation system matching the Settings page:
- **Left Navigation:** Uses `.settings-tabs` for categorized data views (User Feedback, Supabase Logs, Vercel Deployments).
- **Flex Layout Constraints:** Applied strict `min-height: 0` constraints to the flex layout chain. This prevents the right-hand panel from overflowing the main dashboard wrapper and causing double scrollbars. Now, only the specific list content area scrolls.
- **Sticky Tabs:** The left-hand navigation tabs are `position: sticky`, ensuring they remain visible while scrolling through long server logs.

## 2. Advanced Filtering & Search
A unified toolbar `.admin-toolbar` was added above the content lists:
- **Search:** Client-side search matching against feedback titles, logs, or deployment branches.
- **Sorting:** Allows sorting data by "Newest First" and "Oldest First".
- **Category Filters:** Specific filters drop-downs for Feedback (Bug, Feature, etc.) and Vercel Deployments (READY, ERROR, BUILDING).

## 3. Global State Caching & Optimized Loading
- **Global Context Cache:** The Admin data fetches are now stored in `DashboardDataCache` via `FinancialContext`. This allows instant renders if the user navigates away to another dashboard page and returns to the Admin page.
- **Tab-Level Loading:** Replaced the global `loading` state that displayed a full-page `<DashboardPageSkeleton />` with tab-specific loading states (`isFetchingFeedback`, `isFetchingVercel`, `isFetchingSupabase`). 
- **Non-blocking Refreshes:** The system silently updates the data in the background and only shows an inline spinner for the specific active tab if its cache is empty.
