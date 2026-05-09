# Trading Edge

A prop futures trading journal with an AI coach. Built primarily for CME equity index futures (ES, NQ, MES, MNQ, YM, MYM) but adaptable to other instruments.

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · Supabase · Anthropic Claude · Google Gemini

**Primary target:** iPhone 17 Pro (393×852pt) · iOS Safari PWA · Desktop secondary

---

## What it does

- **Log trades** — instrument, direction, session, P&L, R-multiple, confluences, notes — captured via a one-tap modal
- **See patterns** — 12 KPIs, equity curve with multi-range filters, confluence performance bars, P&L by day of week
- **Get coached** — Claude Sonnet is the primary AI; Gemini, Yahoo Finance, FRED, Polygon.io, and Alpha Vantage are tools Claude calls during an agentic loop. Five persistent memory layers (session index, behavior ledger, milestone log, weakness profile, streak tracking) personalize feedback over time
- **Stay disciplined** — daily soft (-$250) / hard (-$500) loss limits + profit-goal alerts that switch to running daily totals once thresholds are crossed
- **Use offline** — installable PWA with apple-touch icon, splash screen, and full safe-area handling

## Project structure

```
app/
├── page.tsx                    # 5-tab shell (Strategy · Checklist · Journal · Stats · Coach)
├── layout.tsx                  # Root layout, fonts, manifest, splash
├── globals.css                 # Midnight Market design tokens, glass recipe, ambient orbs
├── manifest.ts                 # PWA manifest
├── lib/
│   ├── types.ts                # Trade, CoachingEntry, ChatMessage, etc.
│   ├── TradesContext.tsx       # Global state + Supabase + localStorage cache
│   ├── genId.ts                # UUID v4 helper (works in non-secure HTTP contexts)
│   └── ...
├── api/coach/route.ts          # Claude agentic loop, multi-provider tool dispatch, rate caps
└── components/
    ├── tabs/                   # Strategy, Checklist, Log, Stats, Coach, Account
    ├── TradeForm.tsx           # Trade entry form
    ├── TradeModal.tsx          # Modal wrapper
    └── ...
public/                         # Icons, splash, favicons
scripts/                        # Icon build pipeline
supabase/migrations/            # Schema migrations (audit trail)
.planning/                      # GSD workflow artifacts (phase plans, research, validation)
```

## Local setup

### 1. Clone + install

```bash
git clone https://github.com/rickyxblackwell/trading-edge-v6.git
cd trading-edge-v6
npm install
```

### 2. Provision Supabase

Create a project at [supabase.com](https://supabase.com), then run the SQL migrations:

```bash
# Either via Supabase dashboard (SQL Editor → paste each migration in order):
ls supabase/migrations/

# Or via Supabase CLI if installed:
supabase link --project-ref <your-project-ref>
supabase db push
```

The migrations create the `trades` and `coaching_entries` tables with Row-Level Security so each authenticated user only sees their own data.

### 3. Configure environment

Copy this template into `.env.local` (gitignored — never commit values):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from Supabase project settings → API>
SUPABASE_SERVICE_ROLE_KEY=<server-only, from Supabase project settings → API>
FRED_API_KEY=<free key from https://fred.stlouisfed.org/docs/api/api_key.html>
```

`NEXT_PUBLIC_*` vars are intentionally exposed to the browser; `SUPABASE_SERVICE_ROLE_KEY` and `FRED_API_KEY` are server-only.

### 4. Run

```bash
npm run dev
# → http://localhost:3000
```

For testing the PWA on a real iPhone over LAN, the dev server already binds to `0.0.0.0`. Find your Mac's IP (`ipconfig getifaddr en0`) and update `next.config.ts` `allowedDevOrigins` accordingly.

## User-supplied keys

Each user enters their own AI provider keys in the **Account** tab. These are stored in their Supabase `user_metadata` (encrypted at rest, RLS-protected, only the owning user can read):

- **Anthropic Claude** — required for the primary coaching agent
- **Google Gemini** — used for web-search grounding (free tier: 5/min, 500/day enforced client-side)
- **Polygon.io** — CME futures data (free tier: 5/min sliding window enforced)
- **Alpha Vantage** — RSI, MACD, news sentiment (free tier: 25/day daily counter)

Per-provider usage caps are enforced server-side with distinct error codes so users see exactly which provider hit a limit.

## Design system — Midnight Market

```css
--bg: #060b14;  --bg2: #0a1220;  --bg3: #0f1a2e;
--accent: #38bdf8;  --accent2: #7c3aed;
--green: #00e5a0;  --red: #ff3d5a;  --yellow: #ffd060;
```

- **Glass recipe:** `backdrop-filter: blur(12px)` + tint + 1px rim border, never `box-shadow`
- **Fonts:** Inter (UI/labels) · IBM Plex Mono (every numeric value, no exceptions)
- **Animations:** 0.2s ease on targeted properties only (never `transition: all`); respects `prefers-reduced-motion`
- **Mobile-first:** `100dvh`, `env(safe-area-inset-*)`, 44px tap targets, no horizontal overflow

## AI architecture

```
User prompt
   ↓
Claude Sonnet 4.6 (primary)
   ↓ tool_use
   ├─ searchGemini(query) ────────────→ Gemini 2.5 Flash + Google Search grounding
   ├─ fetchYahooFinanceSnapshot(ticks) → Yahoo (~15 min delay)
   ├─ fetchFREDSeries(seriesId) ──────→ FRED economic data
   ├─ fetchPolygonFutures(symbol) ────→ Polygon CME
   └─ fetchAlphaVantage(fn, sym) ─────→ AV technicals/news
   ↓
Coaching response + memory updates → Supabase user_metadata
```

The agentic loop runs up to 10 iterations. Tool results are cached (1hr for AV, 24hr for Polygon) and rate-limited per provider with distinct error sentinels.

## Testing on iPhone

The app is designed iPhone-first. After deploying to Vercel (or running locally over LAN), open in Safari → Share → Add to Home Screen. The PWA installs with a branded splash and dark icon, launches in standalone mode (no browser chrome), and respects all iOS safe-area insets.

## Status

- ✅ **Phase 1** — Auth & security (Supabase auth, server-side keys, /api/coach guarded)
- ✅ **Phase 2** — Persistence (trades + coaching history in Supabase, V5 localStorage migration)
- ✅ **Phase 3** — Stability & PWA (TabErrorBoundary, NaN guards, UUID v4, web manifest, real-device verified)
- 🚧 **Phase 4** — Stats refactor + test suite
- 🚧 **Phase 5** — Security headers, repo cleanup
- ✅ **Phase 6** — AI Coach memory layers
- ✅ **Phase 7** — Multi-source market data infrastructure with per-provider caps

## License

[MIT](./LICENSE) — © 2026 Richard Blackwell
