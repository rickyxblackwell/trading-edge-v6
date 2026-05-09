# TRADING EDGE V6

**App:** Prop futures trading journal + AI coaching — primarily CME Group futures (ES, NQ, MES, MNQ, YM, MYM), adaptable to other instruments  
**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS v4  
**Workflow:** GSD — run `/gsd-map-codebase` when resuming after a break  
**Primary target:** iPhone 17 Pro (393×852pt) · iOS Safari PWA · Desktop secondary  
**V5 backup:** `../Trading App Full-Stack V5` — do not modify

---

## Current Build State

**Complete and working:**
- 5-tab shell (Strategy · Checklist · Journal · Stats · Coach) with sidebar nav (desktop) / bottom bar (mobile)
- Trade entry modal (FAB button, full schema)
- **Stats:** 12 KPIs, equity curve with 5d/30d/3m/6m/1y/all filters, confluence performance bars, P&L by day of week
- **Journal:** collapsible trade cards, expand for full detail, delete
- **Coach:** Gemini 2.5-flash, 4 modes (Analyze · Market Pulse · Strategy Review · Chat), session history feed with AI-generated titles, collapsible cards, archive system, rolling pattern memory
- **Strategy tab:** TF ladder (1D→1M), 10 confluences (C1-C10), kill switches, liquidity targeting, session timing
- TypeScript compiles clean (`npx tsc --noEmit`)

**Next (use GSD to plan):** Supabase persistence, real iPhone testing, auth flow

---

## App Architecture

```
app/
├── page.tsx                    # 5-tab shell, FAB button
├── globals.css                 # Design tokens, glass recipe, ambient orbs
├── layout.tsx                  # Root layout, Inter + IBM Plex Mono fonts
├── lib/
│   ├── types.ts                # Trade, CoachingEntry, ChatMessage, TabId
│   └── TradesContext.tsx       # Global state: trades, coaching, apiKey, patternSummary
├── api/coach/route.ts          # Gemini API, rate limiting, 4 modes, Google Search grounding
└── components/tabs/
    ├── Strategy.tsx · Checklist.tsx · Log.tsx · Stats.tsx · Coach.tsx
```

**Trade schema:**
```typescript
interface Trade {
  id: string; date: string; time: string; instrument: string
  direction: "long" | "short"; session: string; contracts: number
  pnl: number; rmult: number; outcome: "win" | "loss" | "breakeven"
  confluences: string[]; notes: string
}
```

**localStorage keys** (prefix `edge_v5_` — matches V5 data, do not rename without migration):  
`edge_v5_trades` · `edge_v5_coaching_history` · `edge_v5_apikey` · `edge_v5_pattern_summary` · `edge_v5_strategy_text`

---

## AI Coach — Key Details

- **Model:** `gemini-2.5-flash` via `@google/genai`
- **Modes:** `analyze` · `market-pulse` · `strategy-review` · `chat`
- **Google Search grounding:** enabled for `market-pulse` and `strategy-review` only
- **Rate limit:** 15 seconds per session (server-side `lastCallTime` Map in `app/api/coach/route.ts`)
- **Pattern memory:** after each `analyze` run, Gemini returns `PATTERN SUMMARY UPDATE:` stored in `edge_v5_pattern_summary`, fed into future prompts
- **Session titles:** Gemini returns `TITLE: <text>` at end; extracted via regex, stripped from display
- **History:** max 60 entries, archived entries hidden but preserved

---

## Design System — Midnight Market

```css
:root {
  --bg: #060b14;  --bg2: #0a1220;  --bg3: #0f1a2e;
  --glass: rgba(255,255,255,0.06);  --glass-md: rgba(255,255,255,0.10);
  --border: rgba(255,255,255,0.08);  --border-accent: rgba(56,189,248,0.25);
  --accent: #38bdf8;  --accent2: #7c3aed;  --accent3: rgba(56,189,248,0.08);
  --green: #00e5a0;  --red: #ff3d5a;  --yellow: #ffd060;  --purple: #a855f7;
  --text: #dde2f0;  --text2: #7a87a8;  --text3: rgba(255,255,255,0.25);
}
```

