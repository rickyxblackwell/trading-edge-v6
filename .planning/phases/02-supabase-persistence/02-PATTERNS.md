# Phase 2: Supabase Persistence - Pattern Map

**Mapped:** 2026-05-05
**Files analyzed:** 5 new/modified files
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/lib/TradesContext.tsx` | provider/store | CRUD + optimistic | `app/lib/TradesContext.tsx` (self — augment existing) | exact |
| `app/components/AuthProvider.tsx` | provider | event-driven (auth state) | `app/components/AuthProvider.tsx` (self — augment existing) | exact |
| `app/components/Toast.tsx` | component | event-driven | `app/components/tabs/Account.tsx` (inline feedback patterns) | role-match |
| `app/lib/toast.ts` | utility/hook | event-driven | `app/components/tabs/Account.tsx` (timeout-dismiss pattern lines 43-47) | partial |
| `supabase/migrations/20260505000000_phase2_persistence.sql` | migration | batch / DDL | none — no existing SQL files | no analog |

---

## Pattern Assignments

### `app/lib/TradesContext.tsx` (provider/store, CRUD + optimistic)

**Analog:** `app/lib/TradesContext.tsx` — self-augmentation; extend every existing mutation

**Imports pattern to add** (insert after line 4):
```typescript
import { createClient } from "@/lib/supabase/client"
import { useAuthContext } from "@/app/components/AuthProvider"
import type { SupabaseClient } from "@supabase/supabase-js"
```

**Existing hydration pattern** (lines 48-53) — keep unchanged, then add a second `useEffect` after it:
```typescript
// Existing: hydrate from localStorage on mount
useEffect(() => {
  setTrades(readLS<Trade[]>(TRADES_KEY, []))
  setCoachingHistory(readLS<CoachingEntry[]>(COACHING_KEY, []))
  setPatternSummary(readLS<string>(PATTERN_KEY, ""))
  setHydrated(true)
}, [])

// NEW: fetch from Supabase after hydration and user are both available
// Gate on hydrated && user — prevents empty-array overwrite before auth resolves
useEffect(() => {
  if (!hydrated || !user) return
  async function fetchFromSupabase() {
    const { data: tradesData } = await supabase
      .from("trades")
      .select("*")
      .eq("user_id", user!.id)
      .order("date", { ascending: false })
    if (tradesData) setTrades(tradesData.map(rowToTrade))

    const { data: coachingData } = await supabase
      .from("coaching_entries")
      .select("*")
      .eq("user_id", user!.id)
      .order("timestamp", { ascending: true })
    if (coachingData) setCoachingHistory(coachingData.map(rowToCoachingEntry))

    const summary = user!.user_metadata?.pattern_summary as string | undefined
    if (summary) setPatternSummary(summary)
  }
  fetchFromSupabase()
}, [hydrated, user])
```

**Existing `useCallback` mutation pattern** (lines 70-98) — copy this pattern for all augmented mutations:
```typescript
// Existing pattern to replicate for Supabase writes:
const addTrade = useCallback((t: Trade) => {
  setTrades((prev) => [t, ...prev])
}, [])

// Phase 2 augmented version:
const addTrade = useCallback(async (t: Trade) => {
  setTrades((prev) => [t, ...prev])              // optimistic — state updates immediately
  localStorage.setItem(TRADES_KEY, ...)           // cache stays warm
  if (!user) return                               // unauthenticated — localStorage only
  const { error } = await supabase
    .from("trades")
    .insert(tradeToRow(t, user.id))
  if (error) {
    setTrades((prev) => prev.filter((trade) => trade.id !== t.id))  // rollback
    showToast("Failed to save trade — please try again")
  }
}, [user, supabase, showToast])
```

**Optimistic delete with pre-capture rollback** — derived from RESEARCH.md Pitfall 3 guidance:
```typescript
const deleteTrade = useCallback(async (id: string) => {
  const snapshot = trades  // capture BEFORE optimistic update — avoids stale closure on rollback
  setTrades((prev) => prev.filter((t) => t.id !== id))
  if (!user) return
  const { error } = await supabase
    .from("trades")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
  if (error) {
    setTrades(snapshot)  // restore exact pre-delete state
    showToast("Failed to delete trade — please try again")
  }
}, [user, trades, supabase, showToast])
```

**Fire-and-forget pattern** (pattern summary — D-04):
```typescript
const updatePatternSummary = useCallback((s: string) => {
  setPatternSummary(s)
  supabase.auth.updateUser({ data: { pattern_summary: s } })
  // no await, no error handler — D-04: derived data, silent failure acceptable
}, [supabase])
```

**camelCase ↔ snake_case mapping helpers** — place as module-level pure functions before `TradesProvider`:
```typescript
function tradeToRow(t: Trade, userId: string) {
  return {
    id: t.id, user_id: userId, date: t.date, time: t.time,
    instrument: t.instrument, direction: t.direction, session: t.session,
    contracts: t.contracts, pnl: t.pnl, rmult: t.rmult,
    outcome: t.outcome, confluences: t.confluences, notes: t.notes,
  }
}

