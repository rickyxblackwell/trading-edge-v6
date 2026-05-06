---
phase: 02-supabase-persistence
plan: 01
subsystem: database
tags: [supabase, sql, rls, ddl, postgres, persistence, migration]

# Dependency graph
requires:
  - phase: 01-auth-and-security
    provides: "auth.users table and Supabase Auth setup that trades/coaching_entries FK reference"
provides:
  - "supabase/migrations/20260505000000_phase2_persistence.sql — versioned DDL + RLS for trades and coaching_entries"
  - "public.trades table schema matching Trade TypeScript interface"
  - "public.coaching_entries table schema matching CoachingEntry TypeScript interface"
  - "RLS policies users_own_trades and users_own_coaching with USING + WITH CHECK"
  - "btree indexes on user_id for both tables"
affects: [02-02, 02-03, 02-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SQL migration files under supabase/migrations/ with timestamp prefix for versioned replay"
    - "(SELECT auth.uid()) subquery form for RLS policies — evaluates once per query, not per row"
    - "USING + WITH CHECK both required on RLS policies covering ALL operations (Pitfall 6 guard)"
    - "ON DELETE CASCADE on user_id FKs — auth.users deletion cascades to all user data"
    - "IF NOT EXISTS on CREATE TABLE and CREATE INDEX — idempotent migrations safe to re-run"

key-files:
  created:
    - "supabase/migrations/20260505000000_phase2_persistence.sql"
  modified: []

key-decisions:
  - "Used (SELECT auth.uid()) subquery form rather than auth.uid() directly — per Supabase current recommendation for single evaluation per query"
  - "Both USING and WITH CHECK on every policy — USING covers SELECT/UPDATE/DELETE, WITH CHECK covers INSERT (guards against forgetting CHECK on inserts)"
  - "TEXT[] for confluences column — maps directly to string[] in TypeScript without serialization"
  - "TEXT for id columns — matches the string UUIDs used by the app (crypto.randomUUID())"

patterns-established:
  - "SQL migration naming: YYYYMMDDHHMMSS_description.sql under supabase/migrations/"
  - "RLS pattern: ENABLE ROW LEVEL SECURITY + policy FOR ALL TO authenticated USING + WITH CHECK"

requirements-completed: [PERSIST-01, PERSIST-02]

# Metrics
duration: 1min
completed: 2026-05-06
---

# Phase 2 Plan 01: Supabase Schema Migration Summary

**Versioned SQL migration creating public.trades and public.coaching_entries tables with RLS user-scoping policies, btree indexes, and ON DELETE CASCADE FK to auth.users**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-05-06T06:31:12Z
- **Completed:** 2026-05-06T06:32:09Z
- **Tasks:** 1 of 2 automated (Task 2 is a checkpoint:human-action gate)
- **Files modified:** 1

## Accomplishments

- Created `supabase/migrations/20260505000000_phase2_persistence.sql` with full DDL for both tables
- Defined 14-column `trades` table matching Trade TypeScript interface exactly (snake_case mapping)
- Defined 15-column `coaching_entries` table matching CoachingEntry TypeScript interface exactly
- RLS enabled on both tables with USING + WITH CHECK policies scoped to `authenticated` role
- CHECK constraints on `direction` (long/short) and `outcome` (win/loss/breakeven) for enum integrity
- btree indexes on `user_id` for efficient per-user queries

## Task Commits

1. **Task 1: Create Phase 2 SQL migration file** - `21617a5` (feat)

## Files Created/Modified

- `supabase/migrations/20260505000000_phase2_persistence.sql` - DDL + RLS for trades and coaching_entries tables

## Decisions Made

- Used `(SELECT auth.uid())` subquery form (not bare `auth.uid()`) — Supabase current recommendation; evaluates once per query rather than per row
- Both `USING` AND `WITH CHECK` on both policies — required to guard INSERT operations (USING alone is insufficient; RESEARCH.md Pitfall 6)
- `TEXT[]` type for `confluences` column — direct mapping to `string[]` TypeScript type without serialization overhead
- `TEXT` for `id` primary keys — app uses `crypto.randomUUID()` which produces string UUIDs

## Deviations from Plan

None — plan executed exactly as written. SQL content matches the plan specification verbatim.

Note on WITH CHECK grep count: The plan's acceptance criterion `grep -c "WITH CHECK" returns 2` technically returns 3 because the comment header line `-- RLS: enabled with users_own_* policies (USING + WITH CHECK)` also matches. The two actual SQL `WITH CHECK` clauses are present as required — this is a false positive in the count test, not a content error. The file content is correct.

## Issues Encountered

None.

## User Setup Required

**Task 2 is a checkpoint:human-action gate.** The SQL migration file must be executed against the live Supabase project before Plans 02/03/04 can proceed.

Steps to complete:
1. Open https://supabase.com/dashboard
2. Select the project linked to `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`
3. Navigate to: SQL Editor → "New query"
4. Copy the full contents of `supabase/migrations/20260505000000_phase2_persistence.sql`
5. Paste into the SQL editor and click "Run" (Cmd/Ctrl+Enter)
6. Expected result: "Success. No rows returned" — no errors
7. Verify in Database → Tables: both `trades` and `coaching_entries` exist
8. Verify RLS is enabled on both tables
9. Run verification queries:
   ```sql
   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('trades', 'coaching_entries');
   ```
   Expected: 2 rows, both `rowsecurity = true`
   ```sql
   SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('trades', 'coaching_entries');
   ```
   Expected: 2 rows — `users_own_trades` and `users_own_coaching`, both `cmd = 'ALL'`
10. Signal "schema-pushed" to continue to Plans 02/03/04

## Next Phase Readiness

- `supabase/migrations/20260505000000_phase2_persistence.sql` committed and ready to execute
- **BLOCKED:** Plans 02-02, 02-03, 02-04 require the live Supabase tables — cannot proceed until human runs the SQL in the dashboard (Task 2 gate)
- Once schema is pushed and "schema-pushed" signal given, all downstream plans can execute

## Threat Model Coverage

All STRIDE mitigations from the plan's threat model are implemented in the migration:

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-02-01 | RLS USING clause + TO authenticated on trades | Implemented |
| T-02-02 | RLS WITH CHECK clause on trades | Implemented |
| T-02-03 | RLS USING clause + TO authenticated on coaching_entries | Implemented |
| T-02-04 | RLS WITH CHECK clause on coaching_entries | Implemented |
| T-02-05 | ON DELETE CASCADE on both user_id FKs | Implemented |
| T-02-06 | CHECK constraints on direction and outcome | Implemented |
| T-02-07 | btree indexes on user_id (accepted DoS risk for single-user app) | Indexes added |

---
*Phase: 02-supabase-persistence*
*Completed: 2026-05-06*
