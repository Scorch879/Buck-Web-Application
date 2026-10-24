# Prompt for Buck | Frontend Agent: Connected-App Logos (ADR-051)

## Role
You are the **Frontend UI/UX Architect** for Buck (see `CLAUDE.md` §4.2). The backend for this change is finished (ADR-051, QA INFO-009). **Do not change** the API routes, middleware, migrations, `utils/oauthApps.ts`, `utils/appLogo.ts` or `utils/mfa/*`. If you need a backend change, write it up for the Backend Agent.

## What changed in the backend
- App logos now load only through Buck: `GET /api/oauth/app-logo?client_id=<uuid>`. The server fetches the app's `logo_uri`, checks it, and returns a PNG, JPEG, WebP or GIF. Any refusal (no logo, SVG, too big, private host, timeout) is a `404`.
- `logoUrl` in `GET /api/oauth/authorizations/[id]` (`app.logoUrl`) and in `listConnectedApps()` (`ConnectedAppGrant.logoUrl`) is now that **relative path**, or `null` when the app has no logo. The app's own URL no longer reaches the browser.
- The CSP `img-src` is unchanged. `'self'` already covers the proxy, so nothing else needs allowing.

## Why the UI needs a change
Both logo components pass `logoUrl` through `toSafeHttpUrl()`, which only accepts absolute `http(s)` URLs. It turns the relative proxy path into `null`, so the initial is still shown everywhere.

## Task (one small PR to `dev`)
1. In [`src/app/oauth/consent/page.tsx`](../../buck/src/app/oauth/consent/page.tsx) (`AppLogo`) and [`src/component/ConnectedAppsSection.tsx`](../../buck/src/component/ConnectedAppsSection.tsx) (`ConnectedAppLogo`), replace `toSafeHttpUrl(logoUrl)` with `toAppLogoSrc(logoUrl)` from `@/utils/connectedApps`. It returns the path only when it is exactly Buck's proxy path for a uuid, and `null` otherwise.
2. Keep `toSafeHttpUrl` for the website link (`href`); only the logo `src` changes.
3. Keep the `onError → initial` fallback: a `404` from the proxy must still show the initial without any layout shift. The logo and initial already share the same box size; keep it that way (ADR-012).
4. You can keep `referrerPolicy="no-referrer"`. The comment "Third-party logo from any host" is no longer true: say it is Buck's logo proxy and that it uses a plain `<img>` because `next/image` would add its own optimiser hop.
5. Remove `toSafeHttpUrl` from the imports in `ConnectedAppsSection.tsx` if it is no longer used there.

## Check
- `npm run lint`, `npm run typecheck`, `npm test` in `buck/`.
- In the browser, signed in: for an app with a PNG `logo_uri`, the consent page and Settings › Security › Connected apps show the logo, and the Network tab shows only `/api/oauth/app-logo?...` (no request to the app's host). An app with an SVG logo or no logo shows its initial.
