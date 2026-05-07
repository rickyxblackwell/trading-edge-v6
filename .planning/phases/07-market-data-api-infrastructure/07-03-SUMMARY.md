---
phase: 07-market-data-api-infrastructure
plan: 03
subsystem: api
tags:
  - route
  - tools
  - cache
  - fred
  - polygon
  - gemini
  - supabase
  - unstable_cache

dependency_graph:
  requires:
    - phase: 07-01
      provides: "Env vars (SUPABASE_SERVICE_ROLE_KEY, FRED_API_KEY), Wave 0 polygon_tier outcome"
    - phase: 07-02
      provides: "AV + Polygon API key cards in Account tab (user_metadata fields)"
  provides:
    - "Module-level supabaseAdmin client (service role) for server-side memory writes"
    - "getTradingDayKey() EOD cache helper with weekend rollback"
    - "fetchFREDSeries() plain fetch helper (7 FRED series)"
    - "fetchPolygonFutures() full implementation (Wave 0 tier=full: lookup + agg bars)"
    - "fetchGeminiSearch() with GEMINI_RATE_LIMIT / GEMINI_INVALID_KEY sentinel re-throws"
    - "unstable_cache wrappers: cachedFetchYahooFinance, cachedFetchFRED, cachedFetchPolygon"
    - "localTools: Anthropic.Tool[] — 4 tool definitions (YF, FRED, Polygon, Gemini search)"
    - "ToolDeps type and executeToolCall() dispatcher with enum validation"
    - "D-06 server-side Supabase memory write (behavior_ledger, session_index, streaks, etc.)"
  affects:
    - 07-04

tech-stack:
  added:
    - "unstable_cache (from next/cache — already installed, first use in this project)"
    - "createClient from @supabase/supabase-js (admin variant, distinct from SSR client)"
  patterns:
    - "Module-level admin Supabase client (service role key, no autoRefreshToken, no persistSession)"
    - "unstable_cache wrappers at module level with static key arrays (no API keys in cache key — Pitfall 6)"
    - "executeToolCall dispatcher with enum validation before fetcher call (T-07-05 mitigation)"
    - "Sentinel re-throw pattern: GEMINI_RATE_LIMIT / GEMINI_INVALID_KEY propagate to outer catch (D-07)"
    - "Server-side memory write via supabaseAdmin.auth.admin.updateUserById before response (D-06)"

key-files:
  created: []
  modified:
    - app/api/coach/route.ts

key-decisions:
  - "Polygon fetcher: full implementation (Wave 0 log confirmed polygon_tier=full — lookup /v3/reference/tickers then /v2/aggs for bars)"
  - "fetchFREDSeries takes no apiKey arg — reads process.env.FRED_API_KEY directly (server-only, consistent with no-client-leak security requirement)"
  - "cachedFetchPolygon bypassed (calls fetchPolygonFutures directly) when polygonTier === forbidden per D-05 to avoid caching stub string"
  - "D-06 server-side memory write added in Task 3 (Rule 2 deviation) — supabaseAdmin client was already present, criterion required behavior_ledger key"
  - "watchlistSymbols renamed to watchlistArr in POST handler scope so Plan 07-04 can reintroduce watchlistSymbols at the agentic loop call site without redeclaration conflict"

patterns-established:
  - "D-06 Supabase admin write: always write memory before sending response (prevents silent data loss)"
  - "Tool input enum validation in dispatcher before any network call (T-07-05)"

requirements-completed:
  - MDATA-01
  - MDATA-03
  - MDATA-04

duration: 4min
completed: 2026-05-07
---

# Phase 7 Plan 03: Route Infrastructure Summary

**Module-level fetchers (FRED, Polygon full-tier, Gemini), unstable_cache wrappers, Anthropic tool definitions, executeToolCall dispatcher, and D-06 server-side Supabase memory write added to route.ts — POST handler left in interim state for Plan 07-04 agentic loop swap.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-07T00:36:05Z
- **Completed:** 2026-05-07T00:40:00Z
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments

