# Phase 2: Supabase Persistence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-05
**Phase:** 2-supabase-persistence
**Areas discussed:** Write strategy, V5 migration UX, Real-time sync, Pattern summary storage

---

## Write Strategy

### Q1: How should trade mutations reach Supabase?

| Option | Description | Selected |
|--------|-------------|----------|
| Optimistic | Update local React state immediately; Supabase write in background | ✓ |
| Await Supabase | Wait for DB write before updating UI | |
| Fire-and-forget | Background write with no error handling | |

**User's choice:** Optimistic
**Notes:** Fast UX is the priority; rollback handles failures.

### Q2: What happens if a Supabase write fails after optimistic update?

| Option | Description | Selected |
|--------|-------------|----------|
| Toast error + rollback | Show error, reverse local state | ✓ |
| Toast error only | Show error, leave UI as-is | |
| Silent retry | Retry 2-3 times quietly, then error | |

**User's choice:** Toast error + rollback

### Q3: Should the app support offline writes?

| Option | Description | Selected |
|--------|-------------|----------|
| No offline writes | Failed writes surface via toast + rollback | ✓ |
| Queue offline writes | Store locally, sync on reconnect | |

**User's choice:** No offline writes
**Notes:** Trading journal used during live sessions; being online is assumed.

---

## V5 Migration UX

### Q1: What does the user see during first-login V5 data migration?

| Option | Description | Selected |
|--------|-------------|----------|
| Silent | Background import, no UI feedback | ✓ |
| Toast notification | Brief "Importing your trading history..." toast | |
| Full-screen loader | Blocking loading screen until migration completes | |

**User's choice:** Silent

### Q2: How is a "not yet migrated" user detected?

| Option | Description | Selected |
|--------|-------------|----------|
| Flag in user_metadata | Set { v5_migrated: true } after success; check on login | ✓ |
| Check empty tables | If trades table empty but localStorage has data, migrate | |

**User's choice:** Flag in user_metadata

### Q3: What happens if migration fails partway through?

| Option | Description | Selected |
|--------|-------------|----------|
| Retry from scratch | Don't set flag until all data confirmed; upsert handles dupes | ✓ |
| Partial migration is fine | Set flag after any data written | |

**User's choice:** Retry from scratch
**Notes:** User clarified V5 migration is a one-user operation (developer's own data; V5 was never publicly live). Implementation does not need production-scale robustness — keep it simple.

---

## Real-time Sync

### Q1: Should data sync live across devices/tabs via Supabase Realtime?

| Option | Description | Selected |
|--------|-------------|----------|
| Fetch on mount only | Single fetch on app open; no live subscriptions | ✓ |
| Supabase Realtime subscriptions | Live cross-device sync via INSERT/UPDATE/DELETE events | |

**User's choice:** Fetch on mount only
**Notes:** User moved directly to next area — no further questions needed.

---

## Pattern Summary Storage

### Q1: Where should the rolling AI pattern summary live in Supabase?

| Option | Description | Selected |
|--------|-------------|----------|
| user_metadata | Store in Auth user_metadata; no extra table | ✓ |
| Separate preferences table | Dedicated table with pattern_summary column | |

**User's choice:** user_metadata

### Q2: How should pattern summary be written after an Analyze run?

| Option | Description | Selected |
|--------|-------------|----------|
| Fire-and-forget | Background write, no error handling | ✓ |
| Await + toast on failure | Wait for write, warn on failure | |

**User's choice:** Fire-and-forget
**Notes:** Pattern summary is derived data — regenerable by re-running Analyze. Silent failure acceptable.

### Q3: Should V5 strategy text be migrated and persisted?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — migrate and persist | Store in Supabase, migrate from edge_v5_strategy_text | ✓ |
| No — keep in localStorage | Leave as localStorage-only | |

**User's choice:** Yes — with an important expansion of vision
**Notes (verbatim):** "Strategy text should be derived from the strategy page as a standalone 'user strategy file' and periodically updated via the coach feature. That way each coach is tailored to each trader. If the user strategy file is too dissimilar to the teachings on the main strategy page, we might need to add a customization feature. Otherwise, the coach should consider and accurately log the following things according to the mode it's in and the responses it gives: previous journal analyses, online market research, Trade journal entries and your user strategy file."

*Immediate scope (Phase 2):* Persist strategy text as a simple text field in Supabase. Migrate from localStorage. No AI-update behavior yet.
*Deferred:* Living strategy file with coach-driven updates, alignment/customization feature, and unified four-source coach context.

---

## Claude's Discretion

- Supabase table schema (column types, nullable fields, indexes) — use sensible defaults
- RLS policies — standard `auth.uid() = user_id` guard on all user-scoped tables
- Toast UI implementation — consistent with Midnight Market design system
- localStorage sync-back behavior after successful Supabase write

## Deferred Ideas

- Export + Import JSON in account page — both directions, for cross-account data transfer. Phase 3 (Settings expansion). `ExportPackage` interface already defines the shape; `importData()` already exists in TradesContext.
- Living "user strategy file" with AI coach periodic updates — dedicated future phase
- Coach customization / alignment feature when strategy file diverges from core teachings
- Supabase Realtime cross-device sync — deferred
- Offline write queue — v2 backlog
- Pull-to-refresh / manual sync button — out of Phase 2 scope
