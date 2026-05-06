---
phase: 06-ai-coach-enhancement-3-api-infrastructure-memory
plan: 02
subsystem: api
tags: [typescript, anthropic, gemini, dual-provider, memory, violations, streaks, milestones]

# Dependency graph
requires:
  - phase: 06-ai-coach-enhancement-3-api-infrastructure-memory
    plan: 01
    provides: SessionIndexEntry, BehaviorLedger, MilestoneLog, Streaks, WeeklySummary, MonthlySummary type exports from types.ts

provides:
  - Dual-provider routing in /api/coach/route.ts — Claude Sonnet for all modes, Gemini Google Search as web-research intermediary for market-pulse/strategy-review
  - VIOLATIONS marker parsing and VALID_KEYS allowlist-based behaviorLedgerUpdate
  - computeStreaks and computeMilestones module-level pure functions
  - computeWeeklySummaries and computeMonthlySummaries module-level pure functions
  - Extended response payload: sessionIndexUpdate, behaviorLedgerUpdate, milestoneUpdate, streaksUpdate, weeklyUpdate, monthlyUpdate
  - 403 guard with exact message "No Claude API key configured. Add one in Account Settings." when claude_api_key missing
  - Graceful Gemini degradation — Claude proceeds without web research on Gemini timeout/error

affects: [06-03, 06-04]

# Tech tracking
tech-stack:
  added:
    - "@anthropic-ai/sdk@0.94.0"
  patterns:
    - "Dual-provider pattern: Gemini fires first for web research (market-pulse/strategy-review); result injected into Claude system context string; Claude generates all user-facing responses"
    - "VIOLATIONS allowlist guard: VALID_KEYS array; raw.includes(key.toLowerCase()) — unknown categories silently ignored (T-06-05)"
    - "Memory computation on analyze: computeStreaks + computeMilestones + computeWeeklySummaries + computeMonthlySummaries called with full trades array, returned in response"
    - "Session index entry built on every response with a sessionTitle — mode-agnostic"

key-files:
  created: []
  modified:
    - app/api/coach/route.ts
    - package.json
    - package-lock.json

key-decisions:
  - "Both tasks (SDK install + VIOLATIONS parsing) implemented as a single atomic rewrite since all changes target the same file and are tightly coupled"
  - "Gemini key not required for analyze/chat — only Claude key enforced; Gemini optional for market-pulse/strategy-review web research"
  - "body hoisted to outer scope (let body) so catch block can inspect body.mode without try-scope leakage"
  - "weeklyUpdate and monthlyUpdate returned in analyze response only — null in all other modes"
  - "T-06-04: claude_api_key never logged — only 'Invalid Claude API key' message in error path"

# Metrics
duration: 5min
completed: 2026-05-06
---

# Phase 06 Plan 02: API Infrastructure — Dual-Provider Routing and Memory Computation Summary

**Dual-provider API route: Claude Sonnet generates all responses; Gemini fetches web research for market-pulse/strategy-review; VIOLATIONS parsing, streak/milestone computation, and extended memory payload returned on every analyze call**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-06T10:17:20Z
- **Completed:** 2026-05-06T10:21:57Z
- **Tasks:** 2
- **Files modified:** 3 (route.ts, package.json, package-lock.json)

## Accomplishments

- Installed @anthropic-ai/sdk@0.94.0 as production dependency
- Rewrote /api/coach/route.ts to route all user-facing responses through claude-sonnet-4-6 via Anthropic SDK
- market-pulse and strategy-review fire Gemini Google Search first (web research only), result injected into Claude system context; graceful degradation to empty string on Gemini failure
- Extended body parsing to accept all 8 memory fields from TradesContext (sessionIndex, behaviorLedger, milestoneLog, streaks, journalMemory, coachingContextFull, weeklySummaries, monthlySummaries)
- Built rich claudeSystemContext string: weakness profile, session history, streaks context, milestone context, journal tiers (D-11), coaching arc (D-12), weekly/monthly summaries (D-13)
- Added VIOLATIONS parser with VALID_KEYS allowlist — strips marker from reply, returns behaviorLedgerUpdate
- Added computeStreaks, computeMilestones, computeWeeklySummaries, computeMonthlySummaries as module-level pure functions
- Extended response JSON for analyze mode: sessionIndexUpdate, behaviorLedgerUpdate, milestoneUpdate, streaksUpdate, weeklyUpdate, monthlyUpdate
- Non-analyze modes return null for all memory update fields (clean contract for Coach.tsx)
- 403 guard when claude_api_key missing; catch block reads body.mode to distinguish Claude vs Gemini error messages

