# Phase 7: Market Data API Infrastructure - Research

**Researched:** 2026-05-06
**Domain:** Agentic Claude tool_use loop, Alpha Vantage MCP, FRED API, Polygon.io Futures, Next.js caching, Supabase service role writes
**Confidence:** MEDIUM — all primary findings verified; Polygon.io futures tier requirement is a critical open question requiring user confirmation

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — API Key Storage:**
- Alpha Vantage: `user_metadata.av_api_key` (Account tab, per-user)
- Polygon.io: `user_metadata.polygon_api_key` (Account tab, per-user)
- FRED: server env var `FRED_API_KEY` (shared, unlimited)

**D-02 — Agentic Architecture (Pure Tool-Based):**
- Yahoo Finance is no longer pre-fetched — it is now a tool like all other sources
- All data sources are Claude `tool_use` definitions
- Claude is the hub; decides which tools to call based on user's message
- Nothing is automatic or pre-fetched
- Gemini search refactored from hardcoded mode-specific queries to an adaptive Claude tool available in all 4 modes

**D-03 — Data Fetch Policy:**
- On-demand only; no proactive fetching
- Polygon fetched only when user asks about a specific instrument

**D-04 — Two-Store Architecture:**
- Store 1: Historical Coaching Store (Supabase `user_metadata`) — permanent, managed by Phase 6 system (unchanged)
- Store 2: Daily Market Cache (Next.js `unstable_cache`) — max 24hr TTL, pure deduplication

**D-05 — Cache Design:**
- `unstable_cache` only (no new dependencies)
- Cache keys: `av:RSI:ES:daily`, `fred:DFF`, `polygon:ES1!:bars:10d`, `yf:snapshot:ES,NQ`
- TTL strategy:
  - Alpha Vantage: EOD (market close 4 PM ET on trading days)
  - Polygon.io: EOD (market close 4 PM ET on trading days)
  - Yahoo Finance: 24hr hard expiry, write on every tool call
  - FRED: 24hr hard expiry, write on every tool call
  - AV MARKET_STATUS: 15min TTL

**D-06 — Data Integrity (Server-Side Memory Writes):**
- `route.ts` writes all memory updates to Supabase via service role key BEFORE sending response
- Uses `supabase.auth.admin.updateUserById(userId, { user_metadata: {...} })`
- Client response includes updated fields as UI confirmation, not write instructions
- New env vars: `SUPABASE_SERVICE_ROLE_KEY`, `FRED_API_KEY`

**D-07 — Rate Limit and Error Handling:**
- Data API rate limits (Polygon 5/min, AV): silent queue, no user notification
- AI provider rate limits (Claude, Gemini): visible notification box
- Error surface policy: 429 data API → silent retry; 429 AI → visible; 401/403 → visible; 500/503 after retry → visible; timeout after retry → visible + Claude degrades

**D-07 — Available AV Endpoints (as Claude tools via MCP):**
- MARKET_STATUS, TIME_SERIES_DAILY/WEEKLY/MONTHLY
- RSI, MACD, BBANDS, VWAP
- TREASURY_YIELD, FEDERAL_FUNDS_RATE
- NEWS_SENTIMENT, EARNINGS_CALENDAR

**D-08 — FRED Endpoints (as Claude tools via plain fetch):**
- DFF, CPIAUCSL, PAYEMS, UNRATE, GDP, T10Y2Y, VIXCLS

**D-09 — Polygon Endpoints (as Claude tools via plain fetch):**
- ES1!, NQ1!, YM1!, MES1!, MNQ1!, MYM1! — last 10 daily bars + open interest
- Trigger: user asks about a specific instrument only

**D-10 — Mode Behavior:**
- All 4 modes share identical tool palette; no pre-fetching in any mode

**D-11 — Route Architecture:**
- No new route files — all changes go in `app/api/coach/route.ts`

### Claude's Discretion
- Exact tool definitions and parameter schemas for AV MCP
- Which FRED series to expose beyond the confirmed list
- Agentic loop implementation details

### Deferred Ideas (OUT OF SCOPE)
- Chat typing/loading animation
- Streaming responses (token-by-token)
- Offline retry queue
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MDATA-01 | Alpha Vantage MCP integration — all AV endpoints as Claude tools via remote MCP | Verified: AV MCP at `https://mcp.alphavantage.co/mcp?apikey=KEY` — uses Anthropic beta MCP connector with `betas: ["mcp-client-2025-11-20"]` |
| MDATA-02 | Claude agentic tool_use loop in route.ts — multi-turn loop until end_turn | Verified: `client.beta.messages.toolRunner()` handles loop automatically, or manual loop via messages array with `tool_result` blocks |
| MDATA-03 | FRED API integration — 7 series as Claude tools via plain fetch | Verified: `https://api.stlouisfed.org/fred/series/observations?series_id=DFF&api_key=KEY&file_type=json&sort_order=desc&limit=5` |
| MDATA-04 | Polygon.io futures data — CME contracts as Claude tools | MEDIUM confidence: Futures API exists; free tier may not include CME futures (potential paid plan required — see open questions) |
| MDATA-05 | Server-side Supabase memory writes via service role key | Verified: `createClient(url, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })` then `supabase.auth.admin.updateUserById(userId, { user_metadata: {...} })` |
</phase_requirements>

---

## Summary

Phase 7 replaces the current hybrid-fetch pattern in `route.ts` (pre-fetched Yahoo Finance + Gemini) with a pure agentic architecture where Claude uses tool_use to call any data source on demand. The primary integration challenge is wiring the Anthropic beta MCP connector to the Alpha Vantage remote MCP server — this uses `client.beta.messages.create()` with the `"mcp-client-2025-11-20"` beta header and `mcp_servers` / `tools` parameters.

