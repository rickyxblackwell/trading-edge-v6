# Roadmap: Trading Edge V6

## Overview

Trading Edge V6 is a brownfield project — the core app (5 tabs, trade modal, AI coach, stats, design system) is already built and working. This roadmap covers the work required to make it production-ready: securing the API layer, adding Supabase auth and persistence, hardening stability, and shipping a proper PWA. The journey is: lock down security → move data to the cloud → harden the app shell → polish and refactor.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Auth & Security** - Supabase auth (email/password), API keys server-side in user metadata, `/api/coach` guarded with 401
- [x] **Phase 2: Supabase Persistence** - Trades, coaching history, and pattern summary in Supabase; V5 localStorage migration; localStorage as read cache
- [x] **Phase 3: Stability & PWA** - ErrorBoundary, bug fixes (history cap, ID generation, input validation), web app manifest, strategyText reactive state (completed 2026-05-09)
- [ ] **Phase 4: Stats Refactor & Tests** - Split Stats.tsx monolith into focused components, add TypeScript test suite for core calculations
- [ ] **Phase 5: Polish & Cleanup** - Security headers, remove legacy HTML prototypes, clean up duplicate lib directories, legacy CoachingEntry fields

## Phase Details

### Phase 1: Auth & Security
**Goal**: Users can securely create accounts and log in; all API keys are server-side only; the coach route requires an authenticated session
**Depends on**: Nothing (first phase)
**Status**: COMPLETE
**Success Criteria** (what must be TRUE):
  1. ✅ User can create an account with email/password and log in — login/signup pages at `app/(auth)/`
  2. ✅ User session persists across browser restarts via `onAuthStateChange`
  3. ✅ User can log out and is returned to the login screen
  4. ✅ `/api/coach` returns 401 for unauthenticated requests; all API keys (Gemini, Claude, AV, Polygon) live in Supabase user metadata server-side

### Phase 2: Supabase Persistence
**Goal**: All trade and coaching data lives in Supabase, scoped per authenticated user; localStorage is a read cache; existing V5 data migrates automatically on first login
**Depends on**: Phase 1
**Status**: COMPLETE
**Success Criteria** (what must be TRUE):
  1. ✅ Trades write to `supabase.from("trades")` with optimistic updates and toast/rollback
  2. ✅ Coaching history writes to `supabase.from("coaching_entries")` with same pattern
  3. ✅ `runV5Migration` in AuthProvider upserts all `edge_v5_*` localStorage data idempotently on first login
  4. ✅ localStorage hydrates first (instant render), Supabase overwrites after auth resolves
**Plans**:
- [x] 02-01-PLAN.md — Phase 2 SQL schema (trades + coaching_entries with RLS) and dashboard schema push
- [x] 02-02-PLAN.md — Serialization helpers (camelCase ↔ snake_case), useToast hook, Toast UI component
- [x] 02-03-PLAN.md — Augment TradesContext with Supabase reads, optimistic writes, toast/rollback, strategyText state
- [x] 02-04-PLAN.md — V5 localStorage → Supabase migration in AuthProvider (idempotent upsert + flag)

### Phase 3: Stability & PWA
**Goal**: The app shell is resilient to render errors; known bugs are fixed; the app installs correctly as a PWA on iPhone with name, icon, and splash screen
**Depends on**: Phase 2
**Status**: Ready to execute
**Requirements**: STABLE-01, STABLE-02, STABLE-03, STABLE-04, PWA-01, PWA-02, PWA-03
**Success Criteria** (what must be TRUE):
  1. A render error in one tab shows a fallback UI in that tab only — the other four tabs remain fully functional
  2. Coaching history entries 31–60 persist correctly across reloads (history cap bug is gone)
  3. Adding the app to iPhone Home Screen from Safari installs with the correct app name, icon, and splash screen
  4. Trade IDs and coaching entry IDs are UUIDs; the trade entry form rejects NaN values for P&L and R-mult before saving
**Plans**:
- [x] 03-01-PLAN.md — TabErrorBoundary component + per-tab placement in page.tsx (STABLE-01)
- [x] 03-02-PLAN.md — UUID migration (3 files), NaN input guard in TradeForm, history cap fix (STABLE-02, STABLE-03, STABLE-04)
- [x] 03-03-PLAN.md — PWA manifest.ts, layout.tsx apple-touch-icon, icon PNGs, PWA-03 verification (PWA-01, PWA-02, PWA-03)

### Phase 4: Stats Refactor & Tests
**Goal**: Stats.tsx is split into focused, independently testable components; core calculation logic has automated test coverage; TypeScript continues to compile clean
**Depends on**: Phase 3
**Success Criteria** (what must be TRUE):
  1. Stats.tsx is split into at least 3 focused sub-components (KPI cards, equity curve, confluence bars) each under 250 lines
  2. A test suite covers P&L aggregation, R-mult calculations, and KPI derivations — all tests pass
  3. `npx tsc --noEmit` passes with zero errors after the refactor

