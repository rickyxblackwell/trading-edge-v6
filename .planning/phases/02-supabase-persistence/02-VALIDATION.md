---
phase: 2
slug: supabase-persistence
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-05
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler (npx tsc --noEmit) — no jest/vitest yet (Phase 4 adds tests) |
| **Config file** | tsconfig.json |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit` + manual Supabase dashboard check
- **Before `/gsd-verify-work`:** Full TypeScript pass must be green + all manual verifications complete
- **Max feedback latency:** ~5 seconds (TypeScript) + ~2 minutes (manual Supabase checks)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | PERSIST-01 | — | user_id column enforced by RLS | manual + auto | `npx tsc --noEmit` | ✅ (tsconfig.json) | ⬜ pending |
| 02-01-02 | 01 | 1 | PERSIST-02 | — | user_id column enforced by RLS | manual + auto | `npx tsc --noEmit` | ✅ (tsconfig.json) | ⬜ pending |
| 02-02-01 | 03 | 2 | PERSIST-05 | — | Supabase fetch overwrites localStorage on mount | manual + auto | `npx tsc --noEmit` | ✅ (tsconfig.json) | ⬜ pending |
| 02-02-02 | 03 | 2 | PERSIST-01 | D-01/D-02 | addTrade optimistic + rollback on failure | manual + auto | `npx tsc --noEmit` | ✅ (tsconfig.json) | ⬜ pending |
| 02-02-03 | 03 | 2 | PERSIST-02 | D-01/D-02 | addCoachingEntry optimistic + rollback on failure | manual + auto | `npx tsc --noEmit` | ✅ (tsconfig.json) | ⬜ pending |
| 02-02-04 | 03 | 2 | PERSIST-03 | D-04 | updatePatternSummary fire-and-forget to user_metadata | manual + auto | `npx tsc --noEmit` | ✅ (tsconfig.json) | ⬜ pending |
| 02-03-01 | 04 | 2 | PERSIST-04 | D-06/D-07 | v5_migrated flag set only after all data confirmed written | manual + auto | `npx tsc --noEmit` | ✅ (tsconfig.json) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers TypeScript validation. No new test framework installation required for Phase 2.

*Note: Phase 4 (Stats Refactor & Tests) will install and configure the test suite.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Trade appears in Supabase `trades` table after add | PERSIST-01 | DB verification requires Supabase dashboard | Log a trade → open Supabase dashboard → Table Editor → trades → verify row exists with correct user_id |
| Coaching entry appears in `coaching_entries` table | PERSIST-02 | DB verification requires Supabase dashboard | Run Analyze → open Supabase dashboard → coaching_entries → verify row exists |
| Data survives localStorage clear | PERSIST-01, PERSIST-02 | Requires browser devtools | Open DevTools → Application → Storage → Clear Site Data → refresh → verify trades/coaching still load |
| Pattern summary in user_metadata after Analyze | PERSIST-03 | user_metadata check requires Supabase Auth dashboard | Run Analyze → Supabase Auth → Users → click user → verify user_metadata.pattern_summary is populated |
| V5 migration runs on first login | PERSIST-04 | Requires localStorage with V5 data + fresh login | Ensure edge_v5_trades has test data → log in (clear session first) → verify trades appear in Supabase dashboard |
| v5_migrated flag prevents re-migration | PERSIST-04 | Requires session restart | Log in twice → verify migration code doesn't fire second time (check Supabase trades row count stays the same) |
| Toast appears on simulated write failure | D-01/D-02 | Requires network tab to block requests | DevTools → Network → block supabase.co → add trade → verify toast appears + trade disappears (rollback) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (TypeScript compiler — already installed, no setup needed)
- [x] No watch-mode flags
- [x] Feedback latency < 120s (~5s for `npx tsc --noEmit`)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
