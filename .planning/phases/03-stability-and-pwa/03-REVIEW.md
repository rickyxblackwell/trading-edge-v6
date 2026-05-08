---
phase: 03-stability-and-pwa
reviewed: 2026-05-08T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - app/components/TabErrorBoundary.tsx
  - app/components/TradeForm.tsx
  - app/components/tabs/Coach.tsx
  - app/components/tabs/Stats.tsx
  - app/layout.tsx
  - app/lib/TradesContext.tsx
  - app/manifest.ts
  - app/page.tsx
findings:
  critical: 3
  warning: 5
  info: 3
  total: 11
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-05-08T00:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Phase 03 adds error boundaries, PWA manifest, layout-level auth, and Supabase persistence wiring. The architecture is sound but three critical defects need fixing before ship: the `flush` fallback in `Coach.tsx` writes directly to localStorage bypassing Supabase (creating a ghost entry that will be overwritten on next sync), the `rawTrades` type annotation lies to the TypeScript compiler causing a null check to never fire, and `importData` silently discards all data for authenticated users because it never writes to Supabase. There are also five warnings around input validation gaps, a self-referential CSS variable, a font priority conflict, and a watchlist ticker parser that can capture common English words.

---

## Critical Issues

### CR-01: `flush` bypass writes to localStorage directly — Supabase never updated, entry silently lost on sync

**File:** `app/components/tabs/Coach.tsx:467-474`
**Issue:** The `flush` function (triggered on `beforeunload`, `pagehide`, and `visibilitychange=hidden`) writes a new `CoachingEntry` directly to `localStorage` via `JSON.parse/JSON.stringify`, completely bypassing the `addCoachingEntry` context function. For authenticated users this means the entry never reaches Supabase. On the next app load, `TradesContext` fetches from Supabase and calls `setCoachingHistory(coachingRes.data.map(rowToCoachingEntry))`, silently overwriting the localStorage entry. The session is effectively lost. Additionally the empty `catch {}` on line 474 swallows any parse error with no user feedback.

**Fix:**
```typescript
// Replace the direct localStorage write in flush() with the context function.
// Because flush fires on page hide, it must be synchronous — use a ref to
// access addCoachingEntry without closing over stale state.
const addCoachingEntryRef = useRef(addCoachingEntry)
useEffect(() => { addCoachingEntryRef.current = addCoachingEntry }, [addCoachingEntry])

// Inside flush():
const flush = () => {
  // ... build entry as before ...
  try {
    addCoachingEntryRef.current(entry)  // goes through context → Supabase
    messagesRef.current = []
  } catch (err) {
    console.error("[Coach flush]", err)
  }
}
```

---

### CR-02: `rawTrades` typed as `unknown[]` but assigned `null` — null check on line 335 is unreachable in TypeScript strict mode, silently processes `null` as truthy

**File:** `app/components/tabs/Stats.tsx:329-335`
**Issue:** `rawTrades` is declared as `unknown[]` but the ternary assigns `null` as the fallback branch. TypeScript accepts this only because the type annotation is a lie — `null` is not assignable to `unknown[]` yet the compiler does not error here because the `null` literal is inferred as `unknown[]` through contextual typing of the ternary. At runtime, if `raw` is a non-null non-array with no `.trades` array, `rawTrades` is `null`. The `if (!rawTrades)` check on line 335 correctly catches this, but on the next line `.map(normalizeTrade)` would throw before the check if TypeScript ever eliminates the check. More concretely: if someone passes `{}` as the JSON, `rawTrades` is `null`, the check fires correctly — but the type annotation creates a false guarantee that confuses future maintainers and static analysis tools. The `eslint-disable` on line 326 for `any` is correct but the downstream type annotation should match reality.

**Fix:**
```typescript
const rawTrades: unknown[] | null = Array.isArray(raw)
  ? raw
  : Array.isArray(raw.trades)
  ? raw.trades
  : null

if (!rawTrades) throw new Error("No trades array found")
```

---

### CR-03: `importData` never persists imported trades to Supabase — data loss for authenticated users on next sync

**File:** `app/lib/TradesContext.tsx:438-444`
**Issue:** `importData` calls `setTrades(pkg.trades)` and `setCoachingHistory(pkg.coachingHistory)` to update React state (and localStorage via the sync effects), but never writes to Supabase. For an authenticated user, the next `fetchFromSupabase` call (triggered on any user/hydration change) will overwrite the imported data with the old Supabase records. This causes silent data loss — the user sees the import succeed, but the data disappears on refresh.

