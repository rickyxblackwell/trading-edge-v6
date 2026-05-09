# Phase 1: Auth & Security - Context

**Gathered:** 2026-05-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can create accounts and log in with email/password via Supabase Auth. The Gemini API key is stored in Supabase user_metadata and read server-side — never sent from client. The app is publicly accessible without auth; only the AI Coach feature requires authentication. A `/settings` route handles API key management and account info. The `/api/coach` route rejects unauthenticated requests with 401.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**5 requirements are locked.** See `01-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `01-SPEC.md` before planning or implementing.

**In scope (from SPEC.md):** Supabase Auth email/password, session persistence, logout, Gemini key as server-side user_metadata, `/api/coach` 401 guard, login/signup UI, auth state in app shell, `/settings` page (minimal)
**Out of scope (from SPEC.md):** Supabase data persistence, V5 data migration, OAuth/social login, password reset email flow

</spec_lock>

<decisions>
## Implementation Decisions

### App Access Model
- **D-01:** The app is publicly accessible without authentication — Stats, Journal, Strategy, and Checklist tabs work with localStorage data for unauthenticated users
- **D-02:** Only the AI Coach feature requires an authenticated account — no global auth wall

### Auth UI
- **D-03:** Route group `app/(auth)/` with separate `/login` and `/signup` pages — clean Next.js App Router pattern, no shared layout with the app shell
- **D-04:** Full Midnight Market design — ambient orbs, glass card, IBM Plex Mono on inputs. Build from scratch. No `@supabase/auth-ui-react` components.
- **D-05:** Signup is a 2-step flow: (1) email/password, (2) Gemini API key entry (optional — can skip and add later in settings)

### Coach Tab — Unauthenticated State
- **D-06:** Coach tab shows a **preview/demo mode** for unauthenticated users — a sample AI response is displayed with a "Sign up to use your real trade data" CTA. Mode chips are visible but grayed out.
- **D-07:** No redirect when tapping Coach tab while unauthenticated — the preview experience is in-tab

### Gemini API Key
- **D-08:** User-supplied key stored in **Supabase Auth `user_metadata`** — not localStorage, not request body
- **D-09:** `/api/coach` reads the key from the Supabase session server-side via `supabase.auth.getUser()`. Key never travels to client.
- **D-10:** `edge_v5_apikey` localStorage key is retired — removed from TradesContext and Coach tab

### Session Handling
- **D-11:** Session expiry triggers a **silent redirect to login** — caught by Supabase `onAuthStateChange` listener in layout or a client provider
- **D-12:** No middleware global redirect — app is publicly accessible. Middleware is not used for page-level auth in this phase.
- **D-13:** `/api/coach` has its own independent auth check (reads Supabase session from request cookies/headers, returns 401 if absent)

### Settings Page (`/settings`)
- **D-14:** New route at `app/settings/page.tsx` — not part of the 5-tab shell, accessible post-login
- **D-15:** Phase 1 settings includes: Gemini API key entry/update, logout button, account info (email display)
- **D-16:** Export JSON and cache/memory management deferred to Phase 3

### Claude's Discretion
- Exact Supabase client setup pattern (SSR vs client-only) — use Supabase's recommended Next.js App Router approach with `@supabase/ssr`
- Form validation UX on login/signup — standard inline error messages
- Loading states during auth operations — use existing CSS patterns from the design system

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — project goals, constraints, key decisions
- `.planning/REQUIREMENTS.md` — REQ-IDs AUTH-01–03, SEC-01–02 with traceability
- `.planning/phases/01-auth-and-security/01-SPEC.md` — locked requirements, boundaries, acceptance criteria

### Existing Code — Integration Points
- `app/layout.tsx` — root layout; Supabase session provider wraps here
- `app/lib/TradesContext.tsx` — global state; `apiKey` state and `setApiKey` to be removed/replaced
- `app/lib/types.ts` — types; no auth types exist yet
- `app/api/coach/route.ts` — API route; needs Supabase session check added, apiKey param removed from body
- `app/page.tsx` — app shell; needs to be aware of auth state for Coach tab behavior

### Codebase Map
- `.planning/codebase/ARCHITECTURE.md` — data flow, component model
- `.planning/codebase/CONCERNS.md` — HIGH severity security concerns this phase resolves
- `.planning/codebase/STACK.md` — package versions and dependencies

### External
- Supabase Auth docs — `@supabase/ssr` for Next.js App Router (SSR-compatible client)
- Supabase `user_metadata` — for storing user-supplied Gemini key on the auth user object

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/globals.css` — all glass, orb, and token styles available for auth screens; `.glass` class, `--bg`, `--accent`, `--border` tokens
- `app/lib/types.ts` — extend with auth-related types if needed
- Inline SVG pattern from `app/page.tsx` — use for any icons on auth screens

### Established Patterns
- `"use client"` on all interactive components — auth forms will need this
- `useCallback` for all mutations — follow same pattern in auth handlers
- `env(safe-area-inset-*)` and `100dvh` — apply to auth screen layout for mobile
- No hardcoded hex values, IBM Plex Mono on any numeric/data display

### Integration Points
- `app/layout.tsx` — Supabase session provider (`createClientComponentClient` or `@supabase/ssr` pattern) wraps `TradesProvider` here
- `TradesContext.tsx` — `apiKey` state, `setApiKey`, and `edge_v5_apikey` localStorage key to be removed; context no longer manages the key
- `app/api/coach/route.ts` — `apiKey` param removed from request body; route reads key from `supabase.auth.getUser().user_metadata.gemini_api_key`
- `app/components/tabs/Coach.tsx` — replace key input UI with: (a) preview mode if unauthed, (b) settings link if authed but no key set

</code_context>

<specifics>
## Specific Ideas

- **Coach preview mode:** Show a realistic-looking sample AI response (not a generic placeholder) to demonstrate value. "Sign up to coach your real trades" CTA below.
- **Midnight Market auth screen:** Same ambient orbs as the main app. Glass card centered on screen. "TRADING EDGE" wordmark at top with accent glow. Keep it premium — this is the first impression.
- **Settings route:** Not part of the 5-tab nav — accessible via a small account icon or menu in the sidebar/bottom bar (desktop: top of sidebar; mobile: subtle icon in bottom bar or header)

</specifics>

<deferred>
## Deferred Ideas

- **Export JSON button** — currently in Journal tab; user wants it moved to /settings. Deferred to Phase 3 (Stability & PWA) when settings page is expanded.
- **Cache/memory management** — user wants controls for clearing localStorage cache and pattern memory. Deferred to Phase 3.
- **Password reset email flow** — not in Phase 1 scope, add as a post-Phase-1 patch.
- **OAuth / social login (Google)** — v2 backlog.

</deferred>

---

*Phase: 1 — Auth & Security*
*Context gathered: 2026-05-05*
