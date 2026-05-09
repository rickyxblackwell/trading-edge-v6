---
title: CONCERNS.md
focus: concerns
generated: 2026-05-05
---

# Concerns & Risks

## HIGH

### API Key Transmitted in Every Request
The Gemini API key is stored in `localStorage` and sent in every POST body to `/api/coach`. Any network inspection exposes it. **Mitigation:** Move to server-side env var before Supabase/auth work — API key should never leave the server.

### Rate Limiting is Client-Controlled
`sessionId` is client-supplied in the request body. Anyone can rotate their sessionId to bypass the 15s rate limit. The in-memory `Map` also does not survive serverless cold starts. **Mitigation:** Rate limit by IP or authenticated user ID.

### No Authentication on `/api/coach`
The route is publicly accessible. The only "auth" is the API key check, which is the user's own Gemini key. Once auth is added this needs a `session`-based guard.

### All Data in localStorage — Silent Data Loss Risk
`localStorage` has a ~5MB quota per origin. A large trading history + coaching history + pattern summary could approach limits. Quota exceeded errors are silently caught by `readLS`'s try/catch and return the fallback, meaning data reads as empty. **Mitigation:** Supabase persistence (planned).

---

## MEDIUM

### Coaching History Cap Mismatch
`addCoachingEntry` caps in-memory state at 60 entries, but the `useEffect` persists only `coachingHistory.slice(-30)`. Entries 31–60 are lost on reload. Likely a bug.

### `strategyText` Stored Outside TradesContext
`edge_v5_strategy_text` is written directly to `localStorage` in `importData` but is not managed as reactive state in the context. Components that need it must read localStorage directly — no subscription.

### `Stats.tsx` — 869+ Lines, No Component Splitting
The Stats tab is a monolithic component with all charts, KPI cards, and calculations inline. Makes it hard to test individual calculations and slow to re-render.

### Coach Chat History Lost on Tab Switch
`Coach.tsx` maintains active chat messages in local `useState`. When the user switches tabs and returns, chat is reset. History feed (persisted entries) is preserved, but the in-progress conversation is not.

### No `ErrorBoundary`
A render error in any tab crashes the entire app shell. No recovery UI.

### No Input Validation on `addTrade`
`addTrade` accepts any `Trade` object without validation. NaN values for `pnl` or `rmult` propagate into Stats calculations silently.

### Empty `next.config.ts`
No security headers configured (`X-Frame-Options`, `Content-Security-Policy`, `X-Content-Type-Options`).

### No Web App Manifest
PWA install is broken — no `manifest.json` or `<link rel="manifest">`. iPhone "Add to Home Screen" lacks app name, icon, and splash screen.

### Duplicate `lib/` Directories
`app/lib/` (active — types + context) and root `lib/` (shadcn scaffold — just `utils.ts`). Confusing for new contributors.

---

## LOW

### `Math.random()` for IDs
Trade and coaching entry IDs are `Math.random().toString(36)`. Should be `crypto.randomUUID()` for uniqueness guarantees.

### Large HTML Prototypes in Repo Root
`TRADING-EDGE-MOBILE-V4_0.html` (127KB) and `trading-strategy.html` are committed to the project root. Not excluded via `.gitignore`. Increases repo size and is confusing.

### Unused `@supabase/supabase-js` Dependency
If installed, adds bundle weight before Supabase is wired up.

### Legacy `CoachingEntry` Fields
`marketSnapshot`, `patterns`, `process`, `risk`, `priority`, `momentum` are legacy structured fields kept for backward compat but no longer populated with useful data (filled with generic strings or slices of the full reply). Inflating localStorage.

### No Service Worker / Offline Support
No `next-pwa` or custom service worker. App requires network for Coach, but Stats/Journal could work offline.

### Zero Tests
See TESTING.md. No automated correctness checks beyond TypeScript.
