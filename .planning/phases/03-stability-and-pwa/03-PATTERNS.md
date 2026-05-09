# Phase 3: Stability & PWA - Pattern Map

**Mapped:** 2026-05-07
**Files analyzed:** 9 (7 modified + 2 new)
**Analogs found:** 8 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `app/lib/TradesContext.tsx` | provider | CRUD + event-driven | self (single-line fix) | exact |
| `app/components/TradeForm.tsx` | component | request-response | self (multi-point fix) | exact |
| `app/components/tabs/Coach.tsx` | component | request-response | self (multi-point fix) | exact |
| `app/components/tabs/Stats.tsx` | component | transform | self (single-line fix) | exact |
| `app/components/TabErrorBoundary.tsx` | component | request-response | `app/components/Toast.tsx` | partial (UI fallback pattern) |
| `app/page.tsx` | component | request-response | self (wrapping pattern) | exact |
| `app/manifest.ts` | config | request-response | `app/layout.tsx` (metadata export) | role-match |
| `app/layout.tsx` | config | request-response | self (metadata addition) | exact |
| `public/icons/` | static asset | — | none | no analog |

---

## Pattern Assignments

### `app/lib/TradesContext.tsx` — STABLE-02 (provider, CRUD)

**Change:** Line 191 — `slice(-30)` → `slice(-60)` in the localStorage coaching persistence `useEffect`.

**Analog:** Self. The in-memory setter at line 271 already uses `slice(-60)` — copy that exact pattern.

**Bug location** (lines 189-192):
```typescript
// Persist coaching to localStorage (cap at 30 — known bug, fixed in Phase 3 STABLE-02; preserve current behavior here)
useEffect(() => {
  if (hydrated) localStorage.setItem(COACHING_KEY, JSON.stringify(coachingHistory.slice(-30)))
}, [coachingHistory, hydrated])
```

**Fixed form — copy from line 271's pattern**:
```typescript
useEffect(() => {
  if (hydrated) localStorage.setItem(COACHING_KEY, JSON.stringify(coachingHistory.slice(-60)))
}, [coachingHistory, hydrated])
```

**Surrounding persist pattern** (lines 184-207) — all other `useEffect` persist blocks follow this identical shape; use it to verify the fix is consistent:
```typescript
useEffect(() => {
  if (hydrated) localStorage.setItem(TRADES_KEY, JSON.stringify(trades))
}, [trades, hydrated])
```

---

### `app/components/TradeForm.tsx` — STABLE-03 + STABLE-04 (component, request-response)

**Analog:** Self. Two independent changes.

**STABLE-03 — UUID migration** (lines 6-7):
```typescript
// Current (replace):
export function genId() { return Math.random().toString(36).slice(2, 9) }

// Fixed:
export function genId() { return crypto.randomUUID() }
```
`genId()` is called at line 65 inside `submit()`. No other changes needed in this file for STABLE-03.

**STABLE-04 — NaN validation** — current submit handler (lines 62-78):
```typescript
const submit = (e: React.FormEvent) => {
  e.preventDefault()
  onSubmit({
    id: genId(),
    date: form.date, time: form.time,
    instrument: form.instrument,
    direction: form.direction,
    session: form.session,
    contracts: Number(form.contracts),
    pnl: Number(form.pnl),
    rmult: Number(form.rmult),
    outcome: form.outcome,
    confluences: form.confluences,
    notes: form.notes,
  })
  setForm(makeEmpty())
}
```

**Fixed submit handler** — add `pnlError`/`rmultError` state and guards before `onSubmit`:
```typescript
// Add state (alongside existing `const [form, setForm] = useState(makeEmpty)`):
const [pnlError, setPnlError] = useState<string | null>(null)
const [rmultError, setRmultError] = useState<string | null>(null)

const submit = (e: React.FormEvent) => {
  e.preventDefault()
  const pnlNum = Number(form.pnl)
  const rmultNum = Number(form.rmult)
  if (isNaN(pnlNum)) { setPnlError("Enter a valid number"); return }
  if (isNaN(rmultNum)) { setRmultError("Enter a valid number"); return }
  onSubmit({
    id: genId(),
    date: form.date, time: form.time,
    instrument: form.instrument,
    direction: form.direction,
    session: form.session,
    contracts: Number(form.contracts),
    pnl: pnlNum,
    rmult: rmultNum,
    outcome: form.outcome,
    confluences: form.confluences,
    notes: form.notes,
  })
  setForm(makeEmpty())
}
```