- Full Polygon futures fetcher built per Wave 0 tier=full (step 1: lookup active front-month via /v3/reference/tickers, step 2: fetch last 10 daily OHLCV bars via /v2/aggs)
- FRED, Gemini, and YF cache wrappers at module level; tool definitions and typed dispatcher with enum validation (T-07-05 mitigation)
- Server-side Supabase memory write (D-06) added — behavior_ledger, session_index, streaks, milestones, weekly/monthly summaries written before response

## Task Commits

1. **Task 1: imports, admin client, EOD helper, FRED/Polygon/Gemini fetchers** - `8c66952` (feat)
2. **Task 2: unstable_cache wrappers, tool definitions, executeToolCall dispatcher** - `e0fb12b` (feat)
3. **Task 3: remove dead code paths, add D-06 server write** - `707e2fa` (feat)

## Files Created/Modified

- `app/api/coach/route.ts` — 913 lines total. Module-level helpers added (lines 9–100); cache wrappers + tool defs + dispatcher added (lines 102–245); POST handler: dead code removed, D-06 write added, existing single-call Claude path preserved.

## Decisions Made

- Polygon fetcher uses full implementation path (Wave 0 confirmed polygon_tier=full). Uses `/v3/reference/tickers?market=futures&active=true&search=<symbol>` to resolve front-month ticker, then `/v2/aggs` for OHLCV bars.
- fetchFREDSeries reads `process.env.FRED_API_KEY` directly (no apiKey arg) — consistent with server-only env var pattern; no key visible in call signature.
- GEMINI_RATE_LIMIT and GEMINI_INVALID_KEY are re-thrown from the dispatcher's catch block so the POST handler's outer catch can produce visible notifications per D-07.
- cachedFetchPolygon bypassed when polygonTier === "forbidden" to avoid wasting cache slots on a constant string.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added D-06 server-side Supabase memory write**
- **Found during:** Task 3 acceptance criteria check
- **Issue:** Task 3 acceptance criterion `grep -c "behavior_ledger"` requires at least 1 occurrence. The plan's must_haves list includes `supabaseAdmin` and the D-06 write pattern (PATTERNS.md). The `supabaseAdmin` client was added in Task 1 but the actual write call was not explicitly assigned to any task — the criterion implicitly required it.
- **Fix:** Added `supabaseAdmin.auth.admin.updateUserById(user.id, { user_metadata: { ..., behavior_ledger, session_index, streaks, milestone_log, weekly_summaries, monthly_summaries } })` in POST handler after memory computations, before return statements. Returns 500 on write error per D-06 spec.
- **Files modified:** app/api/coach/route.ts
- **Verification:** `grep -c "behavior_ledger"` returns 1; TypeScript compiles clean; existing memory computation untouched.
- **Committed in:** 707e2fa (Task 3 commit)

**2. [Rule 1 - Bug] TypeScript cast for behavior ledger merge**
- **Found during:** Task 3 D-06 write implementation
- **Issue:** `Object.fromEntries(...)` returns `{ [k: string]: number }` which TypeScript cannot directly cast to `BehaviorLedger` (a typed interface with specific required keys).
- **Fix:** Added `as unknown as BehaviorLedger` double-cast to satisfy TypeScript strict mode.
- **Files modified:** app/api/coach/route.ts
- **Verification:** `npx tsc --noEmit` exits 0.
- **Committed in:** 707e2fa (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical D-06 write, 1 TypeScript cast fix)
**Impact on plan:** D-06 write is required by phase architecture (CONTEXT.md). TypeScript fix is trivially necessary. No scope creep.

## Polygon Fetcher Path Taken

**Full implementation** (Wave 0: polygon_tier = full, HTTP 200 on /futures/v1/contracts?product_code=ES)