The agentic loop pattern is well-documented in the installed `@anthropic-ai/sdk` (v0.94.0). The simplest reliable approach for a Next.js API route is the `client.beta.messages.toolRunner()` helper which automatically executes the multi-turn loop. For full control (needed here for cache injection and error handling per tool), the manual loop pattern with explicit `tool_result` blocks is required.

The biggest risk in this phase is Polygon.io's futures API. As of research date, the futures endpoint at `massive.com/docs/rest/futures` appears to be in beta and may require a plan beyond the free tier (which is $5/min rate-limited and covers stocks/options/crypto only). The planner must flag this for user confirmation before Polygon tool definitions are built. The rest of the stack (AV MCP, FRED plain fetch, Yahoo Finance wrap, Gemini tool) is straightforward.

**Primary recommendation:** Use `client.beta.messages.toolRunner()` with `betas: ["mcp-client-2025-11-20"]` for the full agentic loop; implement per-tool caching via `unstable_cache` wrappers that Claude's tool executor calls; confirm Polygon.io futures plan availability before scoping the Polygon tool tasks.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Claude agentic loop + tool dispatch | API / Backend (route.ts) | — | All data fetching must be server-side; API keys never leave server |
| Alpha Vantage MCP tool calls | API / Backend (route.ts) | — | MCP connector is a server-to-server call from route.ts to AV MCP server |
| FRED API fetch | API / Backend (route.ts) | — | API key is server env var; plain fetch in tool executor |
| Polygon.io fetch | API / Backend (route.ts) | — | API key is user_metadata; plain fetch in tool executor |
| Yahoo Finance fetch | API / Backend (route.ts) | — | Existing `fetchFuturesSnapshot` is server-only |
| Gemini search tool | API / Backend (route.ts) | — | Existing GoogleGenAI client stays server-side |
| Cache layer (unstable_cache) | API / Backend (route.ts) | — | Cache wrappers around each tool executor function |
| API key storage (AV, Polygon) | Database / Storage (Supabase user_metadata) | — | Per-user keys in user_metadata, read server-side only |
| Memory writes (coaching state) | API / Backend (route.ts) | Database / Storage | Service role write happens in route.ts before response |
| Rate limit notification UI | Browser / Client (Coach.tsx) | — | React state drives notification box visibility |
| API key entry UI (AV, Polygon) | Browser / Client (Account.tsx) | — | Extends existing Account tab pattern |

---

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | 0.94.0 (installed), 0.95.0 (registry) | Claude tool_use, MCP connector, agentic loop | Already in project; `beta.messages.toolRunner()` and `beta.messages.create()` with `betas` array |
| `@google/genai` | 1.52.0 (installed) | Gemini adaptive search tool | Already in project; refactored from hardcoded to tool-based |
| `yahoo-finance2` | 3.14.0 (installed) | Yahoo Finance tool executor | Already in project; wrap `fetchFuturesSnapshot` as tool |
| `@supabase/supabase-js` | 2.49.4 (installed) | Service role admin client | Already in project; `createClient(url, SERVICE_ROLE_KEY)` for admin writes |
| `next` | 16.2.4 (installed) | `unstable_cache` for server-side caching | Already in project; `use cache` is the Next.js 16 replacement but requires `cacheComponents: true` opt-in |

### No new packages needed
All required capabilities are covered by installed packages. FRED and Polygon.io use plain `fetch`. The AV MCP integration uses `client.beta.messages.create()` — no separate MCP client package required.

**Version verification:** [VERIFIED: npm registry] `@anthropic-ai/sdk` latest is 0.95.0; project has 0.94.0. Update is optional but beta MCP connector is available in 0.94.0. [VERIFIED: npm registry] All other packages are at their registry current versions.

---

## Architecture Patterns

### System Architecture Diagram

```
User Message
     │
     ▼
Coach.tsx (Client)
  - sends mode, message, trades, memory context
     │
     ▼  POST /api/coach
app/api/coach/route.ts
  ① Authenticate user (Supabase session)
  ② Read av_api_key, polygon_api_key from user_metadata
  ③ Read FRED_API_KEY, SUPABASE_SERVICE_ROLE_KEY from process.env
  ④ Build system prompt with memory context (unchanged from Phase 6)
  ⑤ Build tool definitions: YF + AV-MCP + FRED + Polygon + Gemini
     │
     ▼
client.beta.messages.toolRunner() ──► Anthropic API
         │                                    │
         │  ◄──── tool_use response ──────────┘
         │
     For each tool call:
         ├─ fetchYahooFinanceTool() ──► yahoo-finance2
         │    └─ unstable_cache(24hr)
         ├─ AV MCP via mcp_servers ──► https://mcp.alphavantage.co/mcp?apikey=KEY
         │    └─ unstable_cache(EOD)
         ├─ fetchFREDSeries() ──► api.stlouisfed.org
         │    └─ unstable_cache(24hr)
         ├─ fetchPolygonFutures() ──► api.polygon.io/futures
         │    └─ unstable_cache(EOD) + 5/min queue
         └─ fetchGeminiSearch() ──► GoogleGenAI (adaptive query)
              └─ no cache (always fresh)
         │
         ▼  tool_result blocks
     Claude final response (end_turn)
         │
     ⑥ Parse TITLE, MOMENTUM, VIOLATIONS, WATCHLIST commands
     ⑦ Compute memory updates (streaks, milestones, etc.)
     ⑧ Write memory to Supabase admin.updateUserById() ◄── SUPABASE_SERVICE_ROLE_KEY
     ⑨ Return response to client
```

### Recommended Project Structure

No new files/folders needed. Changes are confined to:

```
app/
├── api/coach/route.ts          # Primary: agentic loop, tool definitions, cache wrappers, service role write
├── components/tabs/Account.tsx # Add AV + Polygon API key fields (extend existing pattern)
└── lib/marketData.ts           # Wrap fetchFuturesSnapshot for tool executor (no change to function itself)
```

