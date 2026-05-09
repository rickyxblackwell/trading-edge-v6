---
title: ARCHITECTURE.md
focus: arch
generated: 2026-05-05
---

# Architecture

## Overview

Single-page Next.js 15 App Router application. Almost entirely client-side — only one server component (`layout.tsx`) and one API route (`/api/coach`). The UI is a 5-tab shell rendered by a single client component (`page.tsx`) that mounts the active tab component.

## Layer Breakdown

```
Browser
  └── app/layout.tsx          (Server Component — root layout, fonts, TradesProvider)
        └── app/page.tsx      (Client Component — tab shell, FAB, TradeModal)
              ├── Strategy.tsx
              ├── Checklist.tsx
              ├── Log.tsx
              ├── Stats.tsx
              └── Coach.tsx

Server
  └── app/api/coach/route.ts  (Next.js Route Handler — Gemini proxy, rate limit)
```

## State Management

`TradesContext` (React Context + localStorage write-through):
- Initialized from `localStorage` on mount via a `hydrated` flag pattern — prevents SSR mismatch
- All mutations (`addTrade`, `deleteTrade`, `addCoachingEntry`, etc.) call `useCallback` setters
- Side-effects sync state back to localStorage via `useEffect` watching each slice
- No Zustand, Redux, or external state library — intentionally minimal

**localStorage keys (prefix `edge_v5_`):**
| Key | Type | Purpose |
|-----|------|---------|
| `edge_v5_trades` | `Trade[]` | All logged trades |
| `edge_v5_coaching_history` | `CoachingEntry[]` | Coaching session log (capped at 60, persisted as 30) |
| `edge_v5_apikey` | `string` | Gemini API key |
| `edge_v5_pattern_summary` | `string` | Rolling 200-word AI pattern memory |
| `edge_v5_strategy_text` | `string` | User's personal strategy notes (free text) |

## API Route — `/api/coach`

POST handler acting as a Gemini proxy:
- Accepts `{ message, mode, trades, history, patternSummary, strategyText, apiKey, sessionId }`
- In-memory `Map<string, number>` rate-limits per `sessionId` (15s window) — does NOT survive serverless restarts
- Builds a multi-turn conversation context (system → model ACK → user prompt)
- Injects full trading strategy as system context on every call
- Google Search grounding enabled only for `market-pulse` and `strategy-review` modes
- Returns `{ reply, coaching?, newPatternSummary?, sessionTitle? }`
- Extracts `TITLE:` and `PATTERN SUMMARY UPDATE:` markers from raw Gemini response via regex

## Data Flow — Trade Lifecycle

```
User taps FAB
  → TradeModal (local form state)
  → onClose with Trade object
  → addTrade(trade) in TradesContext
  → React state update
  → useEffect writes to localStorage
  → Stats/Log components re-render via useTrades()
```

## Data Flow — Coach Lifecycle

```
User taps mode chip + sends message
  → Coach.tsx builds request body (trades from context, history, patternSummary)
  → fetch POST /api/coach
  → route.ts proxies to Gemini
  → response returned with reply + optional sessionTitle + newPatternSummary
  → addCoachingEntry() stores to context
  → updatePatternSummary() updates rolling memory
  → HistoryCard renders in feed
```

## Component Model

All tab components are `"use client"`. No RSC rendering for tab content — this is appropriate for a data-heavy interactive app.

`components/ui/button.tsx` and `lib/utils.ts` are shadcn scaffold files — present but not actively used by tab components.