function rowToTrade(row: Record<string, unknown>): Trade {
  return {
    id: row.id as string, date: row.date as string, time: row.time as string,
    instrument: row.instrument as string,
    direction: row.direction as "long" | "short",
    session: row.session as string, contracts: row.contracts as number,
    pnl: row.pnl as number, rmult: row.rmult as number,
    outcome: row.outcome as "win" | "loss" | "breakeven",
    confluences: row.confluences as string[], notes: row.notes as string,
  }
}

function coachingEntryToRow(e: CoachingEntry, userId: string) {
  return {
    id: e.id, user_id: userId, timestamp: e.timestamp,
    trade_count: e.tradeCount, title: e.title, full_content: e.fullContent,
    archived: e.archived, mode: e.mode, market_snapshot: e.marketSnapshot,
    patterns: e.patterns, process: e.process, risk: e.risk,
    priority: e.priority, momentum: e.momentum,
  }
}

function rowToCoachingEntry(row: Record<string, unknown>): CoachingEntry {
  return {
    id: row.id as string, timestamp: row.timestamp as string,
    tradeCount: row.trade_count as number, title: row.title as string,
    fullContent: row.full_content as string, archived: row.archived as boolean,
    mode: row.mode as CoachingEntry["mode"],
    marketSnapshot: row.market_snapshot as string,
    patterns: row.patterns as string, process: row.process as string,
    risk: row.risk as string, priority: row.priority as string,
    momentum: row.momentum as string,
  }
}
```

**Context value interface additions** — extend `TradesContextValue` (line 18):
```typescript
interface TradesContextValue {
  // ... existing fields unchanged ...
  strategyText: string
  updateStrategyText: (s: string) => void
}
```

---

### `app/components/AuthProvider.tsx` (provider, event-driven auth state)

**Analog:** `app/components/AuthProvider.tsx` — self-augmentation; add V5 migration trigger to `onAuthStateChange`

**Existing `onAuthStateChange` pattern** (lines 40-48) — add migration call inside SIGNED_IN event:
```typescript
// Existing pattern — augment the SIGNED_OUT branch with a SIGNED_IN branch:
supabase.auth.onAuthStateChange((event, session) => {
  setUser(session?.user ?? null)
  if (event === "SIGNED_OUT") {
    router.push("/login")
  }
  // NEW: fire migration on sign-in if flag not yet set
  if (event === "SIGNED_IN" && session?.user) {
    runV5Migration(session.user, supabase)  // background, no await — D-05
  }
})
```

**V5 migration function** — place as module-level async function in AuthProvider.tsx (not exported):
```typescript
// Idempotent: if any write fails, v5_migrated flag is NOT set → full retry on next login (D-07)
async function runV5Migration(user: User, supabase: ReturnType<typeof createClient>) {
  if (user.user_metadata?.v5_migrated) return

  const rawTrades = localStorage.getItem("edge_v5_trades")
  const rawCoaching = localStorage.getItem("edge_v5_coaching_history")
  const patternSummary = localStorage.getItem("edge_v5_pattern_summary") ?? ""
  const strategyText = localStorage.getItem("edge_v5_strategy_text") ?? ""

  const trades = rawTrades ? (JSON.parse(rawTrades) as Trade[]) : []
  const coaching = rawCoaching ? (JSON.parse(rawCoaching) as CoachingEntry[]) : []

  if (trades.length > 0) {
    const { error } = await supabase
      .from("trades")
      .upsert(trades.map((t) => tradeToRow(t, user.id)), { onConflict: "id" })
    if (error) return  // abort — flag will not be set → retry on next login
  }

  if (coaching.length > 0) {
    const { error } = await supabase
      .from("coaching_entries")
      .upsert(coaching.map((e) => coachingEntryToRow(e, user.id)), { onConflict: "id" })
    if (error) return  // abort
  }

  // Only set flag after both upserts succeed (D-07)
  await supabase.auth.updateUser({
    data: { pattern_summary: patternSummary, strategy_text: strategyText, v5_migrated: true },
  })
}
```

**`supabase.auth.updateUser` pattern precedent** — sourced from Account.tsx lines 53-55 (confirmed working in this project):
```typescript
const { error } = await supabase.auth.updateUser({
  data: { gemini_api_key: newKey.trim() },
})
```

---

### `app/components/Toast.tsx` (component, event-driven)

**Analog:** `app/components/tabs/Account.tsx` — inline feedback patterns

**Feedback visual pattern** (Account.tsx lines 313-328) — use as reference for success/error state styling:
```typescript
// Account.tsx success state — reference for green/red feedback visual language:
{saveSuccess ? (
  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
    <CheckCircle size={14} style={{ color: "var(--green)" }} />
    <span className="mono" style={{ fontSize: 13, color: "var(--green)" }}>
      Key saved
    </span>
  </div>
) : ...}
```

**Error/warning visual pattern** (Account.tsx lines 386-396):
```typescript
// Account.tsx alert triangle + red color — reference for error toast styling:
<AlertTriangle size={16} style={{ color: "var(--red)", flexShrink: 0 }} />
<span style={{ fontSize: 12, color: "var(--red)", fontFamily: "var(--font-inter, ...)" }}>
  Are you sure? This ends your session.