New env vars (`.env.local` + Vercel):
```
FRED_API_KEY=<server-only>
SUPABASE_SERVICE_ROLE_KEY=<server-only>
```

### Pattern 1: Alpha Vantage MCP via Anthropic Beta MCP Connector

**What:** Connect Claude to AV remote MCP server; Claude calls AV endpoints natively as tools
**When to use:** All AV endpoint calls (RSI, MACD, NEWS_SENTIMENT, etc.)

The AV MCP is a remote HTTP server at `https://mcp.alphavantage.co/mcp?apikey=KEY`. The Anthropic SDK beta MCP connector integrates it directly — Claude discovers and calls AV tools without manual tool definitions.

```typescript
// Source: https://platform.claude.com/docs/en/docs/agents-and-tools/mcp-connector [VERIFIED]
import Anthropic from "@anthropic-ai/sdk"

const response = await anthropic.beta.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 4096,
  system: systemPrompt,
  messages: conversationMessages,
  mcp_servers: [
    {
      type: "url",
      url: `https://mcp.alphavantage.co/mcp?apikey=${avApiKey}`,
      name: "alphavantage",
    }
  ],
  tools: [
    {
      type: "mcp_toolset",
      mcp_server_name: "alphavantage",
      // Allowlist only the endpoints from D-07
      default_config: { enabled: false },
      configs: {
        "TIME_SERIES_DAILY": { enabled: true },
        "TIME_SERIES_WEEKLY": { enabled: true },
        "TIME_SERIES_MONTHLY": { enabled: true },
        "MARKET_STATUS": { enabled: true },
        "RSI": { enabled: true },
        "MACD": { enabled: true },
        "BBANDS": { enabled: true },
        "VWAP": { enabled: true },
        "TREASURY_YIELD": { enabled: true },
        "FEDERAL_FUNDS_RATE": { enabled: true },
        "NEWS_SENTIMENT": { enabled: true },
        "EARNINGS_CALENDAR": { enabled: true },
      }
    },
    // Plus non-MCP tools below
  ],
  betas: ["mcp-client-2025-11-20"],
})
```

**Key constraint:** `betas: ["mcp-client-2025-11-20"]` requires `client.beta.messages.create()`, not `client.messages.create()`. [VERIFIED: official Anthropic docs]

**AV API key in URL:** The AV MCP server authenticates via `?apikey=` query param in the URL. No separate `authorization_token` needed. [VERIFIED: mcp.alphavantage.co homepage]

**AV MCP exposes 100+ tools.** Use `default_config: { enabled: false }` + explicit `configs` per D-07 allowlist to limit token overhead and prevent Claude from calling expensive/irrelevant endpoints.

### Pattern 2: Manual Agentic Loop with Non-MCP Tools

**What:** Manual multi-turn conversation loop for FRED, Polygon, Yahoo Finance, and Gemini tools defined as standard Anthropic Tool objects
**When to use:** When mixing MCP tools with custom fetch-based tools

Since FRED, Polygon, Yahoo Finance, and Gemini are implemented as plain fetch calls in route.ts (not MCP servers), they are defined as standard `Anthropic.Tool[]` objects alongside the MCP toolset.

```typescript
// Source: https://context7.com/anthropics/anthropic-sdk-typescript/llms.txt [VERIFIED]
const localTools: Anthropic.Tool[] = [
  {
    name: "fetchYahooFinanceSnapshot",
    description: "Fetch live futures price snapshot (ES, NQ, YM, and user watchlist). Use when user asks about current prices or market conditions.",
    input_schema: {
      type: "object",
      properties: {
        symbols: {
          type: "array",
          items: { type: "string" },
          description: "Futures symbols to fetch (e.g. ['ES', 'NQ']). Empty array returns core futures."
        }
      },
      required: []
    }
  },
  {
    name: "fetchFREDSeries",
    description: "Fetch a FRED economic series (latest 5 observations). Use for macro context: DFF (Fed funds rate), CPIAUCSL (CPI), PAYEMS (payrolls), UNRATE (unemployment), GDP, T10Y2Y (yield curve), VIXCLS (VIX).",
    input_schema: {
      type: "object",
      properties: {
        series_id: {
          type: "string",
          enum: ["DFF", "CPIAUCSL", "PAYEMS", "UNRATE", "GDP", "T10Y2Y", "VIXCLS"],
          description: "FRED series ID"
        }
      },
      required: ["series_id"]
    }
  },
  {
    name: "fetchPolygonFutures",
    description: "Fetch CME futures historical bars + open interest for a specific contract. Only use when user asks about a specific futures instrument by name.",
    input_schema: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          enum: ["ES", "NQ", "YM", "MES", "MNQ", "MYM"],
          description: "CME futures root symbol"
        }
      },
      required: ["symbol"]
    }
  },
  {
    name: "searchGemini",
    description: "Perform a web search using Gemini for current market news, strategy research, or economic events. Generate an appropriate search query based on the user's question.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query to execute (Claude generates this adaptively based on user context)"
        }
      },
      required: ["query"]
    }
  }
]
```

The agentic loop processes all tool results (both MCP and local) until `stop_reason === "end_turn"`:

```typescript
// Source: Context7 /anthropics/anthropic-sdk-typescript tool use examples [VERIFIED]
// Using toolRunner — handles the loop automatically
const finalMessage = await anthropic.beta.messages.toolRunner({
  model: "claude-sonnet-4-6",
  max_tokens: 2048,
  system: finalSystemContext,
  messages: [{ role: "user", content: userPrompt }],
  tools: [...localTools],  // MCP tools are in mcp_servers, not here
  mcp_servers: avApiKey ? [{ type: "url", url: `https://mcp.alphavantage.co/mcp?apikey=${avApiKey}`, name: "alphavantage" }] : [],
  // Note: toolRunner + betas needs verification — see open questions
  betas: ["mcp-client-2025-11-20"],
})
```

**IMPORTANT NOTE on toolRunner vs beta.messages.create:** The `toolRunner` helper lives at `client.beta.messages.toolRunner()`. When using MCP connector (`betas: ["mcp-client-2025-11-20"]`), the call must go through `client.beta.messages`. Verify that `client.beta.messages.toolRunner()` supports the `mcp_servers` and `betas` parameters — if not, use the manual loop via `client.beta.messages.create()`. See Open Questions.

### Pattern 3: Manual Loop (fallback when toolRunner doesn't support MCP)

```typescript
// Source: Context7 /anthropics/anthropic-sdk-typescript [VERIFIED - manual loop]
const messages: Anthropic.Beta.BetaMessageParam[] = [
  { role: "user", content: userPrompt }
]

