# Phase 2: Supabase Persistence — Research

**Researched:** 2026-05-05
**Domain:** Supabase database persistence, Row Level Security, optimistic UI, V5 localStorage migration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Write Strategy**
- D-01: All trade and coaching mutations use optimistic updates — React state updates immediately, Supabase write happens in the background
- D-02: On Supabase write failure: show a toast error and roll back the local state change to keep UI in sync with DB
- D-03: No offline write queue — if Supabase is unreachable, the write fails and the toast + rollback flow handles it
- D-04: Pattern summary writes after each Analyze run are fire-and-forget — silent failure acceptable

**V5 Data Migration**
- D-05: Migration runs silently in the background on first authenticated login — no blocking UI, no toast
- D-06: Migration is detected via a `v5_migrated: true` flag in Supabase `user_metadata` — checked on login; if absent, migration runs
- D-07: If migration fails mid-way, the flag is NOT set — next login re-runs the full migration using Supabase upsert (insert-or-update by ID) to handle duplicates cleanly
- D-08: Migration scope includes: `edge_v5_trades`, `edge_v5_coaching_history`, `edge_v5_pattern_summary`, and `edge_v5_strategy_text`
- D-09: Single-user migration only — no large-scale or multi-user edge cases needed

**Real-time Sync**
- D-10: No Supabase Realtime subscriptions — data loads once on mount via a single fetch

**Pattern Summary & Strategy Text Storage**
- D-11: Rolling AI pattern summary stored in Supabase Auth `user_metadata` as `{ pattern_summary: "..." }` — no extra table
- D-12: Strategy text stored in Supabase as a standalone persisted text field
- D-13: Pattern summary writes use `supabase.auth.updateUser({ data: { pattern_summary } })`

### Claude's Discretion
- Supabase table schema (column types, nullable fields, indexes) — use sensible defaults
- Row Level Security (RLS) policy — standard `auth.uid() = user_id` check
- localStorage sync-back behavior on successful Supabase write
- Toast UI implementation — consistent with Midnight Market design system

### Deferred Ideas (OUT OF SCOPE)
- Export + Import JSON in account page — Phase 3
- Living "strategy file" with AI updates — future dedicated phase
- Coach customization / alignment feature — depends on living strategy file
- Supabase Realtime cross-device sync — Phase 2+ backlog
- Offline write queue — v2 backlog
- Pull-to-refresh / manual sync button — out of Phase 2 scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERSIST-01 | Trades stored in Supabase `trades` table, scoped to authenticated user | SQL schema, RLS policy, `supabase.from("trades").insert()` pattern |
| PERSIST-02 | Coaching history stored in Supabase `coaching_entries` table, scoped to authenticated user | SQL schema, RLS policy, `supabase.from("coaching_entries").insert()/.update()` pattern |
| PERSIST-03 | Pattern summary stored in Supabase user profile or preferences — resolved to `user_metadata` per D-11 | `supabase.auth.updateUser({ data: { pattern_summary } })` — same API as Gemini key |
| PERSIST-04 | V5 localStorage data migrated to Supabase on first authenticated login | `v5_migrated` user_metadata flag + upsert-based idempotent migration |
| PERSIST-05 | localStorage used as offline read cache only — Supabase is source of truth | Hydrate from LS on mount, then fetch from Supabase and overwrite; continue writing LS after DB write |
</phase_requirements>

---

## Summary

Phase 2 extends TradesContext with a Supabase persistence layer, keeping localStorage as a fast read-cache while making Supabase the authoritative source. All mutations become optimistic: React state updates immediately, a background Supabase write fires in parallel, and any failure triggers a toast + rollback. Two Supabase tables are needed (`trades` and `coaching_entries`), both user-scoped via a standard `auth.uid() = user_id` RLS policy. Pattern summary and strategy text bypass tables entirely — they live in `user_metadata` on the Supabase auth user object.

The V5 data migration is a one-shot background job: on first authenticated login, the app reads all five `edge_v5_*` localStorage keys and upserts them into Supabase, then sets `v5_migrated: true` in `user_metadata`. Upsert-by-ID semantics make the migration idempotent — a mid-flight failure simply means the next login re-runs it cleanly with no duplicates.

The codebase is Phase 1-complete: `lib/supabase/client.ts` (browser client) and `lib/supabase/server.ts` (server client) are already in place, `AuthProvider` exposes `user` via `useAuthContext()`, and `TradesContext` already has the `hydrated` flag pattern that drives the new "render from cache, then fetch" flow. No new dependencies are required — `@supabase/supabase-js` (2.105.3 on npm, 2.49.4 installed) and `@supabase/ssr` (0.10.2 installed) are already installed.