</span>
```

**New Toast component shape** — fixed-position, Midnight Market design, safe-area-aware:
```typescript
"use client"

interface ToastProps {
  message: string | null
}

export function Toast({ message }: ToastProps) {
  if (!message) return null
  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: "fixed",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",  // above mobile bottom bar
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        maxWidth: "calc(100vw - 32px)",
        padding: "10px 16px",
        borderRadius: 12,
        background: "var(--bg3)",
        border: "1px solid rgba(248,113,113,0.3)",  // --red tint border for error
        display: "flex",
        alignItems: "center",
        gap: 8,
        // Targeted transitions only — no transition: all (CLAUDE.md rule)
        animation: "toast-in 0.2s ease",
      }}
    >
      <AlertTriangle size={14} style={{ color: "var(--red)", flexShrink: 0 }} />
      <span style={{
        fontSize: 13,
        color: "var(--text)",
        fontFamily: "var(--font-inter, Inter, sans-serif)",
      }}>
        {message}
      </span>
    </div>
  )
}
```

---

### `app/lib/toast.ts` (utility hook, event-driven)

**Analog:** `app/components/tabs/Account.tsx` lines 43-47 — `setTimeout` dismiss pattern

**Existing timeout pattern from Account.tsx** (lines 43-47):
```typescript
// Account.tsx — auto-dismiss timeout pattern:
useEffect(() => {
  if (showLogoutConfirm) {
    const timer = setTimeout(() => setShowLogoutConfirm(false), 5000)
    return () => clearTimeout(timer)
  }
}, [showLogoutConfirm])
```

**New `useToast` hook** — minimal, consistent with Account.tsx timeout approach:
```typescript
"use client"

import { useState, useCallback } from "react"

export function useToast() {
  const [toast, setToast] = useState<string | null>(null)

  const showToast = useCallback((message: string) => {
    setToast(message)
    const id = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(id)  // cleanup if component unmounts mid-toast
  }, [])

  return { toast, showToast }
}
```

**Usage in TradesContext** — `useToast()` is called inside `TradesProvider`; `showToast` is passed as dependency to mutation `useCallback`s; `toast` is passed to `<Toast message={toast} />` rendered at bottom of `TradesContext.Provider` return.

---

### `supabase/migrations/20260505000000_phase2_persistence.sql` (migration, DDL/batch)

**Analog:** None — no existing SQL files in the project.

**Full SQL pattern** — sourced entirely from RESEARCH.md Code Examples (patterns verified against Supabase official docs):

```sql
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

**Key SQL notes for planner:**
- `(SELECT auth.uid())` subquery form (not bare `auth.uid()`) is the current Supabase recommendation — evaluates once per query, not per row
- Both `USING` and `WITH CHECK` are required — `USING` covers SELECT/UPDATE/DELETE, `WITH CHECK` covers INSERT
- No local `supabase/` CLI directory exists — planner should note that executor runs this via Supabase dashboard SQL editor OR creates the directory and runs `supabase db push`

