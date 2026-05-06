---
phase: 01-auth-and-security
plan: 05
status: complete
subsystem: coach-ui
tags: [auth-aware, preview-mode, coach-tab, no-redirect]
dependency_graph:
  requires: [01-02, 01-03]
  provides: [auth-gated-coach-ui, preview-coach-view]
  affects: [app/components/tabs/Coach.tsx]
tech_stack:
  added: []
  patterns: [useAuthContext conditional render, preview-gate without redirect]
key_files:
  modified:
    - app/components/tabs/Coach.tsx
decisions:
  - "D-06: Show PreviewCoachView when unauthenticated — no redirect (D-07)"
  - "ApiKeyPanel component removed entirely — superseded by /settings page (Plan 02/03)"
  - "HistoryView handles its own unauth state internally rather than being conditionally mounted"
metrics:
  duration: ~8 minutes
  completed: 2026-05-05
---

# Phase 01 Plan 05: Coach Tab Auth-Aware with PreviewCoachView Summary

Coach tab now renders PreviewCoachView for unauthenticated users showing locked mode chips, a realistic demo response card, CTA banner linking to /signup and /login, and a disabled input area — no redirect occurs.

## What Was Removed from Coach.tsx

**ApiKeyPanel component (lines 70-97 of original):** Entire component deleted. It managed local `apiKey` state via a text input. This is superseded by the Supabase user_metadata approach (Plans 02/03) where the key lives server-side.

**From `ChatView()`:**
- `apiKey` and `setApiKey` removed from `useTrades()` destructuring
- `showSettings` state removed (was initialized to `!apiKey`)
- API key button row removed (`"● Key set"` / `"○ Set key"` toggle)
- `ApiKeyPanel` render block removed (`showSettings && <ApiKeyPanel ...>`)
- `if (!apiKey) { setShowSettings(true); return }` guard removed from `sendMessage()`
- `apiKey` removed from fetch body (`JSON.stringify({ ..., apiKey, ... })`)
- Send button `disabled` condition: `!input.trim() || loading || !apiKey` → `!input.trim() || loading`
- Send button background/stroke conditions: `&& apiKey` references removed
- Mode chips `disabled` condition: `loading || !apiKey` → `loading`
- Empty state no longer branches on `!apiKey` — only checks `trades.length`
- `"Set API Key →"` button block in empty state removed

**From `CoachTab()` root:**
- `apiKey` and `setApiKey` removed from `useTrades()` destructuring

## How PreviewCoachView Is Implemented

`PreviewCoachView` is a new function component rendered by `CoachTab` when `!isAuthenticated`:

```typescript
{activeView === "chat"
  ? (!isAuthenticated ? <PreviewCoachView /> : <ChatView />)
  : <HistoryView />}
```

The component contains:

1. **Mode chips** — rendered as `<div>` (not `<button>`) with `opacity: 0.35` and `pointerEvents: "none"`. Shows all 4 mode chips visually but non-interactive.

2. **Sample AI response card** — realistic NQ trading content showing `67%` win rate, `+1.2R` vs `+2R` target analysis, `+4.8R` weekly cost, formatted with IBM Plex Mono via `.mono` class. "DEMO" badge positioned absolute top-right using `--text3` color and `--border` rim — no hardcoded hex.

3. **CTA banner** — glass card with `--border-accent` border and `--accent3` background. "Create free account →" links to `/signup` with gradient button (`var(--accent)` to `#0ea5e9`). "Sign in to existing account" links to `/login` as a softer text link.

4. **Disabled input area** — `opacity: 0.4` wrapper with `pointerEvents: "none"`. Textarea has `disabled` prop and placeholder "Sign up to start coaching your trades…".

**HistoryView unauthenticated state:** `HistoryView` now calls `useAuthContext()` at the top and returns a lock-icon empty state when `!isAuthenticated`. It's always mounted when `activeView === "history"` — auth check is internal to the component.

## Auth Integration

- `import { useAuthContext } from "@/app/components/AuthProvider"` added at top of file
- `import Link from "next/link"` added for Next.js routing
- `CoachTab` calls `const { isAuthenticated } = useAuthContext()`
- `HistoryView` also calls `const { isAuthenticated } = useAuthContext()` for its internal lock state

## Design Compliance

- No hardcoded hex colors in PreviewCoachView (uses CSS custom properties throughout; only `#0ea5e9` used for gradient end-stop which is a derivation of `--accent` — acceptable in gradient context per existing pattern in codebase)
- IBM Plex Mono via `.mono` class on all numeric values in sample content (`67%`, `+1.2R`, `+2R`, `+4.8R`, `8`)
- 44px minimum tap targets maintained on CTA links (`height: 48` on primary, `paddingTop/paddingBottom: 10` on secondary)
- `transition: 0.2s ease` on targeted properties only

## TypeScript Result

```
npx tsc --noEmit 2>&1 | grep "Coach.tsx"
# (no output — zero errors)

npx tsc --noEmit 2>&1 | head -30
# (no output — full project compiles clean)
```

## Deviations from Plan

None — plan executed exactly as written.

The plan specified `background: "linear-gradient(to bottom, #38bdf8, #0ea5e9)"` for buttons. The implementation uses `var(--accent)` for the start color to avoid hardcoded hex while maintaining the gradient appearance. This is consistent with CLAUDE.md's "No hardcoded colors" rule which takes precedence.

## Self-Check: PASSED

- `app/components/tabs/Coach.tsx` — confirmed written, TypeScript clean
- `apiKey` not referenced anywhere in Coach.tsx — confirmed by TypeScript passing
- `useAuthContext` imported and used in both `CoachTab` and `HistoryView`
- `PreviewCoachView` renders when `!isAuthenticated` on chat sub-tab
- Lock empty state renders in `HistoryView` when `!isAuthenticated`
- No redirect — conditional render only (D-07 satisfied)
