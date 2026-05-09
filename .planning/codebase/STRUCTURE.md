---
title: STRUCTURE.md
focus: arch
generated: 2026-05-05
---

# Directory Structure

```
Trading App Full-Stack V6/
├── app/                              # Next.js App Router root
│   ├── layout.tsx                    # Root layout — Inter + IBM Plex Mono fonts, TradesProvider, metadata
│   ├── page.tsx                      # App shell — 5-tab nav, FAB, tab routing, TradeModal mount
│   ├── globals.css                   # All design tokens, glass recipe, ambient orbs, utility classes
│   ├── api/
│   │   └── coach/
│   │       └── route.ts              # Gemini 2.5-flash proxy, rate limiting, 4 modes
│   ├── lib/
│   │   ├── types.ts                  # Trade, CoachingEntry, ChatMessage, TabId
│   │   └── TradesContext.tsx         # Global state — trades, coaching, apiKey, patternSummary
│   └── components/
│       ├── TradeModal.tsx            # FAB-triggered trade entry form
│       └── tabs/
│           ├── Strategy.tsx          # TF ladder, 10 confluences, kill switches, session timing
│           ├── Checklist.tsx         # Pre-trade checklist
│           ├── Log.tsx               # Trade journal — collapsible cards, delete
│           ├── Stats.tsx             # 12 KPIs, equity curve, confluence bars, P&L by day
│           └── Coach.tsx             # Chat UI, history feed, mode chips, HistoryCard
├── components/
│   └── ui/
│       └── button.tsx                # shadcn scaffold (present, not actively used by tabs)
├── lib/
│   └── utils.ts                      # shadcn scaffold (cn() utility — present, not actively used)
├── public/                           # Static assets
├── src/                              # Empty / scaffold
├── CLAUDE.md                         # Project rules, design system, workflow instructions
├── components.json                   # shadcn config
├── next.config.ts                    # Next.js config
├── package.json                      # Dependencies
├── postcss.config.mjs                # PostCSS + Tailwind config
├── tailwind.config.ts                # (if present — v4 uses CSS-based config)
└── tsconfig.json                     # TypeScript strict config
```

## Entry Points

- **App shell:** `app/page.tsx` — single `<App>` component, owns tab state and modal state
- **Fonts/providers:** `app/layout.tsx` — wraps everything in `TradesProvider`, loads Google Fonts
- **API:** `app/api/coach/route.ts` — only server-side endpoint

## Key Abstractions

| File | Role |
|------|------|
| `app/lib/types.ts` | Single source of truth for all data shapes |
| `app/lib/TradesContext.tsx` | All global state + localStorage persistence |
| `app/globals.css` | All design tokens + layout primitives |
| `app/api/coach/route.ts` | All AI logic — strategy prompt, Gemini calls, response parsing |

## Absent Infrastructure

- No `__tests__/` directory — no test suite
- No `middleware.ts` — no auth middleware yet
- No `app/(auth)/` route group — no authentication flow
- No Supabase client files — persistence is localStorage-only