### Phase 5: Polish & Cleanup
**Goal**: Security headers are configured, the repo is clean, and legacy technical debt is addressed
**Depends on**: Phase 4
**Success Criteria** (what must be TRUE):
  1. `next.config.ts` emits `X-Frame-Options`, `Content-Security-Policy`, and `X-Content-Type-Options` headers in production
  2. Root `lib/` directory (shadcn scaffold) and large HTML prototype files are removed from the repo
  3. Legacy `CoachingEntry` fields (marketSnapshot, patterns, process, risk, priority, momentum) are cleaned up or formally documented as intentionally retained

### Phase 6: AI Coach Enhancement — Memory & Multi-Tool Infrastructure
**Goal**: Claude Sonnet is the primary AI for all coaching modes; Gemini, Yahoo Finance, FRED, Polygon, and Alpha Vantage are tools Claude can call; 5 persistent memory layers (session index, behavior ledger, milestone log, weakness profile, streak tracking) are scoped per authenticated user
**Depends on**: Phase 2
**Status**: COMPLETE
**Architecture**: Claude Sonnet is the single primary AI. All other providers are tools within the agentic loop — `searchGemini` (web search via Gemini), `fetchYahooFinanceSnapshot`, `fetchFREDSeries`, `fetchPolygonFutures`, `fetchAlphaVantage`. Claude decides which tools to call based on the mode and user query.
**Success Criteria** (what must be TRUE):
  1. ✅ All coaching modes (analyze, market-pulse, strategy-review, chat) route through Claude Sonnet as primary
  2. ✅ All other APIs (Gemini, Yahoo Finance, FRED, Polygon, Alpha Vantage) are tools Claude invokes via the agentic loop
  3. ✅ Behavior ledger tracks rule violation counts; weakness profile surfaces top-3 failure modes in Analyze responses
  4. ✅ Streak tracker counts consecutive rule-adherent days and win/loss streaks
  5. ✅ Milestone log records first profitable day, best R session, streak records
**Plans**:
- [x] 06-01-PLAN.md — Types & TradesContext memory state (SessionIndexEntry, BehaviorLedger, MilestoneLog, Streaks + updaters)
- [x] 06-02-PLAN.md — Claude API integration in /api/coach route (agentic loop, VIOLATIONS parsing, memory computation)
- [x] 06-03-PLAN.md — Account tab: Claude API key field
- [x] 06-04-PLAN.md — Coach tab: memory response dispatch + streak display

### Phase 7: Market Data API Infrastructure
**Goal**: Claude's agentic loop has access to multi-source market data — Alpha Vantage (technical indicators, news sentiment), FRED (macro economic indicators), Polygon.io (CME futures), and Yahoo Finance (live quotes) — via tool calls, with a caching layer that keeps Alpha Vantage usage within the free tier (25 req/day)
**Depends on**: Phase 6
**Status**: COMPLETE
**Success Criteria** (what must be TRUE):
  1. ✅ Claude can call `fetchAlphaVantage` for RSI, MACD, and news sentiment via the agentic loop
  2. ✅ Claude can call `fetchFREDSeries` for macro data (Fed funds rate, CPI, NFP, unemployment)
  3. ✅ Claude can call `fetchPolygonFutures` for CME futures contract data (ES/NQ/MES/MNQ)
  4. ✅ `unstable_cache` wrappers provide 1hr TTL for AV/intraday and 24hr TTL for Polygon/economic data
  5. ✅ All tool calls degrade gracefully — empty string returned on failure, loop continues
**Open item**: No hard request counter enforcing the 25 req/day AV limit — TTL caching mitigates risk for single-user usage
**Plans**:
- [x] 07-01-PLAN.md — Wave 0: provision SUPABASE_SERVICE_ROLE_KEY + FRED_API_KEY + verify Polygon CME futures tier
- [x] 07-02-PLAN.md — Account tab: Alpha Vantage + Polygon.io API key entry cards
- [x] 07-03-PLAN.md — route.ts module-level helpers: admin client, EOD key, FRED/Polygon/Gemini fetchers, cache wrappers, tool defs, executeToolCall dispatcher
- [x] 07-04-PLAN.md — route.ts agentic loop: anthropic.messages.create + 10-iteration cap + service-role memory write + rate-limit error responses
- [x] 07-05-PLAN.md — Coach.tsx rate-limit (yellow) + key-error (red) notification boxes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 (6 and 7 completed out of order)

| Phase | Status | Completed |
|-------|--------|-----------|
| 1. Auth & Security | ✅ Complete | Yes |
| 2. Supabase Persistence | ✅ Complete | Yes |
| 3. Stability & PWA | 📋 Planned (3 plans) | - |
| 4. Stats Refactor & Tests | ⬜ Not started | - |
| 5. Polish & Cleanup | ⬜ Not started | - |
| 6. AI Coach Enhancement | ✅ Complete | Yes |
| 7. Market Data API Infrastructure | ✅ Complete | Yes |