**Fix:**
```typescript
const importData = useCallback(async (pkg: ExportPackage) => {
  setTrades(pkg.trades ?? [])
  setCoachingHistory(pkg.coachingHistory ?? [])
  if (pkg.strategyText !== undefined) setStrategyText(pkg.strategyText)
  if (!user) return
  // Bulk-upsert to Supabase
  const tradeRows = (pkg.trades ?? []).map(t => tradeToRow(t, user.id))
  if (tradeRows.length > 0) {
    const { error } = await supabase.from("trades").upsert(tradeRows, { onConflict: "id" })
    if (error) showToast("Import saved locally but failed to sync — please try again")
  }
}, [user, supabase, showToast])
```
Note: coaching history import to Supabase should be handled similarly; the coaching entries table would also need an upsert.

---

## Warnings

### WR-01: `contracts` field is not validated before submission — `NaN` silently stored

**File:** `app/components/TradeForm.tsx:76`
**Issue:** `pnl` and `rmult` are validated with `isNaN()` checks and surface errors (lines 68-69). However `contracts` on line 76 calls `Number(form.contracts)` with no validation. If the user clears the field or enters a non-numeric value, `contracts` is stored as `NaN` in the trade record. `NaN` serializes to `null` in JSON, so `localStorage.getItem` round-trips it back as `null` — the trade silently has `contracts: null` after a reload, breaking any display or computation that uses it.

**Fix:**
```typescript
const contractsNum = Number(form.contracts)
if (!form.contracts || isNaN(contractsNum) || contractsNum <= 0) {
  setContractsError("Enter a valid number of contracts")
  return
}
// then: contracts: contractsNum
```

---

### WR-02: `parseWatchlistIntent` ticker regex matches single-letter words not in the STOP list — corrupts watchlist with junk tickers

