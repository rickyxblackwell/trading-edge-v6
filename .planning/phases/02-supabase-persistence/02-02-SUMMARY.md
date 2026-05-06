---
phase: 02-supabase-persistence
plan: 02
subsystem: lib/serializers, lib/toast, components/Toast
tags: [supabase, serialization, toast, ui, midnight-market, camelcase-snakecase]
dependency_graph:
  requires: []
  provides:
    - tradeToRow (app/lib/supabaseSerializers.ts)
    - rowToTrade (app/lib/supabaseSerializers.ts)
    - coachingEntryToRow (app/lib/supabaseSerializers.ts)
    - rowToCoachingEntry (app/lib/supabaseSerializers.ts)
    - useToast (app/lib/toast.ts)
    - Toast (app/components/Toast.tsx)
  affects:
    - Plan 03 (TradesContext augmentation) — imports all four serializer functions
    - Plan 04 (AuthProvider migration) — may import serializers for migration
tech_stack:
  added: []
  patterns:
    - Pure mapper functions with Record<string, unknown> input for DB row typing
    - useRef timer handle for successive-call-safe auto-dismiss in useToast
    - CSS custom properties exclusively — no hex literals in any new file
    - env(safe-area-inset-bottom) in fixed-position Toast for iPhone home indicator
key_files:
  created:
    - app/lib/supabaseSerializers.ts
    - app/lib/toast.ts
    - app/components/Toast.tsx
  modified: []
decisions:
  - Pure functions in supabaseSerializers.ts with no "use client" — safe in any context (client or server)
  - useRef for timer handle in useToast — prevents "old toast disappears mid-display of new toast" glitch
  - boxShadow set to "none" in Toast — depth conveyed by var(--red) border, avoids rgba literal (CLAUDE.md)
  - border uses var(--red) directly (not rgba tint as in PATTERNS.md) — cleaner, fully CSS-variable compliant
metrics:
  duration: 92s
  completed: 2026-05-06T06:33:02Z
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 0
---

# Phase 02 Plan 02: Serializers and Toast Infrastructure Summary

**One-liner:** Type-safe camelCase/snake_case mapper functions for Supabase Trade/CoachingEntry rows plus a stable useToast hook and Midnight Market glass Toast component.

## What Was Built

Three pure infrastructure files that Plans 03 and 04 both depend on:

1. **`app/lib/supabaseSerializers.ts`** — Four exported pure functions handling the camelCase ↔ snake_case impedance mismatch between TypeScript interfaces and Supabase DB columns. The critical mappings: `tradeCount ↔ trade_count`, `fullContent ↔ full_content`, `marketSnapshot ↔ market_snapshot`. All Trade fields map identically (no camelCase in Trade) — only `user_id` is added/stripped. No `"use client"` directive — safe in any context.

2. **`app/lib/toast.ts`** — `useToast()` hook returning `{ toast, showToast }`. The `showToast` function is wrapped in `useCallback` with empty deps (stable across re-renders), uses `useRef` for the timer handle so successive calls properly cancel the in-flight dismissal. Auto-dismisses after 4000ms per D-02.

3. **`app/components/Toast.tsx`** — Fixed-position glass error alert. Positioned at `calc(env(safe-area-inset-bottom, 0px) + 80px)` above the mobile bottom bar to avoid overlap with iPhone home indicator. All colors via CSS custom properties: `var(--bg3)` background, `var(--red)` border, `var(--text)` message. `role="alert"` + `aria-live="assertive"` for immediate screen reader announcement.

## Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1: supabaseSerializers.ts | d48a6c9 | app/lib/supabaseSerializers.ts |
| Task 2: toast.ts | 360f3fa | app/lib/toast.ts |
| Task 3: Toast.tsx | d44e20c | app/components/Toast.tsx |

## Deviations from Plan

None — plan executed exactly as written.

The PATTERNS.md draft for Toast.tsx used `rgba(248,113,113,0.3)` for the border (a hex-derived rgba literal). The plan's action section correctly superseded this with `var(--red)` — implemented as specified in the plan action, not the patterns draft.

## Known Stubs

None — all three files are complete implementations with no placeholder values.

## Threat Flags

No new security surface introduced. All three files are pure client-side utilities with no network endpoints, auth paths, or file access patterns.

## Self-Check: PASSED

- `app/lib/supabaseSerializers.ts` — exists, 4 export functions, all 6 field mappings verified
- `app/lib/toast.ts` — exists, `"use client"` on line 1, useCallback stable, 4000ms timer
- `app/components/Toast.tsx` — exists, `"use client"` on line 1, no hex literals, no `transition: all`, safe-area-inset-bottom, role=alert, aria-live=assertive
- `npx tsc --noEmit` — exits 0 after all three files created
- All three commits present: d48a6c9, 360f3fa, d44e20c

## Ready for Downstream Plans

Plan 03 and Plan 04 can now import:
```typescript
import { tradeToRow, rowToTrade, coachingEntryToRow, rowToCoachingEntry } from "@/app/lib/supabaseSerializers"
import { useToast } from "@/app/lib/toast"
import { Toast } from "@/app/components/Toast"
```
