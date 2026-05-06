# Phase 2: Supabase Persistence - Context

**Gathered:** 2026-05-05
**Status:** Ready for planning

<domain>
## Phase Boundary

All trade, coaching history, pattern summary, and strategy text data moves from localStorage to Supabase, scoped per authenticated user. localStorage drops to a fast-hydration read cache — the app renders existing data instantly before the Supabase fetch resolves, but Supabase is the authoritative source of truth. Existing V5 localStorage data is automatically migrated to Supabase on first authenticated login.

</domain>

<decisions>
## Implementation Decisions

### Write Strategy
- **D-01:** All trade and coaching mutations use **optimistic updates** — React state updates immediately, Supabase write happens in the background
- **D-02:** On Supabase write failure: show a toast error and **roll back** the local state change to keep UI in sync with DB
- **D-03:** **No offline write queue** — if Supabase is unreachable, the write fails and the toast + rollback flow handles it. Appropriate for a trading tool used during live market sessions (online by default)
- **D-04:** Pattern summary writes after each Analyze run are **fire-and-forget** — pattern memory is derived data that can be regenerated; silent failure is acceptable

### V5 Data Migration
- **D-05:** Migration runs **silently in the background** on first authenticated login — no blocking UI, no toast. Fast enough to be invisible for one user's dataset
- **D-06:** Migration is detected via a **`v5_migrated: true` flag in Supabase `user_metadata`** — checked on login; if absent, migration runs
- **D-07:** If migration fails mid-way (network drop etc.), the flag is NOT set — next login re-runs the full migration using **Supabase upsert** (insert-or-update by ID) to handle duplicates cleanly
- **D-08:** Migration scope includes: `edge_v5_trades`, `edge_v5_coaching_history`, `edge_v5_pattern_summary`, and `edge_v5_strategy_text`
- **D-09:** This is a **single-user migration** (developer's own V5 data only — V5 was never live for other users). Implementation does not need to handle large-scale or multi-user migration edge cases

### Real-time Sync
- **D-10:** **No Supabase Realtime subscriptions** in this phase — data loads once on mount via a single fetch. Changes made on another device appear after app refresh. Keeps the implementation simple with no subscription management or event deduplication

### Pattern Summary & Strategy Text Storage
- **D-11:** Rolling AI pattern summary (~500 chars) stored in **Supabase Auth `user_metadata`** as `{ pattern_summary: "..." }` — no extra table, loaded with the user session, fast
- **D-12:** Strategy text stored in Supabase as a **standalone "user strategy file"** — persisted and migrated from `edge_v5_strategy_text`. In Phase 2, treat it as a simple persisted text field
- **D-13:** Pattern summary writes use `supabase.auth.updateUser({ data: { pattern_summary } })` — same API call pattern as Gemini key updates from Phase 1

### Claude's Discretion
- Supabase table schema (column types, nullable fields, indexes) — use sensible defaults for the `trades` and `coaching_entries` tables
- Row Level Security (RLS) policy — standard `auth.uid() = user_id` check on all user-scoped tables
- localStorage sync-back behavior on successful Supabase write — researcher/planner decides whether to update localStorage after confirming DB write, or keep the existing write-through pattern
- Toast UI implementation — reuse or introduce a simple toast pattern consistent with the existing Midnight Market design system

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — project goals, constraints, key decisions (localStorage keys, design rules)
- `.planning/REQUIREMENTS.md` — PERSIST-01 through PERSIST-05 with full traceability
- `.planning/ROADMAP.md` — Phase 2 success criteria (the four "must be TRUE" statements)

### Phase 1 Artifacts (integration baseline)
- `.planning/phases/01-auth-and-security/01-CONTEXT.md` — Phase 1 decisions; auth patterns, Supabase client setup, user_metadata usage for gemini_api_key
- `.planning/phases/01-auth-and-security/01-SPEC.md` — Locked Phase 1 requirements; defines what auth infrastructure is available in Phase 2

### Existing Code — Integration Points
- `app/lib/TradesContext.tsx` — current state manager; all mutations and localStorage sync patterns to be extended with Supabase writes
- `app/lib/types.ts` — `Trade`, `CoachingEntry`, `ExportPackage` interfaces; DB schema should match these shapes exactly
- `lib/supabase/client.ts` — browser Supabase client factory (from Phase 1)
- `lib/supabase/server.ts` — server Supabase client factory (from Phase 1)
- `app/components/AuthProvider.tsx` — `useAuthContext()` hook; exposes `user` for scoping DB queries
- `app/layout.tsx` — root layout; `TradesProvider` wraps here; Phase 2 may need auth-aware initialization

### Codebase Maps
- `.planning/codebase/ARCHITECTURE.md` — data flow, Trade and Coach lifecycles, TradesContext write-through pattern
- `.planning/codebase/INTEGRATIONS.md` — localStorage keys, all data shapes, hydration pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/lib/TradesContext.tsx` — all state + mutation callbacks already defined; Phase 2 augments each callback with a parallel Supabase write without changing the interface consumed by tabs
- `readLS<T>()` helper in TradesContext — continues to serve as the fast-hydration read; stays unchanged
- `lib/supabase/client.ts` `createClient()` — already available for browser-side DB queries in TradesContext
- `ExportPackage` interface — can double as the migration payload shape for V5 import

### Established Patterns
- **Hydration flag pattern** (`hydrated` state, `useEffect` gated on it) — the "render from cache first, then fetch" flow for Phase 2 follows the same pattern: hydrate from localStorage on mount, then fetch from Supabase and overwrite
- **`useCallback` on all mutations** — all Supabase write wrappers should follow the same `useCallback` pattern
- **`"use client"` everywhere** — TradesContext and all tab components are client components; Supabase browser client is appropriate here
- **`edge_v5_*` localStorage key prefix** — keep writing these keys after Supabase sync (cache stays warm)

### Integration Points
- `addTrade` / `deleteTrade` in TradesContext → add parallel Supabase `INSERT`/`DELETE` on `trades` table
- `addCoachingEntry` / `updateCoachingEntry` → add parallel Supabase `INSERT`/`UPDATE` on `coaching_entries` table
- `updatePatternSummary` → add fire-and-forget `supabase.auth.updateUser({ data: { pattern_summary } })`
- TradesContext `useEffect` mount block → after localStorage hydration, fetch from Supabase and merge/overwrite
- `AuthProvider` user → pass `user.id` into TradesContext (or access via `createClient().auth.getUser()`) to scope all queries

</code_context>

<specifics>
## Specific Ideas

- **User strategy file:** The strategy text in Phase 2 is persisted as a simple text field. Future phases should evolve it into a living "user strategy file" that the AI coach periodically updates based on coaching sessions — making each coach session tailored to the individual trader's recorded approach. If the strategy file diverges too far from the core Strategy tab teachings, a customization/alignment feature may be needed.
- **Coach context inputs (future):** The AI coach should eventually consider: previous journal analyses, online market research (already enabled via Google Search grounding), trade journal entries, and the user strategy file — all four sources together. This is the long-term vision for the coaching intelligence layer.

</specifics>

<deferred>
## Deferred Ideas

- **Export + Import JSON in account page** — user wants both a JSON export button and a JSON import button in the Account/Settings tab, enabling data transfer between accounts (e.g. moving all trades and coaching history to a new account). Deferred to Phase 3 (Stability & PWA) when the settings page gets expanded. The `ExportPackage` interface in TradesContext already defines the export shape; import already exists as `importData()` in TradesContext — Phase 3 needs to wire both into Supabase writes, not just localStorage.
- **Living "strategy file" with AI updates** — coach periodically updates the user strategy file based on coaching session output. Significant new capability; belongs in a dedicated phase after Phase 2 ships.
- **Coach customization / alignment feature** — if user strategy file diverges too far from core Strategy tab, surface alignment guidance. Deferred; depends on living strategy file capability above.
- **Supabase Realtime cross-device sync** — live trade updates across devices/tabs. Deferred; fetch-on-mount is sufficient for Phase 2.
- **Offline write queue** — queue writes locally when offline, sync on reconnection. Deferred to v2 backlog (already noted in REQUIREMENTS.md).
- **Pull-to-refresh / manual sync button** — user-initiated data refresh. Deferred; out of Phase 2 scope.

</deferred>

---

*Phase: 2 — Supabase Persistence*
*Context gathered: 2026-05-05*