**File:** `app/components/tabs/Coach.tsx:41`
**Issue:** The regex `/\b[A-Z]{1,6}(?:=F)?\b/g` on line 41 captures 1-6 uppercase letter sequences. The STOP set filters `["I", "A", "MY", "ADD", ...]` but omits many common short English words that appear uppercase in normal messages: `"US"`, `"UK"`, `"NY"`, `"AM"`, `"PM"`, `"FX"`, `"IF"`, `"OR"`, `"DO"`. A message like "add NQ to my list for NY AM trading" would add both `NQ` and `NY` to the watchlist. More critically, the regex fires on ANY message that contains a word matching `\b(add|track|watch|monitor)\b`, so a casual message like "watch how NQ reacts" would attempt to add both `NQ` and `HOW` (if HOW isn't in STOP list) to the watchlist.

**Fix:** Increase minimum ticker length to 2 characters and expand the STOP set, or require an explicit command prefix (e.g., `/watch TICKER`) rather than scanning all messages for intent.

```typescript
// Require at least 2 uppercase letters, expand stop words
const STOP = new Set([
  "I", "A", "MY", "ADD", "THE", "TO", "FROM", "AND", "IN", "ON",
  "FOR", "IS", "IT", "AT", "ME", "WATCH", "TRACK", "US", "UK",
  "NY", "AM", "PM", "FX", "OR", "DO", "IF", "BE", "NO", "SO",
])
const tickers = (text.match(/\b[A-Z]{2,6}(?:=F)?\b/g) ?? []).filter(t => !STOP.has(t))
```

---

### WR-03: `--font-sans` CSS variable is self-referential — resolves to `undefined` at runtime

**File:** `app/globals.css:99`
**Issue:** Line 99 defines `--font-sans: var(--font-sans)`. This is a circular reference. The CSS custom property `--font-sans` is used to define itself; at runtime browsers treat this as an invalid value and the variable resolves to the initial (empty) value. `layout.tsx` sets the `--font-sans` variable via `geist.variable` class on the `<html>` element, but `globals.css` then re-declares it as self-referential inside the same `:root` block. Any component using `var(--font-sans)` through the globals path gets an empty string, falling back to the system font. The `font-family: var(--font-inter)` on line 147 protects the body, but any Tailwind class that resolves through `--font-sans` (e.g., `font-sans`) will render in the browser's default sans-serif instead of Geist.

**Fix:**
```css
/* In globals.css :root block, remove the self-referential line entirely.
   The --font-sans value is injected by Next.js font system via layout.tsx class. */
/* DELETE: --font-sans: var(--font-sans); */
--font-heading: var(--font-sans);  /* this line is safe — references the injected value */
```

---

### WR-04: `TabErrorBoundary` retry does not re-initialize child state — error may immediately re-throw

**File:** `app/components/TabErrorBoundary.tsx:34`
**Issue:** The retry button calls `this.setState({ hasError: false, error: null })` which unmounts the fallback and re-renders `this.props.children`. If the error was caused by corrupt state in a context provider or a persistent bad value in props, the child will throw again immediately on the next render, creating an infinite error/retry loop visible to the user. There is no back-off, no error count limit, and no escalation path.

**Fix:** Track retry count and cap it; after 3 failures render a persistent error message with a hard reload option:
```typescript
interface State {
  hasError: boolean
  error: Error | null
  retryCount: number
}

// In render():
if (this.state.hasError) {
  if (this.state.retryCount >= 3) {
    return <TabErrorFallback tabName={this.props.tabName} onRetry={null} />
    // Show "Reload app" button pointing to window.location.reload()
  }
  return (
    <TabErrorFallback
      tabName={this.props.tabName}
      onRetry={() => this.setState(s => ({ hasError: false, error: null, retryCount: s.retryCount + 1 }))}
    />
  )
}
```

---

### WR-05: `getFilteredCurve` equity data loses intraday trade detail — multiple same-day trades produce single final-value point, masking intraday drawdown

**File:** `app/components/tabs/Stats.tsx:40-49`
**Issue:** The function accumulates `cum += t.pnl` for each trade and writes `byDate[t.date] = cum` — overwriting the entry for that date with each subsequent trade. Only the final cumulative value for each date is stored in `byDate`. This means if a trader has 3 trades on Monday (+500, -800, +200), the equity curve shows only +(-100) for Monday, hiding the -300 intraday drawdown point that may represent the actual worst point. The `computeStats` function on line 70 correctly maps one equity point per trade (preserving intraday shape) but `getFilteredCurve` (used for the interactive chart) silently compresses this. The two paths are inconsistent.

**Fix:**
```typescript
// Replace the byDate overwrite with per-trade points:
return filtered.map((t, i) => {
  cum += t.pnl
  return { date: t.date.slice(5) + (filtered.filter((x, j) => j < i && x.date === t.date).length > 0 ? `*` : ""), pnl: cum }
})
// Or simpler: just emit one point per trade, same as computeStats does:
return filtered.map(t => { cum += t.pnl; return { date: t.date.slice(5), pnl: cum } })
```

---

## Info

### IN-01: `Geist` font loaded but not declared as the body font — Inter takes precedence, Geist is unused

**File:** `app/layout.tsx:9`
**Issue:** `Geist` is imported and assigned `variable: "--font-sans"`, but `globals.css` line 147 sets `font-family: var(--font-inter)` on `body`. The Tailwind `font-sans` utility resolves to the (self-referential) `--font-sans` variable and falls back to system sans-serif. Geist is loaded (network cost) but never rendered. This is either dead code or an incomplete migration from Inter to Geist.

**Fix:** Either remove the Geist import and its variable from the `<html>` className, or complete the migration by updating `globals.css` body `font-family` to `var(--font-sans)` (after fixing WR-03).

---

### IN-02: `TAB_COMPONENTS` record in `page.tsx` is missing the `stats` sub-view — TypeScript would flag this if `TabId` included `"stats"`

**File:** `app/page.tsx:67-72`
**Issue:** `TAB_COMPONENTS` maps `TabId` values to components. `StatsTab` is rendered conditionally inside the `log` branch rather than registered in this map. This is intentional (Stats is a sub-view of the Journal tab), but it means the `Record<TabId, React.ComponentType>` type annotation on line 67 does not cover `stats` (which is not in `TabId`). The structure is correct, but if `TabId` is ever expanded to include `"stats"`, this map would silently be missing an entry and fall through to `ActiveComponent` being `undefined`, causing a runtime crash. Low risk currently, flagged for awareness.

**Fix:** Add a comment clarifying that Stats is intentionally a sub-view rendered inline under `log`, not a top-level tab entry.

---

### IN-03: `onFileChange` in `DataManager` resets `e.target.value` inside the async `reader.onload` callback — the event target may have been recycled

**File:** `app/components/tabs/Stats.tsx:352`
**Issue:** `e.target.value = ""` on line 352 resets the file input. This works in practice because the assignment is inside `reader.onload` which executes synchronously after the `FileReader` resolves. However the `e` variable is a `React.ChangeEvent` — React uses event pooling in older versions and modern React nullifies synthetic events after the handler returns. The event reference `e` is captured in a closure passed to `reader.onload`, which executes asynchronously. In React 17+ this no longer pools, but the pattern is fragile. Use a ref to the input element instead.

**Fix:**
```typescript
// Use the fileRef that already exists in this component:
reader.onload = (ev) => {
  try { /* ... */ } catch { /* ... */ }
  if (fileRef.current) fileRef.current.value = ""  // safe ref, not stale event
}
```

---

_Reviewed: 2026-05-08T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
