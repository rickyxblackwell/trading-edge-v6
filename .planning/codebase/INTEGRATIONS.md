# External Integrations

**Analysis Date:** 2026-05-05

## APIs & External Services

**AI / LLM:**
- Google Gemini 2.5 Flash — AI coaching responses, pattern memory, session titles
  - SDK/Client: `@google/genai` 1.52.0
  - Auth: API key passed in POST request body (`apiKey` field) by the client; not stored as server env var
  - Route: `app/api/coach/route.ts` — Next.js Route Handler (POST only)
  - Grounding: Google Search grounding enabled for `market-pulse` and `strategy-review` modes via `{ tools: [{ googleSearch: {} }] }`
  - Model call: `ai.models.generateContent({ model: "gemini-2.5-flash", ... })`

## Data Storage

**Databases:**
- Supabase — installed (`@supabase/supabase-js` 2.49.4) but not yet wired into the app
  - Connection: env vars not yet configured (future persistence phase)
  - Client: `@supabase/supabase-js` — no usage found in current source

**File Storage:**
- None — all assets are static

**Caching:**
- None — no Redis or in-memory cache layer beyond Next.js defaults

## Authentication & Identity

**Auth Provider:**
- None currently implemented — future phase (Supabase Auth planned)
- Gemini API key: user-entered via UI settings, stored in `localStorage` under `edge_v5_apikey`, sent to the coach API route on each request

## localStorage Persistence

All client-side state is persisted to `localStorage` via `app/lib/TradesContext.tsx`. No database backend is active.

**Keys and data shapes:**

| Key | Type | Shape |
|-----|------|-------|
| `edge_v5_trades` | `Trade[]` | `{ id, date, time, instrument, direction, session, contracts, pnl, rmult, outcome, confluences[], notes }` |
| `edge_v5_coaching_history` | `CoachingEntry[]` | `{ id, timestamp, tradeCount, title, fullContent, archived, mode, marketSnapshot, patterns, process, risk, priority, momentum }` — capped at 30 persisted (60 in-memory) |
| `edge_v5_apikey` | `string` | Raw Gemini API key string |
| `edge_v5_pattern_summary` | `string` | 200-word compressed trading pattern memory, updated after each `analyze` run |
| `edge_v5_strategy_text` | `string` | Trader's personal strategy notes, written directly via `localStorage.setItem` in `importData` |

**Hydration pattern:** `TradesContext.tsx` reads all keys on mount inside a `useEffect`, sets `hydrated = true`, then write-back effects are gated on `hydrated` to avoid clobbering localStorage before the initial read completes.

**Import/export:** `ExportPackage` interface (`app/lib/TradesContext.tsx`) supports full data export/import with shape `{ version: "v5", exportedAt, trades, coachingHistory, strategyText }`.

## AI Coach — Route Details

**Endpoint:** `POST /api/coach` → `app/api/coach/route.ts`

**Request body fields:**
- `message` — user chat text (used for `chat` mode)
- `mode` — `"analyze" | "market-pulse" | "strategy-review" | "chat"`
- `trades` — array of up to 20 recent trades (serialized, built by `buildTradesSummary`)
- `history` — last 3 coaching entries (for context)
- `patternSummary` — compressed pattern memory string
- `strategyText` — trader's personal notes
- `apiKey` — Gemini API key (validated server-side: must be string ≥10 chars)
- `sessionId` — string used as rate-limit key

**Rate limiting:** Server-side `Map<string, number>` (`lastCallTime`) keyed by `sessionId`. Enforces 15-second minimum between calls per session. Returns HTTP 429 on violation.

**Response fields:**
- `reply` — display text (TITLE and PATTERN SUMMARY UPDATE lines stripped)
- `sessionTitle` — extracted from `TITLE: <text>` pattern in Gemini output
- `newPatternSummary` — extracted from `PATTERN SUMMARY UPDATE: <text>` (analyze mode only)
- `coaching` — structured object `{ marketSnapshot, patterns, process, risk, priority, momentum }` (analyze mode only)

**Error handling:** Returns structured JSON errors for invalid API key (401), rate limit (429), empty Gemini response (502), and general failure (500).

## Monitoring & Observability

**Error Tracking:**
- None — no Sentry or similar service

**Logs:**
- `console.error` / `console.log` only; no structured logging

## CI/CD & Deployment

**Hosting:**
- Vercel (standard Next.js App Router deployment target)

**CI Pipeline:**
- None configured — no GitHub Actions or CI service detected

## Environment Configuration

**Required env vars (future — not yet in use):**
- Supabase URL and anon key (to be added when persistence phase ships)

**Current secrets handling:**
- Gemini API key: stored only in `localStorage` client-side, never in server environment; transmitted in POST body over HTTPS

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## MCP Integrations

The following MCPs are connected in the development environment (not bundled in the app):

| MCP | Purpose |
|-----|---------|
| `chrome-devtools` | Screenshots, DOM snapshots, CSS extraction, Lighthouse audits |
| `shadcn` | Component search and installation |
| `magic` (21st.dev) | Premium animated component generation; `@21st-sdk/agent` 0.0.18 is installed as a runtime dep |
| `firecrawl` | Web scraping, CSS token extraction |

---

*Integration audit: 2026-05-05*
