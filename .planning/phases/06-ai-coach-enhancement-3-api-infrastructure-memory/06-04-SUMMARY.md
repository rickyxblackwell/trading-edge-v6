---
phase: 06-ai-coach-enhancement-3-api-infrastructure-memory
plan: "04"
subsystem: coach-ui
tags: [coach, memory, streaks, onboarding, react, typescript]

dependency_graph:
  requires:
    - "06-01"
    - "06-02"
  provides:
    - Coach.tsx sendMessage dispatches all 6 memory update fields to TradesContext
    - Coach.tsx request body includes sessionIndex, behaviorLedger, milestoneLog, streaks, journalMemory, coachingContextFull, weeklySummaries, monthlySummaries
    - Streak display in Coach memory section (currentWin, currentLoss, ruleAdherentDays)
    - Session-local onboarding modal with 3 RuleCard-style rows (Commands, Memory, AI Stack)
    - Footer label shows Claude Sonnet with conditional Gemini Search badge for market-pulse/strategy-review
  affects: []

tech_stack:
  added: []
  patterns:
    - "activeMode state tracks last mode sent; used in footer label — avoids stale closure from mode local var in sendMessage"
    - "showOnboarding useState(true) — session-local reset on every ChatView mount, no localStorage write"
    - "setShowOnboarding(false) before early return guards so even rejected sends dismiss the modal"
    - "buildCoachingContextSelection: first-ever entry always included, recency-prioritised, scales to any history length (D-12)"

key_files:
  created: []
  modified:
    - app/components/tabs/Coach.tsx

decisions:
  - "All 3 tasks committed separately even though they modify the same file — per plan task commit protocol"
  - "showOnboarding placed before early return so rapid send attempts still dismiss the modal"
  - "Old generic empty state (glass AI icon) replaced entirely by onboarding modal — cleaner and more informative for new sessions"

metrics:
  duration: "3min"
  completed: "2026-05-06T10:29:37Z"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 1
---

# Phase 06 Plan 04: Coach.tsx Memory Integration and Onboarding Summary

**One-liner:** Coach.tsx closes the memory loop: sendMessage dispatches all 6 API response memory update fields to TradesContext, sends all 8 memory context fields in the request body, streak display in memory section, and a session-local 3-row onboarding modal on ChatView mount.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend sendMessage with memory dispatch and context fields | 5fa1f36 | app/components/tabs/Coach.tsx |
| 2 | Add streak display to Coach memory section | e353476 | app/components/tabs/Coach.tsx |
| 3 | Add session-local onboarding modal to ChatView | 936c1d5 | app/components/tabs/Coach.tsx |

## What Was Built

### Task 1: sendMessage Memory Extension

- Added `buildCoachingContextSelection` module-level pure function — D-12 temporal sampling: first-ever session always included, last-20 recency prioritised, up to 15 sampled from middle using stride step
- Expanded `useTrades` destructure to include all 7 memory fields + updaters: `sessionIndex`, `updateSessionIndex`, `behaviorLedger`, `updateBehaviorLedger`, `milestoneLog`, `updateMilestoneLog`, `streaks`, `updateStreaks`, `journalMemory`, `weeklySummaries`, `updateWeeklySummaries`, `monthlySummaries`, `updateMonthlySummaries`
- Added `activeMode` state; set at start of `sendMessage` for footer label rendering
- Extended `JSON.stringify` request body with all 8 memory fields: `sessionIndex`, `behaviorLedger`, `milestoneLog`, `streaks`, `journalMemory`, `coachingContextFull`, `weeklySummaries`, `monthlySummaries`
- Added 6 memory update dispatches after `updatePatternSummary`: `sessionIndexUpdate`, `behaviorLedgerUpdate`, `milestoneUpdate`, `streaksUpdate`, `weeklyUpdate`, `monthlyUpdate`
- Updated footer label to `Claude Sonnet · Gemini Search · Yahoo Finance · memory: {status}` with conditional Gemini Search badge for market-pulse and strategy-review

### Task 2: Streak Display

- Added streak row below watchlist line in memory status section
- Conditional render: only shown when `streaks.currentWin > 0 || streaks.currentLoss > 0 || streaks.ruleAdherentDays > 0`
- Win streak in `var(--green)`, loss streak in `var(--red)`, rule-adherent days in `var(--text2)`
- All 3 numeric values wrapped in `<span className="mono">` — IBM Plex Mono enforced

### Task 3: Session-Local Onboarding Modal

- `showOnboarding` state initialised to `true` — resets on every `ChatView` mount, no localStorage write
- `setShowOnboarding(false)` fires at top of `sendMessage` before early return guards
- Modal renders at `showOnboarding && messages.length === 0` — placed above messages feed in scroll container
- Three RuleCard-style rows with `borderLeft: 3px solid ${color}` pattern:
  - Commands row: `var(--accent)` — watchlist commands, mode usage
  - Memory row: `var(--purple)` — pattern summary, session index, behavior ledger, milestones/streaks
  - AI Stack row: `var(--green)` — Claude Sonnet all modes, Gemini 2.5 Flash web research, Yahoo Finance
- Got it dismiss button: 44px height, `var(--accent3)` background, `transition: background 0.2s ease` only
- Old generic AI icon empty state replaced entirely by onboarding modal

## Deviations from Plan

None — plan executed exactly as written. All 3 tasks committed separately with task-specific commit messages. The old empty state (generic glass card with AI icon) was removed as part of Task 3 since it served the same slot as the onboarding modal; this is aligned with the plan's intent.

## Known Stubs

None — all memory fields are live state from TradesContext, all dispatch calls are wired to real updaters.

## Threat Surface Scan

No new network endpoints introduced. No new trust boundaries. Memory update dispatch fields (`sessionIndexUpdate`, `behaviorLedgerUpdate`, etc.) are guarded by null checks before dispatch — T-06-12 mitigation in place. `showOnboarding` state contains only static documentation text — T-06-18 accepted.

## Self-Check: PASSED

- [x] `app/components/tabs/Coach.tsx` exists in worktree
- [x] Commit 5fa1f36 exists: `feat(06-04): extend sendMessage with memory dispatch and context fields`
- [x] Commit e353476 exists: `feat(06-04): add streak display to Coach memory section`
- [x] Commit 936c1d5 exists: `feat(06-04): add session-local onboarding modal to ChatView`
- [x] TypeScript compiles clean (`npx tsc --noEmit` exits 0)
- [x] All plan verification grep checks pass (updateSessionIndex/Behavior/Milestone/Streaks, streaks.currentWin/Loss/ruleAdherentDays, showOnboarding/setShowOnboarding)
- [x] No `transition: all` (0 occurrences)
- [x] All numeric streak values wrapped in `className="mono"`

---
*Phase: 06-ai-coach-enhancement-3-api-infrastructure-memory*
*Completed: 2026-05-06*