**Primary recommendation:** Augment each `TradesContext` mutation with a parallel Supabase write (optimistic pattern), add a Supabase fetch after the localStorage hydration `useEffect`, and wire the V5 migration into the `onAuthStateChange` SIGNED_IN event handler in `AuthProvider` or a new `useEffect` in `TradesContext` that watches `user`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Trade persistence (write) | Browser / Client | — | TradesContext is `"use client"` — browser Supabase client writes directly with RLS enforcing user scoping |
| Coaching history persistence (write) | Browser / Client | — | Same as trades — all mutations live in TradesContext which is a client component |
| Data load on mount | Browser / Client | — | Fetch fires inside TradesContext `useEffect` after LS hydration; no SSR involvement |
| Pattern summary persistence | Browser / Client | — | `supabase.auth.updateUser()` call from TradesContext; fire-and-forget |
| Strategy text persistence | Browser / Client | — | Simple text field update via `supabase.from("user_strategy")` or user_metadata |
| V5 migration | Browser / Client | — | Reads localStorage (browser-only), writes to Supabase; must run client-side after auth confirms |
| RLS enforcement | Database | — | `auth.uid() = user_id` policies enforced at the Postgres level — no server middleware needed |
| Table schema / migrations | Database | — | SQL migration run once against the Supabase project; no runtime Next.js code |

---

## Standard Stack

### Core

| Library | Version (installed) | Version (registry) | Purpose | Why Standard |
|---------|--------------------|--------------------|---------|--------------|
| `@supabase/supabase-js` | 2.49.4 | 2.105.3 | Supabase JS client — DB queries, auth.updateUser | Official Supabase client, already installed |
| `@supabase/ssr` | 0.10.2 | 0.10.2 | SSR-compatible client factory (createBrowserClient) | Already installed, used by lib/supabase/client.ts |

[VERIFIED: npm registry — `npm view @supabase/supabase-js version` and `npm view @supabase/ssr version`]

**Note:** `@supabase/supabase-js` 2.49.4 is installed but 2.105.3 is available. The installed version fully supports all required patterns (insert, upsert, delete, select, auth.updateUser). An upgrade is safe but not required for Phase 2.

### Supporting

No new libraries required. Toast notification is already in the CLAUDE.md discretion area — the design system has no existing toast component so one must be built as a minimal custom component. See Toast section under Architecture Patterns below.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `user_metadata` for pattern_summary | Dedicated `user_preferences` table | Extra table + fetch vs. zero infrastructure — D-11 locks `user_metadata` |
| Manual `INSERT` + `UPDATE` for migration | `UPSERT` with `onConflict: 'id'` | Upsert is idempotent — handles partial migration retries without duplicates — D-07 locks upsert |
| Global optimistic lock / version field | None | App is single-user with no cross-device concurrent writes in Phase 2 — not needed |

**Installation:** No new packages needed.

---

## Architecture Patterns

### System Architecture Diagram

```
Browser Mount
  └── TradesContext useEffect #1
        └── readLS() → hydrate trades, coaching, patternSummary into React state (instant)
        └── setHydrated(true)

  └── TradesContext useEffect #2 (runs after hydrated, watches user)
        └── if user → supabase.from("trades").select("*").eq("user_id", user.id)
        └── setTrades(data)  ← overwrites localStorage data with Supabase truth
        └── if user → supabase.from("coaching_entries").select("*").eq("user_id", user.id)
        └── setCoachingHistory(data)
        └── read patternSummary from user.user_metadata → setPatternSummary(value)

AuthProvider onAuthStateChange (SIGNED_IN)
  └── runV5Migration(user)  ← only if user_metadata.v5_migrated !== true
        └── read edge_v5_trades, edge_v5_coaching_history, edge_v5_pattern_summary, edge_v5_strategy_text
        └── supabase.from("trades").upsert(trades, { onConflict: "id" })
        └── supabase.from("coaching_entries").upsert(entries, { onConflict: "id" })
        └── supabase.auth.updateUser({ data: { pattern_summary, strategy_text, v5_migrated: true } })
        └── on success: flag set → migration won't re-run
        └── on failure: flag NOT set → idempotent retry on next login

Mutation: addTrade(trade)
  ├── setTrades(optimistic) ← immediate React state update
  ├── localStorage.setItem(TRADES_KEY, ...)  ← cache stays warm
  └── supabase.from("trades").insert({ ...trade, user_id: user.id })
        └── on error → setTrades(rollback) + showToast("error")

Mutation: deleteTrade(id)
  ├── setTrades(optimistic)
  ├── localStorage.setItem(TRADES_KEY, ...)
  └── supabase.from("trades").delete().eq("id", id).eq("user_id", user.id)
        └── on error → setTrades(rollback) + showToast("error")

Mutation: addCoachingEntry(entry)
  ├── setCoachingHistory(optimistic)
  └── supabase.from("coaching_entries").insert({ ...entry, user_id: user.id })
        └── on error → setCoachingHistory(rollback) + showToast("error")

Mutation: updateCoachingEntry(id, updates)
  ├── setCoachingHistory(optimistic)
  └── supabase.from("coaching_entries").update(updates).eq("id", id).eq("user_id", user.id)
        └── on error → setCoachingHistory(rollback) + showToast("error")

Mutation: updatePatternSummary(s)
  ├── setPatternSummary(optimistic)
  └── supabase.auth.updateUser({ data: { pattern_summary: s } })
        └── fire-and-forget — no error handler (D-04)
```

