---
phase: 02-supabase-persistence
plan: 03
subsystem: app/lib/TradesContext
tags: [supabase, persistence, optimistic, tradescontext, toast, midnight-market, strategyText]
dependency_graph:
  requires:
    - Plan 01 (Supabase tables: trades, coaching_entries with RLS)
    - Plan 02 (supabaseSerializers.ts, toast.ts, Toast.tsx)
  provides:
    - TradesContext with Supabase reads + optimistic writes (app/lib/TradesContext.tsx)
    - strategyText reactive state + updateStrategyText mutation
    - Toast write failure surfacing (rendered inside TradesProvider)
  affects:
    - Plan 04 (V5 migration can now call addTrade/addCoachingEntry which write to Supabase)
    - All tab components (additive context shape — no breaking change)
tech_stack:
  added: []
  patterns:
    - Hydrate-then-fetch warm cache (PERSIST-05): localStorage renders instantly, Supabase overwrites on mount
    - Optimistic update + toast/rollback on failure (D-01, D-02)
    - Stale-closure-safe snapshot capture via functional setter form (Pitfall 3)
    - useRef for stable Supabase client across renders
    - fire-and-forget void supabase.auth.updateUser for derived/user-metadata fields (D-04, D-12, D-13)
    - Fetch gate on hydrated && user prevents empty-array overwrite before auth resolves (Pitfall 2)
    - cancelled flag in async fetch effect for cleanup on unmount/logout
key_files:
  created: []
  modified:
    - app/lib/TradesContext.tsx
decisions:
  - useRef for Supabase client prevents createClient() from running on every render
  - Fetch effect gated on both hydrated AND user — prevents race where auth resolves after hydration sets false state
  - importData updated to use setStrategyText instead of direct localStorage write — resolves RESEARCH.md Open Question 1; localStorage write handled by persistence useEffect automatically
  - All four mutation async functions satisfy the () => void type in the interface — TS allows async () => Promise<void> to satisfy () => void; fire-and-forget is safe
  - Existing 30-entry localStorage coaching cap preserved verbatim — STABLE-02 (Phase 3) owns that bug fix
metrics:
  duration: 115s
  completed: 2026-05-06T06:44:38Z
  tasks_completed: 1
  tasks_total: 1
  files_created: 0
  files_modified: 1
---

# Phase 02 Plan 03: TradesContext Supabase Persistence Layer Summary

**One-liner:** TradesContext augmented with hydrate-then-fetch warm cache, optimistic Supabase writes with toast+rollback on failure, fire-and-forget user_metadata writes for pattern summary and strategy text, and reactive strategyText state.

## What Was Built

One file rewritten in-place: `app/lib/TradesContext.tsx`

### Hydrate-then-fetch (PERSIST-05)

On mount, localStorage data renders instantly (zero latency). A second `useEffect` gated on `hydrated && user` then fetches from `supabase.from("trades")` and `supabase.from("coaching_entries")`, overwriting state with Supabase truth. Pattern summary and strategy text are loaded from `user.user_metadata` (no extra DB call, already in the auth session). A `cancelled` flag prevents a stale in-flight fetch from overwriting fresher state after logout.

### Optimistic writes with toast + rollback (D-01, D-02)

All four trade/coaching mutations apply the React state change immediately (optimistic), then fire the Supabase write:

| Mutation | Supabase call | Toast on failure |
|----------|--------------|-----------------|
| `addTrade` | `supabase.from("trades").insert(tradeToRow(...))` | "Failed to save trade — please try again" |
| `deleteTrade` | `supabase.from("trades").delete().eq("id", id)` | "Failed to delete trade — please try again" |
| `addCoachingEntry` | `supabase.from("coaching_entries").insert(coachingEntryToRow(...))` | "Failed to save coaching entry — please try again" |
| `updateCoachingEntry` | `supabase.from("coaching_entries").update(rowUpdates)` | "Failed to update coaching entry — please try again" |

`deleteTrade` and `updateCoachingEntry` capture the pre-mutation snapshot via the functional setter form to avoid the stale-closure rollback bug (Pitfall 3).

### Fire-and-forget user_metadata writes (D-04, D-12, D-13)

`updatePatternSummary(s)` and `updateStrategyText(s)` both call `void supabase.auth.updateUser({ data: { ... } })` without awaiting or catching errors — these store derived/regenerable data in `user_metadata`. The synchronous-looking signature is preserved, so Coach.tsx call sites are unchanged.

### New strategyText state (RESEARCH.md Open Question 1)

`strategyText: string` and `updateStrategyText: (s: string) => void` added to the context value. Loaded from `readLSString(STRATEGY_KEY, "")` on mount, then overwritten from `user_metadata.strategy_text` when Supabase fetch runs. Persisted to `edge_v5_strategy_text` localStorage key via a dedicated `useEffect`. `importData` updated to call `setStrategyText` instead of writing localStorage directly — the persistence effect handles the localStorage write automatically.

### Toast rendered in-tree

`<Toast message={toast} />` rendered as a sibling of `{children}` inside `TradesContext.Provider`. This sits above all tabs (z-index 9999 in the Toast component) and is immune to per-tab rerenders.

### Unauthenticated behavior preserved (D-01)

All mutations short-circuit with `if (!user) return` before any Supabase call. Unauthenticated users get full localStorage-only behavior.

## Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1: TradesContext Supabase augmentation | d075617 | app/lib/TradesContext.tsx |

## Deviations from Plan

None — plan executed exactly as written.

The plan's automated verification grep used `supabase.from("coaching_entries")` as a single-line search string. In the actual file (as specified in the plan's code sample), `supabase` appears at the end of one line and `.from("coaching_entries")` starts the next — method chaining split across lines. The grep false-negative is a verification script limitation, not a content issue. All three `coaching_entries` references are present and correct.

## Known Stubs

None. All mutations are fully wired to Supabase. `strategyText` is loaded from both localStorage and user_metadata. No placeholder values or TODO markers.

## Threat Flags

No new security surface beyond what is documented in the plan's threat model (T-02-11 through T-02-16). All queries include `.eq("user_id", user.id)` for defense-in-depth (belt-and-braces over RLS). Strategy text and pattern summary are stored only in `user_metadata`, which is JWT-scoped to the authenticated user.

## Self-Check: PASSED

- `app/lib/TradesContext.tsx` modified — 195 insertions, 23 deletions
- Commit d075617 verified in git log
- `npx tsc --noEmit` exits 0
- All five import lines present (serializers, useToast, Toast, createClient, useAuthContext)
- `"trades"` table ref: 3 occurrences (select + insert + delete)
- `"coaching_entries"` table ref: 3 occurrences (select + insert + update)
- `supabase.auth.updateUser`: 2 occurrences (pattern_summary + strategy_text)
- `useCallback`: 8 occurrences (exceeds minimum of 7)
- 4 distinct toast messages present
- `hydrated && user` fetch gate present
- `if (!user) return` mutation gate present (4 occurrences)
- `<Toast message={toast} />` rendered inside provider JSX
- No file deletions in commit
