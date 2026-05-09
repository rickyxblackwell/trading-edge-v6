# Trading Edge V6

## What This Is

A prop futures trading journal and AI coaching app, primarily for CME Group equity index futures (ES, NQ, MES, MNQ, YM, MYM) with adaptability to other instruments. Built for serious prop traders managing a $50k account — the app covers the full trading workflow: pre-trade preparation, trade logging, performance analytics, and AI-powered coaching feedback.

Target: iPhone 17 Pro (393×852pt) iOS Safari PWA, desktop secondary. Designed as a tool a trader opens every morning and uses throughout the session.

## Core Value

**The single thing that must work:** Log a trade → see your performance patterns → get specific AI coaching feedback → improve your process.

The loop is: journal → stats → coaching → better trading.

## Context

- **V5** was the initial Next.js migration from a single-file HTML V4 prototype. Complete, preserved at `../Trading App Full-Stack V5`.
- **V6** is the active development branch. GSD-based workflow. Same localStorage keys as V5 (`edge_v5_*`) for data continuity.
- **Stack:** Next.js 16 App Router · React 19 · TypeScript (strict) · Tailwind CSS v4
- **AI Coach:** Gemini 2.5-flash via `@google/genai`, 4 modes, Google Search grounding for 2 modes
- **Design system:** Midnight Market — deep navy glassmorphism, IBM Plex Mono on all numbers, ambient orbs

## Requirements

### Validated (Existing — Shipping)

- ✓ 5-tab shell (Strategy · Checklist · Journal · Stats · Coach) — responsive sidebar/bottom bar
- ✓ Trade entry modal — FAB button, full Trade schema (instrument, direction, session, P&L, R-mult, confluences, notes)
- ✓ Stats — 12 KPIs, equity curve (5d/30d/3m/6m/1y/all), confluence performance bars, P&L by day of week
- ✓ Journal — collapsible trade cards, expand for full detail, delete
- ✓ Coach — Gemini 2.5-flash, 4 modes (Analyze · Market Pulse · Strategy Review · Chat), rolling pattern memory, session history feed with AI-generated titles, archive system
- ✓ Strategy tab — TF ladder (1D→1M), 10 confluences (C1-C10), kill switches, liquidity targeting, session timing
- ✓ TypeScript strict — compiles clean

### Active (Building)

- [ ] **AUTH-01:** User can create account and log in with email/password via Supabase Auth
- [ ] **AUTH-02:** User session persists across app restarts (no re-login on every visit)
- [ ] **AUTH-03:** User can log out
- [ ] **SEC-01:** Gemini API key stored server-side (env var), never sent to client
- [ ] **SEC-02:** `/api/coach` route requires authenticated session
- [ ] **PERSIST-01:** Trades stored in Supabase (replace localStorage write)
- [ ] **PERSIST-02:** Coaching history stored in Supabase
- [ ] **PERSIST-03:** Pattern summary stored in Supabase
- [ ] **PERSIST-04:** localStorage used as offline cache/fallback only
- [ ] **STABLE-01:** ErrorBoundary wraps app shell — one tab crash doesn't kill the app
- [ ] **STABLE-02:** Coaching history cap bug fixed (60 in-memory vs 30 persisted mismatch)
- [ ] **STABLE-03:** Trade IDs use `crypto.randomUUID()` instead of `Math.random()`
- [ ] **PWA-01:** Web app manifest with name, icon, splash screen (enables proper iPhone home screen install)
- [ ] **PWA-02:** `strategyText` managed as reactive state in TradesContext (not direct localStorage write)

### Out of Scope (V1)

- Social/sharing features — not a social app
- Multi-instrument portfolio management (stocks, options, crypto) — futures-first, CME Group primary
- TradingView or broker API integration — manual journal is intentional for discipline
- Mobile native app (React Native / Expo) — PWA covers iPhone use case
- Multi-user / team features — single trader per account

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase for auth + persistence | Managed auth, Postgres, realtime — fits Next.js App Router well | Planned Phase 1-2 |
| Keep `edge_v5_*` localStorage keys during migration | Preserve existing user data across V5→V6 | Active |
| Gemini 2.5-flash as AI coach | Cost-effective, Google Search grounding for market-pulse/strategy-review modes | Validated |
| IBM Plex Mono on all numbers | Design system rule — enforced across all components | Active |
| No custom agents (deleted) | GSD built-ins replace research/QA/review agents; custom agents caused RAM issues via Chrome DevTools loops | Decided this session |

## Constraints

- **RAM:** Chrome DevTools MCP causes memory explosion when used in loops — single screenshots only, on explicit request
- **LocalStorage keys:** `edge_v5_*` prefix must be preserved until explicit migration with data transformation
- **TypeScript:** `npx tsc --noEmit` must pass before any phase is marked complete
- **Design:** No hardcoded hex values, no `transition: all`, IBM Plex Mono on every number — non-negotiable

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements completed? → Move to Validated with phase reference
2. New requirements emerged? → Add to Active
3. Decisions to log? → Add to Key Decisions
4. "What This Is" still accurate? → Update if drifted

---
*Last updated: 2026-05-05 after project initialization*