let response = await anthropic.beta.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 2048,
  system: finalSystemContext,
  messages,
  tools: localTools,
  mcp_servers: [...],
  betas: ["mcp-client-2025-11-20"],
})

while (response.stop_reason === "tool_use") {
  const toolUseBlocks = response.content.filter(
    (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use"
  )
  // Execute all tool calls (including MCP tool results handled automatically)
  const toolResults = await Promise.all(toolUseBlocks.map(executeToolCall))

  messages.push({ role: "assistant", content: response.content })
  messages.push({
    role: "user",
    content: toolResults.map(r => ({
      type: "tool_result" as const,
      tool_use_id: r.toolUseId,
      content: r.result,
    }))
  })

  response = await anthropic.beta.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: finalSystemContext,
    messages,
    tools: localTools,
    mcp_servers: [...],
    betas: ["mcp-client-2025-11-20"],
  })
}
```

### Pattern 4: FRED API Plain Fetch

```typescript
// Source: [VERIFIED: fred.stlouisfed.org docs via WebSearch]
async function fetchFREDSeries(seriesId: string, fredApiKey: string): Promise<string> {
  const url = new URL("https://api.stlouisfed.org/fred/series/observations")
  url.searchParams.set("series_id", seriesId)
  url.searchParams.set("api_key", fredApiKey)
  url.searchParams.set("file_type", "json")
  url.searchParams.set("sort_order", "desc")
  url.searchParams.set("limit", "5")

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`FRED ${seriesId}: ${res.status}`)
  const data = await res.json()
  // data.observations: Array<{ date: string; value: string }>
  return data.observations
    .map((o: { date: string; value: string }) => `${o.date}: ${o.value}`)
    .join(", ")
}
```

Rate limit: 120 requests/minute (effectively unlimited for this use case). [VERIFIED: WebSearch, multiple sources]

### Pattern 5: Supabase Service Role Admin Write

```typescript
// Source: Context7 /supabase/supabase-js [VERIFIED]
import { createClient } from "@supabase/supabase-js"

// Create admin client once (outside POST handler for module-level singleton)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,  // Server env only — never in client
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

// Inside route.ts, after computing memory updates:
const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
  user_metadata: {
    // Spread existing metadata + updates to avoid clobbering unrelated fields
    ...user.user_metadata,
    session_index: updatedSessionIndex,
    behavior_ledger: updatedBehaviorLedger,
    streaks: updatedStreaks,
    milestone_log: updatedMilestoneLog,
    weekly_summaries: updatedWeeklySummaries,
    monthly_summaries: updatedMonthlySummaries,
  }
})
if (error) {
  return NextResponse.json({ error: "Memory write failed" }, { status: 500 })
}
```

**Critical difference from Phase 6 pattern:** Phase 6 uses `supabase.auth.updateUser()` (requires user session cookie, updates the calling user). Phase 7 uses `supabaseAdmin.auth.admin.updateUserById(userId, ...)` (requires service role key, can update any user). Both update `user_metadata`. [VERIFIED: Context7 Supabase docs]

**Security:** `SUPABASE_SERVICE_ROLE_KEY` must NEVER be exposed to the client. It only appears in `process.env` server-side. The existing `NEXT_PUBLIC_SUPABASE_ANON_KEY` (which IS exposed to the client) cannot be used for admin writes. [VERIFIED: Supabase docs]

### Pattern 6: unstable_cache TTL Wrapper

```typescript
// Source: https://nextjs.org/docs/app/api-reference/functions/unstable_cache [VERIFIED]
import { unstable_cache } from "next/cache"

// EOD cache key helper — returns YYYY-MM-DD of current or last trading day
function getTradingDayKey(): string {
  const now = new Date()
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }))
  const hour = et.getHours()
  const minute = et.getMinutes()
  // After 4 PM ET = next cache window; before = today's window
  if (hour >= 16) {
    // Still same trading day key until midnight
    return et.toISOString().split("T")[0]
  }
  // Before 4 PM — use yesterday if it was a weekday
  et.setDate(et.getDate() - 1)
  return et.toISOString().split("T")[0]
}

// Per-endpoint EOD cache (AV, Polygon)
const cachedAVEndpoint = unstable_cache(
  async (endpoint: string, symbol: string, interval: string) => {
    return fetchAVEndpoint(endpoint, symbol, interval, avApiKey)
  },
  ["av", endpoint, symbol, interval, getTradingDayKey()],  // Cache key includes trading day
  { revalidate: 86400 }  // 24hr max — trading day key provides effective EOD boundary
)