### Recommended Project Structure

No new top-level directories needed. Changes are concentrated in:

```
app/lib/
├── TradesContext.tsx     # augment with Supabase writes + Supabase fetch on mount
├── types.ts              # unchanged
└── toast.ts              # NEW: minimal toast state hook (or inline in TradesContext)

app/components/
└── Toast.tsx             # NEW: toast UI component (Midnight Market design)

supabase/
└── migrations/
    └── 20260505000000_phase2_persistence.sql   # NEW: trades + coaching_entries tables
```

### Pattern 1: Supabase Table INSERT (Optimistic)

```typescript
// Source: https://context7.com/supabase/supabase-js/llms.txt
const addTrade = useCallback(async (t: Trade) => {
  if (!user) {
    // Unauthenticated — localStorage only (app is publicly accessible per Phase 1 D-01)
    setTrades((prev) => [t, ...prev])
    return
  }
  // Optimistic update
  setTrades((prev) => [t, ...prev])
  // Background write
  const { error } = await supabase
    .from("trades")
    .insert({ ...t, user_id: user.id })
  if (error) {
    // Rollback
    setTrades((prev) => prev.filter((trade) => trade.id !== t.id))
    showToast("Failed to save trade — please try again")
  }
}, [user, supabase, showToast])
```

[VERIFIED: Context7 /supabase/supabase-js — insert pattern]

### Pattern 2: Supabase Row DELETE (Optimistic)

```typescript
// Source: https://context7.com/supabase/supabase-js/llms.txt
const deleteTrade = useCallback(async (id: string) => {
  if (!user) {
    setTrades((prev) => prev.filter((t) => t.id !== id))
    return
  }
  const prev = trades  // capture for rollback
  setTrades((prev) => prev.filter((t) => t.id !== id))  // optimistic
  const { error } = await supabase
    .from("trades")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
  if (error) {
    setTrades(prev)  // rollback
    showToast("Failed to delete trade — please try again")
  }
}, [user, trades, supabase, showToast])
```

[VERIFIED: Context7 /supabase/supabase-js — delete pattern]

### Pattern 3: Fetch on Mount (Post-Hydration)

```typescript
// Source: https://context7.com/supabase/supabase-js/llms.txt
useEffect(() => {
  if (!hydrated || !user) return
  async function fetchFromSupabase() {
    const { data: tradesData } = await supabase
      .from("trades")
      .select("*")
      .eq("user_id", user!.id)
      .order("date", { ascending: false })
    if (tradesData) setTrades(tradesData as Trade[])

    const { data: coachingData } = await supabase
      .from("coaching_entries")
      .select("*")
      .eq("user_id", user!.id)
      .order("timestamp", { ascending: true })
    if (coachingData) setCoachingHistory(coachingData as CoachingEntry[])

    // Pattern summary from user_metadata (loaded with session — no DB call needed)
    const summary = user!.user_metadata?.pattern_summary as string | undefined
    if (summary) setPatternSummary(summary)
  }
  fetchFromSupabase()
}, [hydrated, user])
```

[VERIFIED: Context7 /supabase/supabase-js — select + order pattern]

### Pattern 4: V5 Migration (Upsert, Idempotent)

```typescript
// Source: https://context7.com/supabase/supabase-js/llms.txt
async function runV5Migration(user: User, supabase: SupabaseClient) {
  if (user.user_metadata?.v5_migrated) return

  const rawTrades = localStorage.getItem("edge_v5_trades")
  const rawCoaching = localStorage.getItem("edge_v5_coaching_history")
  const patternSummary = localStorage.getItem("edge_v5_pattern_summary") ?? ""
  const strategyText = localStorage.getItem("edge_v5_strategy_text") ?? ""

  const trades: Trade[] = rawTrades ? JSON.parse(rawTrades) : []
  const coaching: CoachingEntry[] = rawCoaching ? JSON.parse(rawCoaching) : []

  if (trades.length > 0) {
    await supabase
      .from("trades")
      .upsert(
        trades.map((t) => ({ ...t, user_id: user.id })),
        { onConflict: "id" }
      )
  }

  if (coaching.length > 0) {
    await supabase
      .from("coaching_entries")
      .upsert(
        coaching.map((e) => ({ ...e, user_id: user.id })),
        { onConflict: "id" }
      )
  }

  // Only set flag after both writes succeed
  await supabase.auth.updateUser({
    data: { pattern_summary: patternSummary, strategy_text: strategyText, v5_migrated: true }
  })
}
```

[VERIFIED: Context7 /supabase/supabase-js — upsert with onConflict pattern]

### Pattern 5: SQL Schema — `trades` Table

```sql
-- Source: https://supabase.com/docs/guides/auth/row-level-security
CREATE TABLE IF NOT EXISTS public.trades (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,
  time        TEXT NOT NULL,
  instrument  TEXT NOT NULL,
  direction   TEXT NOT NULL CHECK (direction IN ('long', 'short')),
  session     TEXT NOT NULL,
  contracts   INTEGER NOT NULL,
  pnl         NUMERIC NOT NULL,
  rmult       NUMERIC NOT NULL,
  outcome     TEXT NOT NULL CHECK (outcome IN ('win', 'loss', 'breakeven')),
  confluences TEXT[] NOT NULL DEFAULT '{}',
  notes       TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own trades"
  ON public.trades
  FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE INDEX trades_user_id_idx ON public.trades USING btree (user_id);
```