**Error display pattern** — inline below affected field, consistent with Midnight Market design tokens. Copy the `Field` wrapper pattern (lines 42-44) and add the error paragraph beneath the input:
```tsx
<Field label="P&L ($)">
  <input
    type="text" inputMode="decimal" placeholder="±0.00"
    value={form.pnl}
    onChange={e => { set("pnl", e.target.value); setPnlError(null) }}
    className={inputCls} style={inputStyle} required
  />
  {pnlError && (
    <p className="mono text-xs mt-1" style={{ color: "var(--red)" }}>{pnlError}</p>
  )}
</Field>
```

---

### `app/components/tabs/Coach.tsx` — STABLE-03 (component, request-response)

**Analog:** Self. Two locations — `genId()` function and `genSessionId()` function.

**STABLE-03 — genId** (lines 45-47):
```typescript
// Current (replace):
function genId() {
  return Math.random().toString(36).slice(2, 9)
}

// Fixed:
function genId() {
  return crypto.randomUUID()
}
```

**STABLE-03 — genSessionId** (lines 49-54) — also replace for consistency:
```typescript
// Current (replace Math.random inside):
function genSessionId() {
  if (typeof window === "undefined") return "ssr"
  let sid = sessionStorage.getItem("edge_session_id")
  if (!sid) { sid = Math.random().toString(36).slice(2); sessionStorage.setItem("edge_session_id", sid) }
  return sid
}

// Fixed:
function genSessionId() {
  if (typeof window === "undefined") return "ssr"
  let sid = sessionStorage.getItem("edge_session_id")
  if (!sid) { sid = crypto.randomUUID(); sessionStorage.setItem("edge_session_id", sid) }
  return sid
}
```

`genId()` is consumed at lines 452, 521, 590, 626 — no changes required at those call sites.

---

### `app/components/tabs/Stats.tsx` — STABLE-03 (component, transform)

**Analog:** Self. Single-line fix at line 281.

**Current** (line 281):
```typescript
id: String(t.id ?? Math.random().toString(36).slice(2, 9)),
```

**Fixed:**
```typescript
id: String(t.id ?? crypto.randomUUID()),
```

No import needed — `crypto` is a global in both browser (Safari 15.4+) and Node.js 19+.

---

### `app/components/TabErrorBoundary.tsx` — STABLE-01 (NEW component, request-response)

**Analog:** `app/components/Toast.tsx` for the fallback UI pattern (CSS custom properties, Midnight Market tokens, no hardcoded colors). No existing ErrorBoundary exists in the codebase — this is the first class component.

**Toast.tsx import pattern** (lines 1-3) — copy `"use client"` directive and named export approach:
```typescript
"use client"

import { AlertTriangle } from "lucide-react"
```

**Toast.tsx inline style pattern** (lines 14-43) — CSS custom properties only, no hardcoded hex:
```typescript
style={{
  background: "var(--bg3)",
  backdropFilter: "blur(12px)",
  border: "1px solid var(--red)",
  // ...
}}
```

**Full new file pattern** — no analog for the class-component structure; use RESEARCH.md pattern verbatim:
```typescript
"use client"

import { Component, type ReactNode } from "react"

interface Props {
  children: ReactNode
  tabName: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class TabErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error(`[TabErrorBoundary:${this.props.tabName}]`, error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <TabErrorFallback
          tabName={this.props.tabName}
          onRetry={() => this.setState({ hasError: false, error: null })}
        />
      )
    }
    return this.props.children
  }
}

function TabErrorFallback({ tabName, onRetry }: { tabName: string; onRetry: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 py-16 px-6"
      style={{ color: "var(--text2)" }}
    >
      <p className="mono text-sm" style={{ color: "var(--text2)" }}>
        {tabName} tab encountered an error
      </p>
      <button
        onClick={onRetry}
        className="mono text-xs px-4 py-2 rounded-lg"
        style={{
          minHeight: 44,
          border: "1px solid var(--border-accent)",
          color: "var(--accent)",
          background: "var(--accent3)",
          transition: "background 0.2s ease",
        }}
      >
        Retry
      </button>
    </div>
  )
}
```

