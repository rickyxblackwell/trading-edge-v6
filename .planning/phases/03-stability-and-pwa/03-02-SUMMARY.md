---
plan: "03-02"
phase: "03-stability-and-pwa"
status: complete
requirements_addressed:
  - STABLE-02
  - STABLE-03
  - STABLE-04
key-files:
  created: []
  modified:
    - app/lib/TradesContext.tsx
    - app/components/TradeForm.tsx
    - app/components/tabs/Coach.tsx
    - app/components/tabs/Stats.tsx
---

## Summary

Three bugs fixed across four files: localStorage coaching history cap raised from 30 to 60 entries (STABLE-02); all `Math.random()` ID generation replaced with `crypto.randomUUID()` across TradesContext, TradeForm, Coach, and Stats (STABLE-03); NaN guard added to trade form submit with inline error messages under P&L and R-mult fields (STABLE-04).

## What Was Built

**Task 1: History cap + UUID migration (TradesContext, Coach, Stats)**
- `app/lib/TradesContext.tsx` — `coachingHistory.slice(-30)` → `coachingHistory.slice(-60)` in localStorage persist effect; stale comment removed
- `app/components/tabs/Coach.tsx` — `genId()` and `genSessionId()` both use `crypto.randomUUID()`
- `app/components/tabs/Stats.tsx` — fallback ID at equity curve normalization uses `crypto.randomUUID()`

**Task 2: TradeForm UUID + NaN guard**
- `app/components/TradeForm.tsx` — `genId()` uses `crypto.randomUUID()`; submit handler validates `pnlNum` and `rmultNum` with `isNaN()` before calling `onSubmit`; `pnlError` and `rmultError` state drive inline error paragraphs styled with `var(--red)`

## Deviations

None.

## Self-Check: PASSED

- `Math.random` count across all 4 files: 0
- `slice(-60)` count in TradesContext.tsx: 2
- `crypto.randomUUID()` in TradeForm: 1, Coach: 2, Stats: 1
- `isNaN` guards in TradeForm: 2
- `npx tsc --noEmit`: exit 0