**Glass recipe:** `backdrop-filter: blur(12px)` + tint (`--glass` or `--glass-md`) + `1px solid var(--border)` rim  
**Fonts:** Inter (UI/labels) · IBM Plex Mono (ALL numeric/data values — no exceptions)  
**Animations:** `0.2s ease` on targeted properties only (no `transition: all`) · respect `prefers-reduced-motion`  
**Mobile:** `100dvh` · `env(safe-area-inset-*)` · 44px minimum tap targets · no horizontal overflow

---

## Development Rules

- **No hardcoded colors** — CSS custom properties only
- **IBM Plex Mono on every number** — P&L, R-mult, percentages, timestamps
- **No `transition: all`** — targeted properties only
- **Server components by default** — `"use client"` only when required
- **TypeScript strict** — `npx tsc --noEmit` must pass before any phase is marked complete
- **Glass over interesting background** — ambient orbs must remain visible through panels
- **Empty states** — every list/feed needs copy when empty
- **No comments** unless the WHY is non-obvious (hidden constraint, bug workaround, subtle invariant)

---

## Workflow — GSD

All feature work follows the GSD phase loop:

```
/gsd-discuss-phase N  →  /gsd-plan-phase N  →  /gsd-execute-phase N
→  /gsd-verify-work N  →  /gsd-ship N
```

**Key commands:**
- `/gsd-ui-phase` — generate UI-SPEC.md before any visual changes
- `/gsd-quick [task]` — ad-hoc tasks with GSD guarantees
- `/gsd-map-codebase` — re-index before resuming after a break
- `/gsd-ui-review` — 6-pillar visual audit after UI changes
- `/gsd-add-tests` — generate tests after a completed phase
- `/gsd-code-review` — code quality review on changed files
- `/gsd-secure-phase` — security audit before shipping API/auth changes

**GSD handles all research, QA, review, and security — no custom agents needed.**

---

## Installed Plugins

| Plugin | When to use |
|--------|-------------|
| `frontend-design` | Auto-activates on UI work — distinctive components, no generic AI aesthetics |
| `feature-dev` | `/feature-dev` for structured 7-phase feature builds alongside GSD |
| `code-modernization` | `/modernize-brief` when refactoring or migrating legacy sections |
| `mcp-server-dev` | `/build-mcp-server` for new MCP integrations (e.g. TradingView MCP) |
| `agent-sdk-dev` | `/new-sdk-app` for Claude Agent SDK apps (custom coaching agents) |
| `skill-creator` | When creating new project-specific skills |
| `security-guidance` | Before shipping any API routes, auth, or data-handling changes |
| `github` | PR creation, issue management, CI status via `gh` CLI |

---

## MCPs Connected

| MCP | Purpose | Usage rule |
|-----|---------|------------|
| `chrome-devtools` | Single screenshots on explicit request | One call at a time — never loop across tabs automatically |
| `shadcn` | Component search and installation | Before building any new UI component |
| `magic` (21st.dev) | Premium animated component generation | For high-polish interactive components |
| `firecrawl` | Web scraping, reference site research | Preferred over chrome-devtools for multi-URL research |

---

## Anti-Template Rules

1. No `box-shadow: 0 4px 8px rgba(0,0,0,0.2)` — depth via borders, glow, layered backgrounds
2. No hardcoded hex values — all CSS custom properties
3. IBM Plex Mono on every numeric value — no mixing with Inter on numbers
4. Glass must sit over visible ambient orbs — never a flat background
5. No Bootstrap/Material/Radix default styling — override everything
6. Typography: minimum 2 distinct font roles with tuned letter-spacing
7. Data density = premium — no wasted space, no filler