---

## Shared Patterns

### Supabase Browser Client Instantiation
**Source:** `lib/supabase/client.ts` lines 1-8
**Apply to:** `TradesContext.tsx`, `AuthProvider.tsx` (migration function)
```typescript
import { createClient } from "@/lib/supabase/client"
// Call inside component/provider (not at module level) — SSR safe
const supabase = createClient()
```
The client is created via `createBrowserClient` from `@supabase/ssr` — do NOT use `lib/supabase/server.ts` (server-only, uses `cookies()`).

### `supabase.auth.updateUser` for user_metadata
**Source:** `app/components/tabs/Account.tsx` lines 53-55
**Apply to:** `TradesContext.tsx` (`updatePatternSummary`), `AuthProvider.tsx` (V5 migration)
```typescript
const { error } = await supabase.auth.updateUser({
  data: { gemini_api_key: newKey.trim() },
})
```
This is the established Phase 1 precedent for writing to `user_metadata`. Pattern summary and strategy text use the same call shape, just with different keys.

### `useCallback` on All Mutations
**Source:** `app/lib/TradesContext.tsx` lines 70-98
**Apply to:** All augmented mutations in `TradesContext.tsx`
```typescript
const addTrade = useCallback(async (t: Trade) => {
  // ... mutation body
}, [user, supabase, showToast])  // declare all async-closure deps
```
All existing mutations use `useCallback`. Phase 2 mutations must follow the same pattern and declare `user`, `supabase`, and `showToast` as deps when used inside the callback.

### `"use client"` + No Server Imports
**Source:** `app/lib/TradesContext.tsx` line 1 and `app/components/AuthProvider.tsx` line 1
**Apply to:** `Toast.tsx`, `toast.ts`, augmented `TradesContext.tsx`
```typescript
"use client"
```
All new files are client-side. Never import from `lib/supabase/server.ts` in these files.

### CSS Custom Properties + IBM Plex Mono (Design System)
**Source:** `app/globals.css` lines 1-78, `app/components/tabs/Account.tsx` throughout
**Apply to:** `Toast.tsx`
```typescript
// Color — always CSS custom properties, never hardcoded hex:
color: "var(--red)"          // error states
color: "var(--green)"        // success states
color: "var(--text)"         // body text
background: "var(--bg3)"     // surface background

// Font — Inter for labels, IBM Plex Mono for any numeric/data values:
fontFamily: "var(--font-inter, Inter, sans-serif)"       // message text
fontFamily: "var(--font-ibm-plex-mono, monospace)"       // any data values if shown

// Transitions — targeted only, never transition: all:
transition: "opacity 0.2s ease"   // OK
transition: "all 0.2s ease"       // NEVER
```

### `hydrated` Flag Gate Pattern
**Source:** `app/lib/TradesContext.tsx` lines 55-68
**Apply to:** The new Supabase fetch `useEffect` in `TradesContext.tsx`
```typescript
// Existing pattern — all localStorage writes are gated on hydrated:
useEffect(() => {
  if (hydrated) localStorage.setItem(TRADES_KEY, JSON.stringify(trades))
}, [trades, hydrated])

// New Supabase fetch follows the same gate — never fetch before hydration:
useEffect(() => {
  if (!hydrated || !user) return
  // ... fetch from Supabase
}, [hydrated, user])
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `supabase/migrations/20260505000000_phase2_persistence.sql` | migration | DDL/batch | No existing SQL files in the project — pattern comes from RESEARCH.md verified against Supabase official docs |

---

## Metadata

**Analog search scope:** `app/lib/`, `app/components/`, `lib/supabase/`, `app/globals.css`
**Files scanned:** 9 (TradesContext.tsx, types.ts, AuthProvider.tsx, Account.tsx, layout.tsx, globals.css, client.ts, server.ts, TradeModal.tsx)
**Files with exact analog:** 2 (TradesContext.tsx, AuthProvider.tsx — self-augmentation)
**Files with role-match analog:** 2 (Toast.tsx, toast.ts — Account.tsx feedback patterns)
**Files with no analog:** 1 (SQL migration)
**Pattern extraction date:** 2026-05-05