**Key constraints from CLAUDE.md:**
- `"use client"` is required — class components with lifecycle methods cannot run on the server
- `minHeight: 44` on Retry button — 44px minimum tap target rule
- `transition: "background 0.2s ease"` not `transition: all` — targeted properties only
- No hardcoded hex — all `var(--*)` tokens

---

### `app/page.tsx` — STABLE-01 placement (component, request-response)

**Analog:** Self. Import and wrap each tab render site.

**Import addition** — add after existing component imports (lines 7-18):
```typescript
import { TabErrorBoundary } from "./components/TabErrorBoundary"
```

**Current tab render structure** (lines 198-248) — non-coach tabs rendered inside a single `<div>` with `key`:
```tsx
{(showAccount || activeTab !== "coach") && (
  <div className="content-wrap py-4 fade-up" key={showAccount ? "account" : activeTab}>
    {showAccount ? (
      <AccountTab />
    ) : activeTab === "log" ? (
      <>
        {/* toggle buttons */}
        {journalView === "log" ? <LogTab /> : <StatsTab />}
      </>
    ) : (
      <ActiveComponent />
    )}
  </div>
)}
```

**Fixed — wrap each tab individually, toggle buttons stay outside boundary:**
```tsx
{(showAccount || activeTab !== "coach") && (
  <div className="content-wrap py-4 fade-up" key={showAccount ? "account" : activeTab}>
    {showAccount ? (
      <TabErrorBoundary tabName="account"><AccountTab /></TabErrorBoundary>
    ) : activeTab === "log" ? (
      <>
        {/* toggle buttons remain outside boundary */}
        <div className="flex justify-center px-4 pb-4">
          {/* ... existing toggle ... */}
        </div>
        {journalView === "log"
          ? <TabErrorBoundary tabName="log"><LogTab /></TabErrorBoundary>
          : <TabErrorBoundary tabName="stats"><StatsTab /></TabErrorBoundary>}
      </>
    ) : (
      <TabErrorBoundary tabName={activeTab}><ActiveComponent /></TabErrorBoundary>
    )}
  </div>
)}
```

**Coach tab flex sibling** (lines 254-266) — wrap `<CoachTab />` inside the existing div:
```tsx
<div ref={coachContainerRef} style={{ /* existing styles */ }}>
  <TabErrorBoundary tabName="coach"><CoachTab /></TabErrorBoundary>
</div>
```

**Navigation shell, FAB button, TradeModal, ambient orbs** (lines 93-100, 268-312) — these must remain OUTSIDE all ErrorBoundary wrappers. They are already siblings/parents of the tab content, so no change required.

---

### `app/manifest.ts` — PWA-01 (NEW config, request-response)

**Analog:** `app/layout.tsx` — the `metadata` export pattern (lines 24-32) shows how Next.js App Router file conventions export typed metadata objects. `manifest.ts` follows the same file-convention pattern.

**layout.tsx metadata pattern** (lines 24-32):
```typescript
export const metadata: Metadata = {
  title: "TRADING EDGE",
  description: "Prop futures trading journal & AI coaching",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TRADING EDGE",
  },
}
```

**Full new file** — no dynamic content needed; function form required by Next.js file convention:
```typescript
import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Trading Edge",
    short_name: "Trading Edge",
    description: "Prop futures trading journal & AI coaching",
    start_url: "/",
    display: "standalone",
    background_color: "#060b14",
    theme_color: "#060b14",
    icons: [
      { src: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
```

**Note on hardcoded colors:** `background_color` and `theme_color` in manifest.ts are JSON string fields for the Web App Manifest spec — they cannot reference CSS variables. The value `#060b14` matches `--bg` from the design token sheet in CLAUDE.md. This is the only sanctioned exception to the no-hardcoded-hex rule in this codebase.