[VERIFIED: Context7 /websites/supabase — RLS policy and index patterns]

### Pattern 6: SQL Schema — `coaching_entries` Table

```sql
CREATE TABLE IF NOT EXISTS public.coaching_entries (
  id              TEXT PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timestamp       TEXT NOT NULL,
  trade_count     INTEGER NOT NULL DEFAULT 0,
  title           TEXT NOT NULL DEFAULT '',
  full_content    TEXT NOT NULL DEFAULT '',
  archived        BOOLEAN NOT NULL DEFAULT FALSE,
  mode            TEXT NOT NULL DEFAULT 'analyze',
  -- legacy fields kept for backward compat with CoachingEntry type
  market_snapshot TEXT NOT NULL DEFAULT '',
  patterns        TEXT NOT NULL DEFAULT '',
  process         TEXT NOT NULL DEFAULT '',
  risk            TEXT NOT NULL DEFAULT '',
  priority        TEXT NOT NULL DEFAULT '',
  momentum        TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.coaching_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own coaching entries"
  ON public.coaching_entries
  FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE INDEX coaching_entries_user_id_idx ON public.coaching_entries USING btree (user_id);
```

[VERIFIED: Context7 /websites/supabase — RLS policy patterns; column names derived from Trade/CoachingEntry types in app/lib/types.ts]

**Column naming note:** Supabase/Postgres convention uses `snake_case`. JavaScript TypeScript types use `camelCase`. The mapping must be consistent:

| TypeScript field | DB column |
|-----------------|-----------|
| `tradeCount` | `trade_count` |
| `fullContent` | `full_content` |
| `archived` | `archived` (no change) |
| `marketSnapshot` | `market_snapshot` |

[ASSUMED: camelCase→snake_case mapping is the right approach here vs. storing raw camelCase column names. Supabase PostgREST returns data with DB column names — callers must remap on read, or use a select alias, or configure Supabase to use camelCase (not recommended). The plan should include explicit mapping logic in TradesContext.]

### Pattern 7: Toast Component (Minimal)

No toast library is installed. Given CLAUDE.md rules (no generic AI aesthetics, Midnight Market design, glass over orbs), a small custom toast is appropriate:

```typescript
// Minimal toast state — lives in TradesContext or a dedicated hook
const [toast, setToast] = useState<string | null>(null)
const showToast = useCallback((message: string) => {
  setToast(message)
  setTimeout(() => setToast(null), 4000)
}, [])
```

The toast render is a fixed-position element using `--bg3`, `--border-accent`, `--red` (for errors), IBM Plex Mono for any data values. It must respect `env(safe-area-inset-bottom)` on mobile.

