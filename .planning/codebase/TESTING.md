---
title: TESTING.md
focus: quality
generated: 2026-05-05
---

# Testing

## Current State

**Zero tests exist in this codebase.** No test files, no test framework installed, no test scripts in `package.json`.

TypeScript compilation (`npx tsc --noEmit`) serves as the only automated correctness check.

## Test Gaps by Priority

### Critical (blocking for Supabase/auth work)

- `TradesContext` — localStorage read/write, hydration guard, cap behavior (coaching history 30 vs 60)
- `/api/coach` route — rate limiting logic, Gemini response parsing (TITLE extraction, PATTERN SUMMARY UPDATE extraction), mode branching, error handling

### High

- Trade schema validation — `addTrade` accepts NaN pnl/rmult today, would corrupt Stats calculations
- Stats calculations — KPI math (win rate, avg R, profit factor, etc.) with known trade fixtures
- Coach response parsing — regex for TITLE and PATTERN SUMMARY UPDATE with edge cases (missing markers, malformed responses)

### Medium

- Tab switching behavior — Coach chat state is unmounted on tab change (known data loss)
- Export/import round-trip (`ExportPackage` format)

## Recommended Setup

When tests are added (`/gsd-add-tests`), recommend:
- **Vitest** — matches Next.js ecosystem, fast, compatible with React Testing Library
- **@testing-library/react** — component behavior tests
- **msw** — mock `/api/coach` POST in component tests without hitting Gemini

## TypeScript as a Proxy

`npx tsc --noEmit` is the current quality gate. Must pass before any phase is marked complete per CLAUDE.md.