// 24hr cache (FRED, YF)
const cachedFREDSeries = unstable_cache(
  async (seriesId: string) => fetchFREDSeries(seriesId, fredApiKey),
  ["fred", seriesId],
  { revalidate: 86400 }
)
```

**Critical Next.js 16 note:** `unstable_cache` is deprecated in Next.js 16 — the official replacement is the `use cache` directive. However, `use cache` requires `cacheComponents: true` in `next.config.ts` and has different semantics (directive-based, not function-wrapping). For a Route Handler (API route), `unstable_cache` still works in Next.js 16 and is the correct choice here since `use cache` is designed for Server Components and functions called from them. [VERIFIED: Next.js 16.2.5 docs — `use cache` docs note "serverless: Cache entries typically don't persist across requests"] The Phase 6 decision to use `unstable_cache` stands.

**Serverless persistence:** `unstable_cache` uses Next.js' built-in Data Cache which persists across cold starts on Vercel. In-memory via `use cache` does NOT persist across cold starts. `unstable_cache` is the correct choice for this use case. [VERIFIED: Next.js docs + WebSearch community findings]

### Anti-Patterns to Avoid

- **Calling `client.messages.create()` for MCP:** The MCP connector requires `client.beta.messages.create()` with `betas: ["mcp-client-2025-11-20"]`. The non-beta `messages.create()` does not accept `mcp_servers`.
- **Using `authorization_token` for AV MCP:** The AV MCP server authenticates via `?apikey=` in the URL, not via `authorization_token` header. Passing `authorization_token` is unnecessary (and possibly wrong).
- **Using `supabase.auth.updateUser()` for Phase 7 writes:** This method requires the user's session cookie and only updates the calling user. It works but creates client-dependency. The service role `admin.updateUserById()` is the correct pattern for server-side writes.
- **Constructing `unstable_cache` inside the POST handler function body:** The cache function must be defined at module level or with a stable key to avoid cache misses on every request. Keys must be static or derived from stable values.
- **Leaking `SUPABASE_SERVICE_ROLE_KEY` via `NEXT_PUBLIC_` prefix:** Must be `SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC_` prefix). `NEXT_PUBLIC_` env vars are bundled into client code.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-turn agentic loop | Custom while-loop with manual message arrays | `client.beta.messages.toolRunner()` | Handles parallel tool calls, loop termination, max_iterations guard |
| AV endpoint HTTP calls | Manual fetch to `www.alphavantage.co/query` | AV MCP via `mcp_servers` | MCP server handles authentication, schema, 100+ endpoints already defined |
| Rate limiting queue | Custom setTimeout queue in serverless | `unstable_cache` EOD key + tool executor retry | Serverless functions don't share state between invocations; cache prevents redundant calls |
| MCP client library | `@modelcontextprotocol/sdk` client | Anthropic SDK built-in MCP connector | SDK handles MCP protocol natively; no extra package needed |
| FRED client library | npm `fred-client` or similar | Plain `fetch` to `api.stlouisfed.org` | FRED REST API is simple JSON — no SDK needed |

**Key insight:** The Anthropic SDK's built-in MCP connector (beta) eliminates the need to write any tool-definition schemas for Alpha Vantage. Claude discovers and calls AV tools through the MCP protocol. The only tool definitions needed are for the 4 custom data sources: Yahoo Finance, FRED, Polygon, and Gemini.

---

## Common Pitfalls

### Pitfall 1: MCP Beta Header Version Mismatch

**What goes wrong:** Using `"mcp-client-2025-04-04"` (deprecated) instead of `"mcp-client-2025-11-20"`. The deprecated version puts tool configuration inside `mcp_servers` (as `tool_configuration.allowed_tools`). The current version moves configuration to the `tools` array as `MCPToolset`.

**Why it happens:** Documentation was changed; older code examples use the deprecated header.

**How to avoid:** Always use `betas: ["mcp-client-2025-11-20"]` with the new configuration format shown in Pattern 1.

**Warning signs:** `mcp_servers` objects have a `tool_configuration` key (wrong format); TypeScript type errors on `tool_configuration`.

### Pitfall 2: AV Free Tier Budget Exhaustion (25 req/day)

**What goes wrong:** Without EOD caching, each coaching session can exhaust the daily AV budget (25 requests/day on free tier) within a few messages.

**Why it happens:** AV free tier has a hard 25 req/day limit. Claude calling RSI, MACD, BBANDS, and NEWS_SENTIMENT in one response = 4 requests.

**How to avoid:** EOD cache key (D-05) ensures each AV endpoint+symbol combination is fetched at most once per trading day. At 25 requests/day and ~12 common endpoint+symbol combinations, one user can make many coach calls without hitting the limit.

**Warning signs:** 429 responses from AV MCP within the first few coach sessions of the day.

### Pitfall 3: Service Role Key in Wrong Supabase Client

**What goes wrong:** Using the `createClient` from `@/lib/supabase/server` (which uses `NEXT_PUBLIC_SUPABASE_ANON_KEY`) for admin writes instead of creating a separate admin client with `SUPABASE_SERVICE_ROLE_KEY`.

**Why it happens:** The server Supabase client (from `lib/supabase/server.ts`) is session-bound — it uses SSR cookies. Admin writes require the service role, which is separate.

**How to avoid:** Create a dedicated module-level admin client in `route.ts` using `createClient` from `@supabase/supabase-js` directly (not `@supabase/ssr`). Check: does `route.ts` import from `@/lib/supabase/server`? Yes — the admin client must be separate.

**Warning signs:** `"You are not allowed to update your own metadata"` Supabase error; 403 on admin write.

### Pitfall 4: Polygon Futures API Tier Requirement

**What goes wrong:** Building Polygon tool definitions against a paid-only endpoint, then discovering the user's API key doesn't grant access to futures data.

**Why it happens:** Polygon.io's free tier (5 req/min, delayed data) covers stocks/options/crypto. CME Globex futures data appears to require a separate plan or the beta futures access.

**How to avoid:** The plan must include a graceful fallback if the Polygon API key returns 403 (futures not included in plan). The tool executor should surface this as an "account upgrade required" message to Claude, not a generic error.

**Warning signs:** 403 from Polygon API with "insufficient permissions" or "access denied".

### Pitfall 5: EOD Cache Key Missing Weekend/Holiday Logic

**What goes wrong:** On Saturday morning, the EOD cache key is Saturday, but the last valid data is from Friday close. Cache misses trigger a Polygon/AV call that returns no data (market closed).

**Why it happens:** Simple `new Date().toISOString().split("T")[0]` generates a new key on Saturday, invalidating Friday's cache.

**How to avoid:** The EOD key function must roll back to the last trading day's date on weekends and holidays. A simple heuristic: if today is Saturday, use Friday; if Sunday, use Friday. Federal holidays require a holiday calendar.

**Warning signs:** AV/Polygon returning empty data on weekends; redundant API calls on non-trading days.

### Pitfall 6: unstable_cache Key Closure Capture

**What goes wrong:** Creating the `unstable_cache` wrapper inside the POST handler with an API key from the user's session — the API key is captured via closure but `unstable_cache` uses the `keyParts` array (not the closure) for cache key deduplication. Different users share the same cache entry if their keys differ but the `keyParts` match.

**Why it happens:** `unstable_cache` was designed for shared data (e.g., database queries), not per-user data. The cache key must explicitly include user-scoping if the data is user-specific. But for market data (AV, FRED, Polygon), the data is NOT user-specific — it's the same for all users. This is actually correct behavior.

**How to avoid:** Market data cache keys should NOT include user IDs — data is shared across all users, which reduces AV budget usage. API keys are in the closure for authentication only, not for cache differentiation.

**Warning signs:** User A's AV call populating cache, then User B (with different AV key) getting User A's cached response with the wrong key embedded.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded Gemini queries (market-pulse, strategy-review) | Claude-driven adaptive Gemini search tool (all 4 modes) | Phase 7 | Gemini search is more relevant and available everywhere |
| Yahoo Finance unconditional pre-fetch | Yahoo Finance as on-demand tool | Phase 7 | Reduces latency on sessions where market data isn't needed |
| Client-side memory writes via response + client `updateUser` | Server-side memory writes via service role `admin.updateUserById` | Phase 7 | Eliminates silent data loss on network interruption |
| MCP connector beta `mcp-client-2025-04-04` | `mcp-client-2025-11-20` (current) | Late 2025 | Breaking format change — old docs show deprecated format |
| `unstable_cache` (Next.js 14+) | `use cache` directive (Next.js 15+, stable in 16) | Next.js 16 | `unstable_cache` still works but is deprecated; `use cache` needs opt-in |

**Deprecated/outdated:**
- `mcp-client-2025-04-04` beta header: deprecated, do not use
- Phase 6 hardcoded Gemini query strings: replaced by adaptive tool in Phase 7

---

## Code Examples

### FRED Series Fetch

```typescript
// Source: fred.stlouisfed.org docs [VERIFIED via WebSearch]
async function fetchFREDSeries(
  seriesId: string,
  apiKey: string
): Promise<string> {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=5`
  const res = await fetch(url, { next: { revalidate: 86400 } })
  if (!res.ok) {
    if (res.status === 429) throw new Error("FRED_RATE_LIMIT")
    throw new Error(`FRED_ERROR_${res.status}`)
  }
  const data = await res.json() as {
    observations: Array<{ date: string; value: string }>
  }
  const obs = data.observations
    .filter(o => o.value !== ".")  // FRED uses "." for missing values
    .slice(0, 3)
  return `${seriesId}: ${obs.map(o => `${o.date}=${o.value}`).join(", ")}`
}
```

### Polygon Futures Fetch (plain fetch — rate limiting via queue)

```typescript
// Source: [ASSUMED] — Polygon API pattern based on standard REST auth
// NOTE: Futures API plan requirement is UNVERIFIED — see Open Questions
const POLYGON_BASE = "https://api.polygon.io"

async function fetchPolygonFutures(
  symbol: string,  // e.g., "ES" → mapped to "ESM5" current front month
  apiKey: string
): Promise<string> {
  // Polygon futures ticker: root + month + year (e.g., ESM5 for June 2025)
  // Continuous contract format (ES1!) may require specific plan — verify
  const ticker = resolvePolygonFuturesTicker(symbol)
  const url = `${POLYGON_BASE}/futures/v1/aggs/${ticker}?resolution=1session&limit=10&apiKey=${apiKey}`
  const res = await fetch(url)
  if (!res.ok) {
    if (res.status === 403) return `[Polygon futures requires upgraded plan for ${symbol}]`
    if (res.status === 429) throw new Error("POLYGON_RATE_LIMIT")
    throw new Error(`POLYGON_ERROR_${res.status}`)
  }
  const data = await res.json()
  return formatPolygonBars(data, symbol)
}
```

### Account Tab API Key Field Extension (exact pattern to replicate)

```typescript
// Source: app/components/tabs/Account.tsx (existing codebase) [VERIFIED: codebase read]
// Replicate this pattern for AV and Polygon keys:
const [maskedAvKey, setMaskedAvKey] = useState<string | null>(null)
const [avExpanded, setAvExpanded] = useState(false)
const [newAvKey, setNewAvKey] = useState("")
const [avSaving, setAvSaving] = useState(false)
const [avSaveSuccess, setAvSaveSuccess] = useState(false)

async function handleSaveAvKey() {
  if (!newAvKey.trim()) return
  setAvSaving(true)
  const supabase = createClient()
  const { error } = await supabase.auth.updateUser({
    data: { av_api_key: newAvKey.trim() },
  })
  if (!error) {
    setAvSaveSuccess(true)
    // ... same success/error handling as Claude key
  }
  setAvSaving(false)
}
```

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@anthropic-ai/sdk` beta MCP connector | AV MCP integration (MDATA-01) | ✓ | 0.94.0 (0.95.0 available) | — |
| `@google/genai` | Gemini adaptive search tool | ✓ | 1.52.0 | — |
| `yahoo-finance2` | Yahoo Finance tool executor | ✓ | 3.14.0 | — |
| `@supabase/supabase-js` | Service role admin writes | ✓ | 2.49.4 | — |
| Alpha Vantage MCP (`https://mcp.alphavantage.co/mcp`) | AV tool calls | ✓ (requires user API key) | HTTP/SSE remote | — |
| FRED API (`api.stlouisfed.org`) | FRED series tools | ✓ (requires `FRED_API_KEY` env var) | REST, 120 req/min | — |
| Polygon.io Futures API | Polygon tool calls | UNKNOWN (requires paid plan?) | REST | Graceful skip if 403 |
| `SUPABASE_SERVICE_ROLE_KEY` env var | Service role writes | ✗ (not yet in `.env.local`) | — | Phase must add this |
| `FRED_API_KEY` env var | FRED fetches | ✗ (not yet in `.env.local`) | — | Phase must add this |

**Missing dependencies with no fallback:**
- `SUPABASE_SERVICE_ROLE_KEY` — must be added to `.env.local` and Vercel env vars before Wave 1 can pass tests
- `FRED_API_KEY` — must be added before FRED tool can be tested

**Missing dependencies with fallback:**
- Polygon.io futures plan — if user's key returns 403 on futures endpoints, tool returns a graceful "futures data requires plan upgrade" string to Claude

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | TypeScript compiler (`npx tsc --noEmit`) — primary validation |
| Config file | `tsconfig.json` (existing) |
| Quick run command | `npx tsc --noEmit` |
| Full suite command | `npx tsc --noEmit` (no Jest/Vitest configured) |

**Note:** No test framework (Jest, Vitest, Playwright) is configured in this project. TypeScript strict-mode compilation is the primary automated check. Per `nyquist_validation: true`, each task should include `npx tsc --noEmit` as the automated gate.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MDATA-01 | AV MCP tools callable via beta.messages | Integration | `npx tsc --noEmit` (type check) | ✅ route.ts |
| MDATA-02 | Agentic loop executes until end_turn | Integration | `npx tsc --noEmit` (type check) | ✅ route.ts |
| MDATA-03 | FRED series fetch returns formatted data | Unit | `npx tsc --noEmit` | ✅ route.ts |
| MDATA-04 | Polygon futures fetch with graceful 403 | Unit | `npx tsc --noEmit` | ✅ route.ts |
| MDATA-05 | Server-side Supabase write before response | Integration | `npx tsc --noEmit` | ✅ route.ts |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit`
- **Per wave merge:** `npx tsc --noEmit`
- **Phase gate:** `npx tsc --noEmit` green + manual coach session test before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] Add `SUPABASE_SERVICE_ROLE_KEY` and `FRED_API_KEY` to `.env.local` (developer action, not code task)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase session auth on every route.ts request (already implemented) |
| V3 Session Management | no | N/A |
| V4 Access Control | yes | Service role key — server-only env var, never `NEXT_PUBLIC_` prefix |
| V5 Input Validation | yes | Tool call inputs validated by TypeScript types; enum constraints on FRED series IDs and Polygon symbols |
| V6 Cryptography | no | No new cryptographic operations |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| AV API key leaked via client response | Information Disclosure | Key is read from `user.user_metadata` server-side in `route.ts`; never included in JSON response |
| Polygon/AV keys injected into URLs logged by Vercel | Information Disclosure | Configure Vercel log filtering; use `Authorization: Bearer` header instead of `?apikey=` where supported |
| SUPABASE_SERVICE_ROLE_KEY exposed via NEXT_PUBLIC_ prefix | Elevation of Privilege | Must use `SUPABASE_SERVICE_ROLE_KEY` (no NEXT_PUBLIC prefix); verify in `.env.local` |
| Agentic loop infinite recursion (max_iterations bypass) | Denial of Service | Set `max_iterations: 10` on toolRunner; or max loop depth of 10 in manual loop |
| Tool input injection (malicious symbol enum bypass) | Tampering | Validate tool input `symbol` is in allowed enum before fetch; reject unknown symbols |
| FRED API key exposure in cache | Information Disclosure | Cache stores response content only, not the URL with API key; FRED key is never in response |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Polygon.io futures API is accessible on the user's free/paid tier | Standard Stack, Pitfall 4 | Polygon tool tasks are built but all return graceful fallback — wasted implementation effort but no breakage |
| A2 | AV MCP server at `mcp.alphavantage.co/mcp?apikey=KEY` supports `"mcp-client-2025-11-20"` beta header | Pattern 1 | MCP calls fail; fallback to plain REST AV calls with manual tool definitions |
| A3 | `client.beta.messages.toolRunner()` supports `mcp_servers` and `betas` parameters | Pattern 2 | Must use manual loop (Pattern 3) instead |
| A4 | Polygon futures ticker for "current front month" can be computed server-side without external data | Pattern 5 code example | Wrong ticker computed; need an additional Polygon endpoint to look up active contract |
| A5 | `unstable_cache` in Next.js 16.2.4 persists across cold starts on Vercel (in Data Cache, not memory) | Pattern 6 | Cache misses on cold starts; AV budget gets hit multiple times per day |

---

## Open Questions (RESOLVED)

1. **Polygon.io Futures Plan Requirement** — CRITICAL
   - What we know: Polygon's free tier is 5 req/min with delayed data; covers stocks/options/crypto; futures API is documented but the rate limit page says "5 req/min for free tier"
   - What's unclear: Whether CME futures data is accessible on any plan the user currently has; whether the Futures REST API is still in beta and requires early access
   - Recommendation: Planner should include a Wave 0 task for the user to verify their Polygon.io plan grants futures data access (`GET /futures/v1/contracts` with their key). If 403, scope Polygon to graceful-degradation-only mode with a clear "account upgrade required" message.
   - **RESOLVED:** Wave 0 (Plan 07-01 Task 2) gates all Polygon code — executor tests the key before any Polygon tool is built. The `polygon_tier` outcome (`full` / `forbidden` / `endpoint_unknown`) is recorded in `07-01-WAVE0-LOG.md` and propagated through `process.env.POLYGON_TIER` into `executeToolCall` via `toolDeps.polygonTier` (Plan 07-04 Task 1). The `cachedFetchPolygon` wrapper (Plan 07-03 Task 2) is bypassed when tier is `forbidden` so the stub string returns immediately without touching the Data Cache.

2. **`toolRunner` + MCP connector compatibility**
   - What we know: `toolRunner` is at `client.beta.messages.toolRunner()`; MCP connector uses `client.beta.messages.create()` with `betas: ["mcp-client-2025-11-20"]`
   - What's unclear: Whether `toolRunner` accepts `mcp_servers` and `betas` parameters (the docs show separate examples)
   - Recommendation: Planner should specify both implementations (Pattern 2 and Pattern 3) with Pattern 3 (manual loop) as the guaranteed fallback.
   - **RESOLVED:** Plan 07-04 uses Pattern 3 (manual while-loop) as the implementation path — toolRunner compatibility is bypassed. The plan specifies the exact while-loop structure with `loopCount < MAX_LOOP_ITERATIONS` (T-07-04 mitigation) and explicit `tool_result` block construction. This sidesteps any uncertainty about toolRunner's MCP support.

3. **Polygon futures ticker format for continuous contracts**
   - What we know: Polygon uses dated tickers (e.g., `ESM5` for June 2025 ES). Continuous contract format `ES1!` is mentioned in CONTEXT.md (D-09) but not confirmed to be supported by Polygon.
   - What's unclear: Whether Polygon supports a continuous contract ticker format or whether the plan must compute the active front-month contract dynamically.
   - Recommendation: Planner should scope a lookup step — either a Polygon contracts endpoint (`/futures/v1/contracts?product_code=ES&active=true`) to find the current front month, or a hardcoded front-month calculator.
   - **RESOLVED:** Plan 07-03 Task 1 uses the Polygon contracts endpoint (`/v3/reference/tickers?market=futures&active=true&search=<symbol>`) to look up the active front-month contract by asset class. Continuous ticker form like `ES1!` is resolved to a dated ticker (e.g., `ESM5`) before calling the aggs endpoint. This eliminates dependence on continuous-contract format support.

4. **AV MCP Tool Discovery on Per-Request Basis**
   - What we know: AV MCP has 100+ tools; we use an allowlist of 12. Claude discovers tools from the MCP server on each request.
   - What's unclear: Whether tool discovery (fetching the MCP tool list) counts against the AV rate limit or has its own overhead.
   - Recommendation: The `defer_loading: true` configuration in MCPToolset may help; planner should include this on less-used tools.
   - **RESOLVED:** `defer_loading: true` is NOT used; overhead is accepted within the AV free-tier budget given the 12-tool allowlist (Pitfall 2 EOD cache keeps daily AV calls well under the 25 req/day cap). Monitor in production — if the discovery overhead becomes problematic, a follow-up plan can add `defer_loading: true` to less-frequently-used tools (NEWS_SENTIMENT, EARNINGS_CALENDAR).

---

## Sources

### Primary (HIGH confidence)
- `platform.claude.com/docs/en/docs/agents-and-tools/mcp-connector` — MCP connector TypeScript pattern, beta header, `mcp_servers` format, MCPToolset configuration
- `context7.com/anthropics/anthropic-sdk-typescript` — Tool use agentic loop, toolRunner, parallel tools, manual loop pattern
- `context7.com/supabase/supabase-js` — `auth.admin.updateUserById`, service role client initialization, AdminUserAttributes type
- `nextjs.org/docs/app/api-reference/functions/unstable_cache` — Cache API, `revalidate` option, Next.js 16 deprecation note
- `nextjs.org/docs/app/api-reference/directives/use-cache` — Next.js 16 `use cache`, serverless persistence characteristics
- `mcp.alphavantage.co` / `github.com/alphavantage/alpha_vantage_mcp` — AV MCP server URL format, tool categories, authentication via `?apikey=`
- Codebase reads: `app/api/coach/route.ts`, `app/lib/marketData.ts`, `app/components/tabs/Account.tsx`, `lib/supabase/server.ts`, `package.json`

### Secondary (MEDIUM confidence)
- WebSearch + `fred.stlouisfed.org/docs` — FRED API URL format, `api_key` param, JSON response shape, 120 req/min rate limit
- WebSearch + `massive.com/docs/rest/futures` — Polygon futures API endpoint format (verified via redirect), session-resolution bars, ticker format
- WebSearch + `macroption.com` + `alphalog.ai` — AV free tier 25 req/day confirmed

### Tertiary (LOW confidence)
- WebSearch — Polygon.io $199/month for futures data (single source, not official)
- WebSearch — Polygon free tier does not include futures (inferred from coverage description, not stated explicitly)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages installed and verified; Anthropic SDK MCP connector verified against official docs
- Agentic loop patterns: HIGH — verified against Context7 + official Anthropic docs
- FRED API: HIGH — REST format well-documented and verified
- AV MCP integration: MEDIUM — remote server URL verified, but toolRunner+MCP combination unverified
- Polygon futures: LOW — API exists, but plan requirements for CME futures are unclear; ticker format for front-month contracts unverified
- Next.js caching: HIGH — official docs verified, serverless behavior documented
- Supabase service role: HIGH — pattern verified against Context7

**Research date:** 2026-05-06
**Valid until:** 2026-06-06 (30 days) — AV MCP and Anthropic beta headers may change faster
