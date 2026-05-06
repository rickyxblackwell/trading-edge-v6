# Roadmap: Trading Edge V6

## Overview

Trading Edge V6 is a brownfield project — the core app (5 tabs, trade modal, AI coach, stats, design system) is already built and working. This roadmap covers the work required to make it production-ready: securing the API layer, adding Supabase auth and persistence, hardening stability, and shipping a proper PWA. The journey is: lock down security → move data to the cloud → harden the app shell → polish and refactor.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Auth & Security** - Add Supabase auth (email/password), move Gemini API key server-side, guard `/api/coach`
- [ ] **Phase 2: Supabase Persistence** - Migrate trades, coaching history, and pattern summary from localStorage to Supabase; add V5 data migration
- [ ] **Phase 3: Stability & PWA** - ErrorBoundary, bug fixes (history cap, ID generation, input validation), web app manifest, strategyText reactive state
- [ ] **Phase 4: Stats Refactor & Tests** - Split Stats.tsx monolith into focused components, add TypeScript test suite for core calculations
- [ ] **Phase 5: Polish & Cleanup** - Security headers, remove legacy HTML prototypes, clean up duplicate lib directories, legacy CoachingEntry fields

## Phase Details

### Phase 1: Auth & Security
**Goal**: Users can securely create accounts and log in; the Gemini API key is never exposed to the client; the coach route requires an authenticated session
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, SEC-01, SEC-02
**Success Criteria** (what must be TRUE):
  1. User can create an account with email/password and log in from the app — no manual API key entry required
  2. User session persists across browser restarts (no re-login on every visit)
  3. User can log out from any tab and is returned to the login screen
  4. `/api/coach` returns 401 for unauthenticated requests; the Gemini API key is a server-side env var never visible in network traffic or client code
**Plans**: TBD
**UI hint**: yes

### Phase 2: Supabase Persistence
**Goal**: All trade and coaching data lives in Supabase, scoped per authenticated user; localStorage becomes a read cache only; existing V5 data is migrated automatically on first login
**Depends on**: Phase 1
**Requirements**: PERSIST-01, PERSIST-02, PERSIST-03, PERSIST-04, PERSIST-05
**Success Criteria** (what must be TRUE):
  1. Trades logged in the app appear in the Supabase `trades` table scoped to the logged-in user, and persist across devices and browser clears
  2. Coaching history and pattern summary survive a full localStorage clear — data reloads from Supabase on next open
  3. A user with existing V5 localStorage data sees their historical trades and coaching history automatically imported on first authenticated login
  4. localStorage still serves as a fast read cache — the app renders existing data instantly before Supabase fetch completes
**Plans**: 4 plans
Plans:
- [ ] 02-01-PLAN.md — Phase 2 SQL schema (trades + coaching_entries with RLS) and dashboard schema push
- [ ] 02-02-PLAN.md — Serialization helpers (camelCase ↔ snake_case), useToast hook, Toast UI component
- [ ] 02-03-PLAN.md — Augment TradesContext with Supabase reads, optimistic writes, toast/rollback, strategyText state
- [ ] 02-04-PLAN.md — V5 localStorage → Supabase migration in AuthProvider (idempotent upsert + flag)

### Phase 3: Stability & PWA
**Goal**: The app shell is resilient to render errors; known bugs are fixed; the app installs correctly as a PWA on iPhone with name, icon, and splash screen
**Depends on**: Phase 2
**Requirements**: STABLE-01, STABLE-02, STABLE-03, STABLE-04, PWA-01, PWA-02, PWA-03
**Success Criteria** (what must be TRUE):
  1. A render error in one tab shows a fallback UI in that tab only — the other four tabs remain fully functional
  2. Coaching history entries 31–60 persist correctly across reloads (history cap bug is gone)
  3. Adding the app to iPhone Home Screen from Safari installs with the correct app name, icon, and splash screen
  4. Trade IDs and coaching entry IDs are UUIDs; the trade entry form rejects NaN values for P&L and R-mult before saving
**Plans**: TBD
**UI hint**: yes

### Phase 4: Stats Refactor & Tests
**Goal**: Stats.tsx is split into focused, independently testable components; core calculation logic has automated test coverage; TypeScript continues to compile clean
**Depends on**: Phase 3
**Requirements**: None (engineering quality work — no formal REQ-IDs; addresses CONCERNS.md: Stats.tsx 869+ lines, zero tests)
**Success Criteria** (what must be TRUE):
  1. Stats.tsx is split into at least 3 focused sub-components (KPI cards, equity curve, confluence bars) each under 250 lines
  2. A test suite covers P&L aggregation, R-mult calculations, and KPI derivations — all tests pass
  3. `npx tsc --noEmit` passes with zero errors after the refactor