**Placement:** `app/manifest.ts` (not `public/manifest.json` — file convention required for TypeScript typing).

---

### `app/layout.tsx` — PWA-02 (config, request-response)

**Analog:** Self. Add `icons.apple` to the existing `metadata` export.

**Current metadata export** (lines 24-32):
```typescript
export const metadata: Metadata = {
  title: "TRADING EDGE",
  description: "Prop futures trading journal & AI coaching",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TRADING EDGE",
  },
}
```

**Fixed — add `icons.apple`:**
```typescript
export const metadata: Metadata = {
  title: "TRADING EDGE",
  description: "Prop futures trading journal & AI coaching",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TRADING EDGE",
  },
  icons: {
    apple: [
      { url: "/apple-icon-180x180.png", sizes: "180x180", type: "image/png" },
    ],
  },
}
```

The `Metadata` type is already imported from `"next"` at line 1. No new imports needed.

---

### `public/icons/` — PWA-01/02 (static assets)

**Analog:** None. No icon PNG files exist in `public/` currently.

**Required files:**
- `public/icon-192x192.png` — standard PWA icon (referenced by manifest.ts)
- `public/icon-512x512.png` — maskable PWA icon (referenced by manifest.ts)
- `public/apple-icon-180x180.png` — iOS home screen icon (referenced by layout.tsx `icons.apple`)

**Generation approach:** Use a favicon generator (realfavicongenerator.net) with a dark `#060b14` background and the "TE" monogram or chart SVG. Final art can be swapped in Phase 5 without code changes — the filenames are fixed and referenced by path.

---

## Shared Patterns

### CSS Custom Properties (no hardcoded colors)
**Source:** `app/components/Toast.tsx` lines 14-43 and `app/components/TradeForm.tsx` lines 22-23
**Apply to:** `TabErrorBoundary.tsx` fallback UI
```typescript
// All color values must use var(--*) tokens:
style={{ background: "var(--bg3)", border: "1px solid var(--border)", color: "var(--text2)" }}
// accent3 fill for interactive elements:
style={{ background: "var(--accent3)", border: "1px solid var(--border-accent)", color: "var(--accent)" }}
```

### Targeted Transition (no `transition: all`)
**Source:** `app/components/TradeForm.tsx` lines 110-117
**Apply to:** `TabErrorBoundary.tsx` Retry button, any new interactive element
```typescript
// Correct:
transition: "background 0.2s ease"
// Never:
transition: "all 0.2s ease"
```

### Inline Error Display
**Source:** `app/components/TradeForm.tsx` — existing `mono` class + `text-sm`/`text-xs` convention
**Apply to:** STABLE-04 NaN error messages beneath pnl/rmult fields
```tsx
<p className="mono text-xs mt-1" style={{ color: "var(--red)" }}>
  Enter a valid number
</p>
```

### "use client" Directive
**Source:** `app/lib/TradesContext.tsx` line 1, `app/components/AuthProvider.tsx` line 1
**Apply to:** `app/components/TabErrorBoundary.tsx`
```typescript
"use client"
// Must be first line — before any imports
```

### localStorage Persist useEffect Shape
**Source:** `app/lib/TradesContext.tsx` lines 184-207 (all five persist effects)
**Apply to:** STABLE-02 fix — confirms the corrected `slice(-60)` effect must match the shape of all other persist effects exactly
```typescript
useEffect(() => {
  if (hydrated) localStorage.setItem(KEY, JSON.stringify(value))
}, [value, hydrated])
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `app/components/TabErrorBoundary.tsx` | component | request-response | No class components exist in codebase — first ErrorBoundary; Toast.tsx provides fallback UI style reference only |
| `public/icons/` | static asset | — | No icon files exist in `public/`; cannot be code-generated |

---

## Metadata

**Analog search scope:** `app/components/`, `app/lib/`, `app/`, `app/components/tabs/`
**Files scanned:** 14 source files
**Pattern extraction date:** 2026-05-07
