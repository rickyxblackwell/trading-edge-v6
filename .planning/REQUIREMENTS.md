# Requirements — Trading Edge V6

## v1 Requirements

### Authentication (AUTH)

- [ ] **AUTH-01:** User can create account with email/password via Supabase Auth
- [ ] **AUTH-02:** User session persists across app restarts
- [ ] **AUTH-03:** User can log out from any tab

### Security (SEC)

- [ ] **SEC-01:** Gemini API key stored as server-side env var — never exposed to client or sent in request body
- [ ] **SEC-02:** `/api/coach` route requires authenticated Supabase session — returns 401 if unauthenticated

### Persistence (PERSIST)

- [ ] **PERSIST-01:** Trades stored in Supabase `trades` table, scoped to authenticated user
- [ ] **PERSIST-02:** Coaching history stored in Supabase `coaching_entries` table, scoped to authenticated user
- [ ] **PERSIST-03:** Pattern summary stored in Supabase user profile or preferences table
- [ ] **PERSIST-04:** V5 localStorage data migrated to Supabase on first authenticated login
- [ ] **PERSIST-05:** localStorage used as offline read cache only — Supabase is source of truth

### Stability (STABLE)

- [ ] **STABLE-01:** `ErrorBoundary` wraps app shell — tab render error shows fallback UI, not full crash
- [ ] **STABLE-02:** Coaching history persists 60 entries to Supabase (remove 30-entry localStorage cap bug)
- [ ] **STABLE-03:** Trade and coaching entry IDs use `crypto.randomUUID()`
- [ ] **STABLE-04:** Input validation on `addTrade` — rejects NaN pnl/rmult before storing

### PWA (PWA)

- [ ] **PWA-01:** Web app manifest (`manifest.json`) with name, icons, theme color, display mode
- [ ] **PWA-02:** `<link rel="manifest">` in `app/layout.tsx`
- [ ] **PWA-03:** `strategyText` managed as reactive state in TradesContext (not direct localStorage write)

## v2 Requirements (Deferred)

- Offline service worker / offline-first data sync
- Push notifications (trade alerts, daily review reminders)
- OAuth login (Google)
- Data export (CSV, JSON backup)
- Multi-device sync indicators

## Out of Scope

- Social/sharing features — single-trader app
- Multi-instrument portfolio (stocks, options, crypto) — CME Group futures primary
- Broker / TradingView API integration — manual journal is intentional
- Mobile native app — PWA covers iPhone use case
- Multi-user / team features

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| SEC-01 | Phase 1 | Pending |
| SEC-02 | Phase 1 | Pending |
| PERSIST-01 | Phase 2 | Pending |
| PERSIST-02 | Phase 2 | Pending |
| PERSIST-03 | Phase 2 | Pending |
| PERSIST-04 | Phase 2 | Pending |
| PERSIST-05 | Phase 2 | Pending |
| STABLE-01 | Phase 3 | Pending |
| STABLE-02 | Phase 3 | Pending |
| STABLE-03 | Phase 3 | Pending |
| STABLE-04 | Phase 3 | Pending |
| PWA-01 | Phase 3 | Pending |
| PWA-02 | Phase 3 | Pending |
| PWA-03 | Phase 3 | Pending |

**Coverage:** 17/17 v1 requirements mapped (100%)

**Note:** Phase 4 (Stats Refactor & Tests) and Phase 5 (Polish & Cleanup) address engineering concerns from CONCERNS.md — no formal REQ-IDs. They are documented in ROADMAP.md with observable success criteria.