**Plans**: TBD

### Phase 5: Polish & Cleanup
**Goal**: Security headers are configured, the repo is clean, and legacy technical debt is addressed
**Depends on**: Phase 4
**Requirements**: None (housekeeping work — addresses CONCERNS.md: no security headers, duplicate lib dirs, legacy HTML files, legacy CoachingEntry fields)
**Success Criteria** (what must be TRUE):
  1. `next.config.ts` emits `X-Frame-Options`, `Content-Security-Policy`, and `X-Content-Type-Options` headers in production
  2. Root `lib/` directory (shadcn scaffold) and large HTML prototype files are removed from the repo
  3. Legacy `CoachingEntry` fields (marketSnapshot, patterns, process, risk, priority, momentum) are cleaned up or formally documented as intentionally retained
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Auth & Security | 0/TBD | Not started | - |
| 2. Supabase Persistence | 0/TBD | Not started | - |
| 3. Stability & PWA | 0/TBD | Not started | - |
| 4. Stats Refactor & Tests | 0/TBD | Not started | - |
| 5. Polish & Cleanup | 0/TBD | Not started | - |

### Phase 6: AI Coach Enhancement: 3-API Infrastructure & Memory

**Goal**: Route AI coaching through a purpose-built 3-API infrastructure (Claude Sonnet for analyze/chat, Gemini 2.5 Flash for market-pulse/strategy-review, Yahoo Finance for all market data); add 5 persistent memory layers (session index with title recall, behavior ledger, milestone log, weakness profile, streak tracking) scoped per authenticated user
**Depends on**: Phase 2
**Requirements**: COACH-01, COACH-02, COACH-03, MEM-01, MEM-02, MEM-03, MEM-04, MEM-05
**Success Criteria** (what must be TRUE):
  1. Chat and Analyze modes call Claude Sonnet via Anthropic SDK; Market Pulse and Strategy Review call Gemini 2.5 Flash — routing is transparent to the user
  2. Market Pulse always fetches live Yahoo Finance data for all watchlist symbols and includes it in the Gemini context before any web search
  3. Behavior ledger tracks rule violation counts across sessions; weakness profile surfaces top-3 failure modes in every Analyze response
  4. Streak tracker counts consecutive rule-adherent days and win/loss streaks, displayed in Coach UI
  5. Milestone log records first profitable day, best R session, streak records — recalled in coaching responses
**Plans**: 4 plans
Plans:
- [x] 06-01-PLAN.md — Types & TradesContext memory state (SessionIndexEntry, BehaviorLedger, MilestoneLog, Streaks + updaters)
- [ ] 06-02-PLAN.md — Claude API integration in /api/coach route (dual-provider routing, VIOLATIONS parsing, memory computation)
- [ ] 06-03-PLAN.md — Account tab: Claude API key field
- [ ] 06-04-PLAN.md — Coach tab: memory response dispatch + streak display
**UI hint**: yes

### Phase 7: Market Data API Infrastructure

**Goal**: Extend the AI coaching infrastructure with multi-source market data — Alpha Vantage (technical indicators, economic data, news sentiment), FRED API (macro economic indicators), and Polygon.io (CME futures continuous contracts) — injected into coach context with a caching layer that keeps Alpha Vantage usage within the free tier (25 req/day)
**Depends on**: Phase 6
**Requirements**: MDATA-01, MDATA-02, MDATA-03, MDATA-04, MDATA-05
**Success Criteria** (what must be TRUE):
  1. Market Pulse and Analyze modes receive Alpha Vantage data (technical indicators, news sentiment, economic indicators) injected into Claude's context
  2. FRED API provides macro data (Fed funds rate, CPI, NFP, unemployment) as a free supplement to AV economic data
  3. Polygon.io supplies CME futures contract data (ES/NQ/MES/MNQ/YM/MYM) with continuous contract support
  4. A server-side cache (24hr TTL for economic/daily data, 15min for intraday) keeps AV usage under 25 requests/day
  5. No API call fails silently — graceful degradation when any data source is unavailable
**Plans**: TBD
**UI hint**: no