[ASSUMED: A minimal inline toast is preferable to installing a library like react-hot-toast. The CONTEXT.md leaves this to Claude's discretion.]

### Anti-Patterns to Avoid

- **Blocking the UI on Supabase writes:** Never `await` a DB write before updating React state. Always update state first (optimistic), write in background.
- **Fetching before `hydrated`:** The existing `hydrated` flag pattern in TradesContext must gate the Supabase fetch. Fetching before localStorage hydration causes a flash of empty state.
- **Using the server Supabase client in TradesContext:** `lib/supabase/server.ts` uses `cookies()` and is server-only. TradesContext is `"use client"` — it must use `lib/supabase/client.ts`.
- **Querying without `.eq("user_id", user.id)`:** RLS policies protect at the DB level, but always scope queries explicitly for defense in depth and clarity.
- **Setting `v5_migrated: true` before both writes succeed:** If trades or coaching entry upserts fail, the flag must not be set — the migration must be fully retryable.
- **camelCase column names in SQL:** Postgres stores unquoted identifiers in lowercase. Use `snake_case` in SQL, remap to camelCase in TypeScript.
- **Storing `strategy_text` in a separate table for Phase 2:** D-12 says "simple persisted text field." Keep it in `user_metadata` alongside `pattern_summary` — no extra table, no extra RLS policy.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Database queries | Custom fetch wrappers | `supabase.from().select()` etc. | PostgREST builder handles auth headers, JSON serialization, error normalization |
| RLS policy | App-level user_id checks in API routes | Postgres RLS `auth.uid() = user_id` | DB-level enforcement can't be bypassed even if app code has a bug |
| Upsert-or-insert logic | Check if row exists, then INSERT or UPDATE | `supabase.from().upsert({ onConflict: 'id' })` | Atomic, no race conditions, handles migration retries |
| Conflict detection on migration | Fetch existing IDs, diff against local | Upsert with `onConflict: 'id'` | Let Postgres handle conflicts — no extra read round-trip needed |
| Auth user metadata storage | Separate `user_profiles` table for pattern_summary | `supabase.auth.updateUser({ data: {...} })` | Already established pattern from Phase 1 for gemini_api_key |

**Key insight:** The browser Supabase client already carries the authenticated user's JWT. Every query is automatically scoped — the RLS policy is the enforcement, the `.eq("user_id", user.id)` on the client is a defensive redundancy that also makes the intent visible to developers.

---

## Runtime State Inventory

> Included because this phase migrates existing V5 localStorage data.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `edge_v5_trades` — Trade[] in localStorage | Read and upsert into `trades` table during V5 migration |
| Stored data | `edge_v5_coaching_history` — CoachingEntry[] in localStorage (capped at 30 persisted) | Read and upsert into `coaching_entries` table during V5 migration |
| Stored data | `edge_v5_pattern_summary` — string in localStorage | Read and write to `user_metadata.pattern_summary` during V5 migration |
| Stored data | `edge_v5_strategy_text` — string written directly via `localStorage.setItem` in `importData` (not managed by TradesContext state) | Read and write to `user_metadata.strategy_text` during V5 migration |
| Live service config | None — no external services store this data outside git/localStorage | — |
| OS-registered state | None | — |
| Secrets/env vars | `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` already in `.env.local` — no new env vars needed for Phase 2 | — |
| Build artifacts | None relevant to migration | — |

**Post-migration behavior:** After V5 migration completes, all five `edge_v5_*` localStorage keys remain in place as a warm read cache per D-08 and PERSIST-05. They are NOT cleared. Future reads continue to hit localStorage first (instant hydration), then Supabase overwrites on mount.

**`edge_v5_apikey` note:** This key was retired in Phase 1 (D-10 from 01-CONTEXT.md) — it no longer exists in TradesContext. It does not need migration — the Gemini key now lives in `user_metadata.gemini_api_key`.

---

## Common Pitfalls

### Pitfall 1: camelCase/snake_case Mismatch
**What goes wrong:** `supabase.from("trades").insert(trade)` silently inserts `undefined` for snake_case columns because TypeScript Trade fields are camelCase (`tradeCount`, `fullContent`) but DB columns are `trade_count`, `full_content`.
**Why it happens:** Supabase JS sends the object as-is; PostgREST maps by exact column name.
**How to avoid:** Define explicit serialization functions `tradeToRow(t: Trade): TradeRow` and `rowToTrade(r: TradeRow): Trade` for both tables. Use these in all insert/select calls.
**Warning signs:** `null` or missing data in Supabase dashboard table viewer after inserts; TypeScript not catching it because the JS SDK accepts `Record<string, unknown>`.

### Pitfall 2: Fetching Supabase Before User Is Available
**What goes wrong:** TradesContext `useEffect` fires on mount, calls `supabase.from("trades").select()` with no user, RLS returns empty array, overwrites localStorage data with [].
**Why it happens:** `user` from `useAuthContext()` may be `null` on first render even if a session exists (initial async auth check).
**How to avoid:** Gate the Supabase fetch on `hydrated && user !== null`. The `user` object from AuthProvider's `initialUser` prop is already populated from the server-side `getUser()` call in `layout.tsx` — use this as the initial gate.
**Warning signs:** App shows empty trades list on load, then populates after a refresh.

### Pitfall 3: Rollback Capturing Stale Closure State
**What goes wrong:** The rollback in an optimistic delete captures the trades array at the time the `useCallback` was created, not at the time the delete ran — rolling back to an outdated snapshot.
**Why it happens:** React `useCallback` with stale closure over `trades` state.
**How to avoid:** Inside the mutation, capture the pre-mutation state using the functional updater form or by reading it directly before the optimistic update: `const snapshot = tradesRef.current` (or read from the setter's functional form). The most reliable pattern is to capture `prev` inside `setTrades(prev => ...)` and use a `useRef` to store the snapshot for the async rollback.
**Warning signs:** After a delete fails, the rolled-back list doesn't match what was displayed before the delete.

### Pitfall 4: `edge_v5_strategy_text` Not in TradesContext State
**What goes wrong:** Migration code tries to read strategy text from TradesContext state but finds nothing — the value was written directly to localStorage in `importData()` and never managed as React state.
**Why it happens:** `importData` in the current TradesContext does `localStorage.setItem("edge_v5_strategy_text", pkg.strategyText)` directly, bypassing React state.
**How to avoid:** In the migration function, read `localStorage.getItem("edge_v5_strategy_text")` directly (not from React state). This is the correct read path for this value until REQUIREMENTS.md PWA-03 (Phase 3) adds reactive state for strategyText.
**Warning signs:** Strategy text migration appears to succeed but the value is empty in Supabase.

### Pitfall 5: V5 Migration Flag Race Condition
**What goes wrong:** Migration runs, partial writes succeed, the `auth.updateUser` call with `v5_migrated: true` also succeeds, but a network drop between the final upsert and the flag means the flag is set even though data is incomplete.
**Why it happens:** D-07 decision requires setting the flag only after success — but "success" must mean all three writes (trades upsert, coaching upsert, metadata update) completed.
**How to avoid:** Structure migration as a sequential chain: `upsertTrades` → `upsertCoaching` → `updateMetadata({ v5_migrated: true, ... })`. Only reach `updateMetadata` if both upserts returned no error. If any step fails, do not proceed to the flag.
**Warning signs:** `v5_migrated: true` in user_metadata but missing trades in Supabase.

### Pitfall 6: RLS Policy Missing `WITH CHECK`
**What goes wrong:** Users can read only their own rows (SELECT works) but can INSERT rows with any `user_id`, including other users' IDs.
**Why it happens:** `USING` clause covers SELECT/UPDATE/DELETE; INSERT requires `WITH CHECK`.
**How to avoid:** Always pair `USING (auth.uid() = user_id)` with `WITH CHECK (auth.uid() = user_id)` in a single policy or separate INSERT policy.
**Warning signs:** Security audit would catch this; functional tests would not.

---

## Code Examples

### Full RLS Migration SQL

```sql
-- Source: https://supabase.com/docs/guides/auth/row-level-security

-- trades table
CREATE TABLE IF NOT EXISTS public.trades (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,
  time        TEXT NOT NULL,
  instrument  TEXT NOT NULL,
  direction   TEXT NOT NULL CHECK (direction IN ('long', 'short')),
  session     TEXT NOT NULL,
  contracts   INTEGER NOT NULL DEFAULT 1,
  pnl         NUMERIC NOT NULL DEFAULT 0,
  rmult       NUMERIC NOT NULL DEFAULT 0,
  outcome     TEXT NOT NULL DEFAULT 'breakeven' CHECK (outcome IN ('win', 'loss', 'breakeven')),
  confluences TEXT[] NOT NULL DEFAULT '{}',
  notes       TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_trades" ON public.trades
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE INDEX trades_user_id_idx ON public.trades USING btree (user_id);

-- coaching_entries table
CREATE TABLE IF NOT EXISTS public.coaching_entries (
  id              TEXT PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timestamp       TEXT NOT NULL,
  trade_count     INTEGER NOT NULL DEFAULT 0,
  title           TEXT NOT NULL DEFAULT '',
  full_content    TEXT NOT NULL DEFAULT '',
  archived        BOOLEAN NOT NULL DEFAULT FALSE,
  mode            TEXT NOT NULL DEFAULT 'analyze',
  market_snapshot TEXT NOT NULL DEFAULT '',
  patterns        TEXT NOT NULL DEFAULT '',
  process         TEXT NOT NULL DEFAULT '',
  risk            TEXT NOT NULL DEFAULT '',
  priority        TEXT NOT NULL DEFAULT '',
  momentum        TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.coaching_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_coaching" ON public.coaching_entries
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE INDEX coaching_entries_user_id_idx ON public.coaching_entries USING btree (user_id);
```

### Type Mapping Helpers

```typescript
// Trade → DB row (camelCase → snake_case)
function tradeToRow(t: Trade, userId: string) {
  return {
    id: t.id,
    user_id: userId,
    date: t.date,
    time: t.time,
    instrument: t.instrument,
    direction: t.direction,
    session: t.session,
    contracts: t.contracts,
    pnl: t.pnl,
    rmult: t.rmult,
    outcome: t.outcome,
    confluences: t.confluences,
    notes: t.notes,
  }
}

// DB row → Trade (snake_case → camelCase)
function rowToTrade(row: Record<string, unknown>): Trade {
  return {
    id: row.id as string,
    date: row.date as string,
    time: row.time as string,
    instrument: row.instrument as string,
    direction: row.direction as "long" | "short",
    session: row.session as string,
    contracts: row.contracts as number,
    pnl: row.pnl as number,
    rmult: row.rmult as number,
    outcome: row.outcome as "win" | "loss" | "breakeven",
    confluences: row.confluences as string[],
    notes: row.notes as string,
  }
}

// CoachingEntry → DB row
function coachingEntryToRow(e: CoachingEntry, userId: string) {
  return {
    id: e.id,
    user_id: userId,
    timestamp: e.timestamp,
    trade_count: e.tradeCount,
    title: e.title,
    full_content: e.fullContent,
    archived: e.archived,
    mode: e.mode,
    market_snapshot: e.marketSnapshot,
    patterns: e.patterns,
    process: e.process,
    risk: e.risk,
    priority: e.priority,
    momentum: e.momentum,
  }
}

// DB row → CoachingEntry
function rowToCoachingEntry(row: Record<string, unknown>): CoachingEntry {
  return {
    id: row.id as string,
    timestamp: row.timestamp as string,
    tradeCount: row.trade_count as number,
    title: row.title as string,
    fullContent: row.full_content as string,
    archived: row.archived as boolean,
    mode: row.mode as CoachingEntry["mode"],
    marketSnapshot: row.market_snapshot as string,
    patterns: row.patterns as string,
    process: row.process as string,
    risk: row.risk as string,
    priority: row.priority as string,
    momentum: row.momentum as string,
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` `createClientComponentClient` | `@supabase/ssr` `createBrowserClient` | 2023–2024 | Auth helpers deprecated; `@supabase/ssr` is the correct package for Next.js App Router |
| Global `auth.uid()` in RLS | `(SELECT auth.uid())` (subquery form) | 2024 | Supabase docs now recommend subquery form for RLS performance — evaluated once per query rather than per row |

[CITED: https://supabase.com/docs/guides/auth/row-level-security]

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: superseded by `@supabase/ssr` — already using the correct package
- `supabase.from().insert().then()`: older promise style — use `await` with destructured `{ data, error }`

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A minimal custom toast component is preferable to installing react-hot-toast or similar | Architecture Patterns (Pattern 7) | If CLAUDE.md is interpreted to require a specific toast lib, the planner would need to reconsider; the design rules give Claude discretion here |
| A2 | `strategy_text` should be stored in `user_metadata` alongside `pattern_summary` (not a separate `user_strategy` table) | Don't Hand-Roll | If strategy text grows large (>8KB) it could hit Supabase user_metadata size limits; D-12 says "simple text field" which fits user_metadata well for Phase 2 |
| A3 | camelCase → snake_case mapping is required (Supabase will not auto-convert) | Architecture Patterns (Pitfall 1, Code Examples) | If the project configures Supabase's `db_schema` camelCase option or uses a generated TypeScript client, explicit mapping could be unnecessary — but no such config exists in this project |
| A4 | `TradesContext` should receive `user` from `useAuthContext()` hook (not re-fetch via `supabase.auth.getUser()`) | Architecture Patterns | Both approaches work; using the existing `useAuthContext()` hook avoids a duplicate auth call and aligns with established Phase 1 patterns |

**If this table is empty:** All claims were verified or cited.

---

## Open Questions (RESOLVED)

1. **`strategyText` reactive state (PWA-03 is Phase 3)**
   - What we know: `edge_v5_strategy_text` is written directly via `localStorage.setItem` in `importData()` — not managed as React state in TradesContext
   - What's unclear: Phase 2 needs to persist strategy text to Supabase (D-12), but PWA-03 (Phase 3) is what adds reactive state. Should Phase 2 add a `strategyText` state field to TradesContext now, or keep the direct-localStorage write and only add the Supabase write?
   - Recommendation: Phase 2 plan should add minimal `strategyText` state to TradesContext (as a read-only load from Supabase/user_metadata on mount) and wire it into the `updateStrategyText` mutation, even if the full reactive state per PWA-03 is Phase 3. This avoids a half-migration where Phase 2 has Supabase persistence but Phase 3 must retrofit state management.
   - RESOLVED: Plan 02-03 Task 1 adds `strategyText` state to TradesContext (loaded from `user_metadata.strategy_text` on mount) and `updateStrategyText` mutation. Full reactive PWA-03 state deferred to Phase 3 as planned.

2. **`user_metadata` size limit for strategy text**
   - What we know: Supabase `user_metadata` is stored in the `auth.users` table as JSONB. Pattern summary is ~500 chars. Strategy text could grow larger (the Strategy tab has extensive content).
   - What's unclear: The exact byte limit for Supabase `user_metadata` is not documented explicitly in official docs.
   - Recommendation: For Phase 2, assume strategy text fits in `user_metadata` (D-12 treats it as "simple text field"). If the Strategy tab's full text is persisted, monitor for any `422` errors from the Auth API on `updateUser`. If it grows too large, a `user_strategy` table is the fallback — but this is Phase 3+ scope per deferred items.
   - RESOLVED: Proceeding with `user_metadata` per D-12. Strategy text in the Strategy tab is plain text; typical content is well under 8KB. Monitor for 422 errors from the Supabase Auth API in production; escalate to a `user_strategy` table if hit (Phase 3+ scope).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@supabase/supabase-js` | All DB operations | ✓ | 2.49.4 (installed) / 2.105.3 (registry) | — |
| `@supabase/ssr` | Browser/server client factories | ✓ | 0.10.2 | — |
| Supabase project (hosted) | DB tables, RLS, auth | ✓ | Active — `NEXT_PUBLIC_SUPABASE_URL` confirmed in `.env.local` | — |
| SQL migration tooling | Creating tables + RLS | No local `supabase/` directory | — | Execute migration SQL directly in Supabase dashboard SQL editor |

[VERIFIED: `npm view @supabase/supabase-js version` confirmed 2.105.3 on registry; package.json shows 2.49.4 installed; `.env.local` confirms active Supabase project URL]

**Missing dependencies with no fallback:** None.

**Note on SQL migrations:** No local Supabase CLI directory (`supabase/`) exists. The migration SQL should be created as a file in `supabase/migrations/` for the plan executor to run via `supabase db push` — OR the planner can include a task to run it directly via the Supabase SQL editor (the simpler path given this is a solo dev project).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None installed — Wave 0 gap |
| Config file | None |
| Quick run command | `npx tsc --noEmit` (TypeScript check — available now) |
| Full suite command | Wave 0 must install framework first |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERSIST-01 | Trade insert reaches Supabase with correct user_id | Integration (manual) | Browser smoke: add trade, check Supabase dashboard | ❌ |
| PERSIST-01 | Trade delete removes row from Supabase | Integration (manual) | Browser smoke: delete trade, check Supabase dashboard | ❌ |
| PERSIST-01 | Optimistic rollback restores state on Supabase error | Unit (manual simulation) | Temporarily break network, verify rollback | ❌ |
| PERSIST-02 | Coaching entry insert reaches Supabase | Integration (manual) | Browser smoke: trigger coach analyze, check dashboard | ❌ |
| PERSIST-03 | Pattern summary survives localStorage clear | Smoke | Clear LS, reload, verify pattern summary loads | ❌ |
| PERSIST-04 | V5 trades present in Supabase after first login | Smoke | Clear `v5_migrated`, reload, check Supabase dashboard | ❌ |
| PERSIST-05 | App renders data before Supabase fetch resolves | Smoke (throttle network) | DevTools → Network throttle → reload, verify instant render | ❌ |
| TypeScript | Zero compile errors | Automated | `npx tsc --noEmit` | ✓ (always) |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit`
- **Per wave merge:** `npx tsc --noEmit` + manual browser smoke tests
- **Phase gate:** All browser smoke tests confirmed + `npx tsc --noEmit` clean before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] No automated test framework installed — integration tests for Supabase persistence are manual smoke tests only. This is acceptable for Phase 2 given the solo-dev context; automated DB integration tests are a Phase 4 concern.
- [ ] Verify `npx tsc --noEmit` still passes after TradesContext is augmented (this is the primary automated gate).

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No — handled in Phase 1 | — |
| V3 Session Management | No — handled in Phase 1 | — |
| V4 Access Control | Yes | Postgres RLS `auth.uid() = user_id` on all tables |
| V5 Input Validation | Partial — DB writes | `CHECK` constraints on `direction` and `outcome` columns; no user-supplied SQL |
| V6 Cryptography | No | Data at rest encrypted by Supabase (managed Postgres) |

### Known Threat Patterns for Supabase + Next.js Client Components

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| User accesses another user's data | Elevation of Privilege | RLS policy `auth.uid() = user_id` — enforced at DB level |
| Client sends arbitrary `user_id` in insert body | Tampering | RLS `WITH CHECK (auth.uid() = user_id)` rejects rows where user_id != auth'd user |
| Unauthenticated DB read bypassing app-level checks | Information Disclosure | RLS policies only allow `authenticated` role — anon key without a session gets 0 rows |
| `v5_migrated` flag tampered to block migration | Tampering | `user_metadata` is writable by the authenticated user only; no third-party access |

---

## Project Constraints (from CLAUDE.md)

- **No hardcoded colors** — toast component must use CSS custom properties (`--red`, `--bg3`, `--border-accent`)
- **IBM Plex Mono on every number** — if toast shows any numeric data (e.g., retry count), use IBM Plex Mono
- **No `transition: all`** — targeted transitions only on toast enter/exit animation
- **Server components by default** — TradesContext stays `"use client"`; no new server components added for persistence layer
- **TypeScript strict** — `npx tsc --noEmit` must pass; all new functions must be typed (no `any`)
- **`"use client"` only when required** — TradesContext already requires it; no new client components unless needed
- **No comments unless WHY is non-obvious** — migration function may warrant comments for the idempotency reasoning
- **`edge_v5_*` localStorage key prefix** — keep writing these after Supabase sync (cache stays warm); do NOT rename

---

## Sources

### Primary (HIGH confidence)
- Context7 `/supabase/supabase-js` — insert, upsert, delete, select, auth.updateUser patterns
- Context7 `/websites/supabase` — RLS policies, index patterns, migration SQL
- `app/lib/TradesContext.tsx` — current state manager patterns, hydration flag, mutation callbacks
- `app/lib/types.ts` — Trade and CoachingEntry type definitions used for schema derivation
- `lib/supabase/client.ts`, `lib/supabase/server.ts` — confirmed Phase 1 client factory setup
- `app/components/AuthProvider.tsx` — confirmed `useAuthContext()` hook and `user` exposure
- `.env.local` — confirmed active Supabase project URL
- `package.json` — confirmed installed package versions

### Secondary (MEDIUM confidence)
- `https://supabase.com/docs/guides/auth/row-level-security` — RLS `(SELECT auth.uid())` subquery form recommendation
- `.planning/phases/01-auth-and-security/01-CONTEXT.md` — confirmed `user_metadata` pattern for gemini_api_key (Phase 1 precedent for D-11/D-13)

### Tertiary (LOW confidence — ASSUMED items)
- See Assumptions Log A1–A4

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — packages verified against npm registry, already installed
- Architecture: HIGH — patterns verified against Context7 official Supabase docs; existing codebase patterns fully read
- SQL schema: HIGH — column types match TypeScript types directly; RLS patterns from official docs
- Pitfalls: HIGH — derived from known Supabase/React integration issues, verified against codebase specifics
- Toast component: MEDIUM — approach is sound but implementation detail is discretionary per CONTEXT.md

**Research date:** 2026-05-05
**Valid until:** 2026-06-05 (30 days — Supabase JS client is stable; RLS patterns are stable)