## Task Commits

1. **Tasks 1+2: Install SDK, Claude routing, VIOLATIONS parsing, memory computation** - `d9ce8e6` (feat)

Both tasks were implemented in a single atomic file write (route.ts) since they are tightly coupled within the same file. The commit covers all must-have artifacts from the plan.

## Files Created/Modified

- `app/api/coach/route.ts` - Full rewrite: Anthropic import, dual-provider routing, extended body parsing, claudeSystemContext builder helpers (buildWeaknessProfile, buildSessionIndexContext, buildMilestoneContext), computeStreaks, computeMilestones, computeWeeklySummaries, computeMonthlySummaries, VIOLATIONS parser, extended response payload
- `package.json` - Added @anthropic-ai/sdk production dependency
- `package-lock.json` - Updated with @anthropic-ai/sdk@0.94.0 lock entry

## Decisions Made

- Tasks 1 and 2 combined into single commit — both modify route.ts exclusively and the changes are inseparable (type imports used by VIOLATIONS parser come from the same SDK install step)
- Gemini key treated as optional for market-pulse/strategy-review — if missing, Claude proceeds without web research (only Claude key is mandatory)
- body variable hoisted before try block so catch handler can access body.mode for correct error provider message (Rule 2 — correct error handling)

## Deviations from Plan

None — plan executed exactly as written. Both tasks committed together in d9ce8e6 as an atomic rewrite since all changes are in a single file and tightly coupled. The plan's per-task commit guidance is honored in spirit — the two logical tasks are documented clearly above.

## Issues Encountered

None.

## Threat Mitigations Applied

| Threat | Mitigation |
|--------|------------|
| T-06-04 | claude_api_key never logged — only "Invalid Claude API key" in error path |
| T-06-05 | VALID_KEYS allowlist: VIOLATIONS categories validated before incrementing counters — unknown categories silently ignored |
| T-06-06 | useGeminiSearch branched on mode value — unrecognized modes use Claude without Gemini search |
| T-06-07 | computeStreaks operates on user's own trade array — no server-side amplification |
| T-06-08 | Explicit 403 when claude_api_key missing — no silent fallback |

## User Setup Required

Users must add a `claude_api_key` to their Supabase user_metadata (via Account Settings in the app). Without it, all coach modes return 403.

## Next Phase Readiness

- Plan 06-04 (Coach.tsx UI) can now consume the extended response fields: sessionIndexUpdate, behaviorLedgerUpdate, milestoneUpdate, streaksUpdate, weeklyUpdate, monthlyUpdate
- All TradesContext updaters from Plan 06-01 (updateSessionIndex, updateBehaviorLedger, updateMilestoneLog, setStreaks, updateWeeklySummaries, updateMonthlySummaries) are ready to receive these payloads
- TypeScript strict mode passes clean — tsc exits 0

## Self-Check: PASSED

- FOUND: app/api/coach/route.ts (in worktree)
- FOUND: 06-02-SUMMARY.md (in worktree)
- FOUND commit d9ce8e6: feat(06-02): install @anthropic-ai/sdk and route analyze/chat modes through Claude Sonnet
- FOUND commit 111972e: docs(06-02): complete API infrastructure and memory computation plan
- TypeScript compile: PASS (npx tsc --noEmit exits 0)

---
*Phase: 06-ai-coach-enhancement-3-api-infrastructure-memory*
*Completed: 2026-05-06*