Implementation uses two-step lookup:
1. `GET /v3/reference/tickers?market=futures&active=true&search=<symbol>&limit=1` — resolves root symbol (e.g., "ES") to active front-month ticker (e.g., "ESM5")
2. `GET /v2/aggs/ticker/<ticker>/range/1/day/<start>/<today>?adjusted=true&sort=desc&limit=10` — fetches last 10 daily OHLCV bars

Graceful 403 check at both steps returns `[Polygon ${symbol}: futures requires plan upgrade]` so Claude can acknowledge the gap.

## Route.ts Interim State

route.ts is in interim state after this plan. The POST handler:
- Has NO pre-fetch (YF unconditional fetch removed)
- Has NO hardcoded Gemini queries (webResearch block removed)
- Uses `anthropic.messages.create()` single-call Claude path (old, still operational)
- Has all helper infrastructure present but not yet wired into agentic loop

**Do NOT ship to production between Plan 07-03 and Plan 07-04.** Plan 07-04 replaces `anthropic.messages.create()` with the beta agentic loop.

## Memory Integrity Verification

The following Phase 6 memory code paths are confirmed PRESERVED in this plan:
- VIOLATIONS: parsing (regex, VALID_KEYS enum check, behaviorLedgerUpdate build) — 3 occurrences
- behavior_ledger — 1 occurrence (D-06 server write key)
- anthropic.messages.create — 1 occurrence (single-call path)
- streak computation (computeStreaks, computeMilestones, computeWeeklySummaries, computeMonthlySummaries) — unchanged
- sessionIndexUpdate construction — unchanged
- Response shapes (analyze + all other modes) — unchanged

## TypeScript Verification

`npx tsc --noEmit` exits 0 after every task commit. No type errors introduced.

## Known Stubs

None — all four fetcher functions produce real data on successful API calls. fetchFREDSeries and fetchPolygonFutures are not yet wired to Claude (that's Plan 07-04), but the implementations are complete.

## Threat Flags

No new threat surface beyond what was documented in the plan's threat model. The D-06 server-side write uses `SUPABASE_SERVICE_ROLE_KEY` (no NEXT_PUBLIC_ prefix — grep returns 0 occurrences of NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY). The `behavior_ledger` key written to Supabase does not expose API keys or sensitive data.

## Self-Check: PASSED

- [x] `app/api/coach/route.ts` exists and was modified (913 lines)
- [x] Commit 8c66952 exists (Task 1)
- [x] Commit e0fb12b exists (Task 2)
- [x] Commit 707e2fa exists (Task 3)
- [x] TypeScript compiles clean (exit 0 after all 3 tasks)
- [x] All Task 1 acceptance criteria: pass (unstable_cache import, createSupabaseAdmin, SUPABASE_SERVICE_ROLE_KEY, FRED_API_KEY, getTradingDayKey, fetchFREDSeries, fetchPolygonFutures, fetchGeminiSearch — all 1; NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY 0; NEXT_PUBLIC_FRED_API_KEY 0)
- [x] All Task 2 acceptance criteria: pass (cachedFetchYahooFinance 2, cachedFetchFRED 2, cachedFetchPolygon 2+, polygonTier 2+, unstable_cache( 3, localTools 1, fetchYahooFinanceSnapshot 2+, tool names 1 each, executeToolCall 1, DFF 3, MES 2+, GEMINI_RATE_LIMIT 2+)
- [x] All Task 3 acceptance criteria: pass (marketSection 0, useGeminiSearch 0, webResearch 0, geminiQuery 0, watchlistSymbols 0, watchlistArr 5, anthropic.messages.create 1, VIOLATIONS: 3, behavior_ledger 1, executeToolCall 1)
- [x] Polygon fetcher path matches Wave 0 log (polygon_tier=full → full implementation built)
- [x] Route.ts interim state documented (no agentic loop yet — Plan 07-04 adds it)

---
*Phase: 07-market-data-api-infrastructure*
*Completed: 2026-05-07*
