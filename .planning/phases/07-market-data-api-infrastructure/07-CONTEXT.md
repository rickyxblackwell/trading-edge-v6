# Phase 7: Market Data API Infrastructure - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the AI coaching infrastructure with multi-source market data APIs. Claude becomes the orchestrator — it decides which data sources to call based on the user's message, using tool_use definitions. Yahoo Finance stays pre-fetched (baseline market snapshot for all modes). All other data sources (Alpha Vantage, FRED, Polygon.io, Gemini search) become Claude tools invoked on-demand.

Phase 7 also refactors the Phase 6 Gemini integration: hardcoded mode-specific queries (market-pulse, strategy-review) are replaced with Claude-driven adaptive search available to all 4 modes.

No new user-facing UI is added in this phase (typing animation and other UI polish deferred to a later phase).

</domain>

<decisions>
## Implementation Decisions

### API Key Storage (D-01)

Three new API keys needed. Storage split:

| Key | Storage | How user sets it |
|-----|---------|-----------------|
| Alpha Vantage | Supabase `user_metadata.av_api_key` | Account tab (same section as Claude/Gemini keys) |
| Polygon.io | Supabase `user_metadata.polygon_api_key` | Account tab (same section as Claude/Gemini keys) |
| FRED | Server env var (`FRED_API_KEY`) | Developer config — not user-configurable |

- AV and Polygon keys are per-user, stored in `user_metadata`, accessed server-side in `route.ts` (never returned to client)
- FRED is unlimited/free — one shared server-side key is sufficient
- Account tab: add "Alpha Vantage API Key" and "Polygon.io API Key" fields below Claude/Gemini keys — same glass card, same styling pattern

### Agentic Architecture (D-02)

**Hybrid: Yahoo Finance pre-fetched + all others tool-based**

Yahoo Finance continues to run as a pre-fetch for all 4 modes (existing Phase 6 behavior — market snapshot always injected into Claude context).

All new data sources become Claude `tool_use` definitions:
- Alpha Vantage MCP (`https://mcp.alphavantage.co/mcp?apikey=KEY`) — all AV endpoints as tools
- FRED API endpoints — defined as Claude tools
- Polygon.io endpoints — defined as Claude tools
- Gemini search — refactored from hardcoded calls into a Claude tool for all 4 modes

Claude decides which tools to call based on the user's message. Nothing else is automatic. This is a pure agentic loop: Claude → tool call → result → Claude response.

**Gemini refactor:** Phase 6 hardcoded mode-specific Gemini queries (for market-pulse and strategy-review) are replaced with Claude-driven adaptive search. Claude generates the search query based on context. Gemini search is now available to all 4 modes (Analyze, Chat, Market Pulse, Strategy Review) — Claude uses it when relevant.

### Data Fetch Policy (D-03)

**On-demand only for all new APIs** — Claude calls tools when your message warrants it:
- "What's the RSI on ES?" → Claude calls AV RSI tool for ES
- "What's the macro backdrop?" → Claude calls FRED for Fed funds + treasury yield
- "Show me the ES continuous contract" → Claude calls Polygon for ES1! bars + OI
- "Any news on NQ?" → Claude calls AV NEWS_SENTIMENT for NQ
- No data is fetched proactively without user intent driving it

**Polygon specifically:** fetched only when user asks about a specific instrument in chat. Not proactively fetched on session start.

### Server-Side Caching (D-04)

Cache layer: **Next.js `unstable_cache`** — survives between requests within a deployment, no new dependencies, compatible with Vercel serverless.

Cache keys: per-endpoint + per-symbol (e.g., `av:RSI:ES:daily` as the key)

TTL tiers:
| Data type | TTL | Endpoints |
|-----------|-----|-----------|
| Economic / daily data | 24hr | TREASURY_YIELD, FEDERAL_FUNDS_RATE, TIME_SERIES_DAILY/WEEKLY/MONTHLY |
| Technical indicators + news | 1hr | RSI, MACD, BBANDS, VWAP, NEWS_SENTIMENT, EARNINGS_CALENDAR |
| Market status | 15min | MARKET_STATUS |

Polygon and FRED calls also cached using the same TTL tiers (daily bars = 24hr, macro data = 24hr).

### Rate Limit Handling (D-05)

**Polygon.io free tier: 5 calls/min**

If user asks about multiple symbols simultaneously, queue calls sequentially with 12-second spacing. **Never return an error for rate limits — queue and wait.** The response takes longer; that's acceptable. The UX is "bot is thinking" not "API error."

AV and FRED: no known hard rate limits on free tier beyond the 25 req/day for AV. Caching is the primary defense there.

### Available AV Endpoints (D-06)

All AV endpoints are available as Claude tools via the AV MCP. Key endpoints Claude should know about (from user's confirmed list):

**Market & Status:**
- `MARKET_STATUS` — open/closed/pre-market for US markets
- `TIME_SERIES_DAILY`, `TIME_SERIES_WEEKLY`, `TIME_SERIES_MONTHLY` — OHLCV history

**Technical Indicators (per instrument):**
- `RSI`, `MACD`, `BBANDS`, `VWAP`

**Economic / Macro:**
- `TREASURY_YIELD` — current yield curve
- `FEDERAL_FUNDS_RATE` — current Fed funds rate

**News & Sentiment:**
- `NEWS_SENTIMENT` — news + sentiment for symbols/topics
- `EARNINGS_CALENDAR` — upcoming earnings

**Major Indices:**
- Use TIME_SERIES endpoints for VIX, SPX, NDX, DJI as reference instruments

Claude decides which to call. The planner should include a full endpoint-to-tool-definition mapping.

### FRED Endpoints (D-07)

Key FRED series to expose as Claude tools (free, unlimited):
- `DFF` — Federal Funds Rate (daily)
- `CPIAUCSL` — Consumer Price Index (monthly)
- `PAYEMS` — Nonfarm Payrolls (monthly)
- `UNRATE` — Unemployment Rate (monthly)
- `GDP` — Gross Domestic Product (quarterly)
- `T10Y2Y` — 10-Year minus 2-Year Treasury spread (yield curve inversion signal)
- `VIXCLS` — CBOE VIX close (daily)

### Polygon Endpoints (D-08)

Continuous contracts + historical bars + open interest for CME futures:
- `ES1!` (E-mini S&P 500), `NQ1!` (E-mini Nasdaq), `YM1!` (E-mini Dow)
- `MES1!`, `MNQ1!`, `MYM1!` (Micro futures)
- Data: last 10 daily OHLCV bars + open interest per instrument
- Triggered only when user asks about a specific instrument

### Mode Behavior (D-09)

All 4 modes share the same baseline (Yahoo Finance pre-fetch) and the same tool palette. Claude decides what to call.

| Mode | Pre-fetched (always) | Tools available on-demand |
|------|---------------------|--------------------------|
| Analyze | Yahoo Finance market snapshot | AV, FRED, Polygon, Gemini search |
| Chat | Yahoo Finance market snapshot | AV, FRED, Polygon, Gemini search |
| Market Pulse | Yahoo Finance market snapshot | AV, FRED, Polygon, Gemini search |
| Strategy Review | Yahoo Finance market snapshot | AV, FRED, Polygon, Gemini search |

### Route Architecture (D-10)

No new route files — everything goes in `app/api/coach/route.ts` (existing pattern).

Changes to route.ts:
1. Read `av_api_key` and `polygon_api_key` from Supabase user session (same pattern as `claude_api_key`)
2. Read `FRED_API_KEY` from server env vars
3. Build Claude tool definitions for: AV MCP endpoints, FRED series, Polygon endpoints, Gemini search
4. Pass tools to Claude in the `@anthropic-ai/sdk` call
5. Handle tool_use responses: execute the tool call, return result to Claude, loop until final response
6. Cache tool results via `unstable_cache` with appropriate TTL
7. Remove hardcoded Gemini mode-specific queries; replace with Gemini-as-tool

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 6 — existing infrastructure to build on
- `.planning/phases/06-ai-coach-enhancement-3-api-infrastructure-memory/06-CONTEXT.md` — Phase 6 locked decisions (D-01 through D-15): API routing, Claude/Gemini/Yahoo Finance patterns, memory architecture, Account tab key storage pattern
- `app/api/coach/route.ts` — Current route implementation (Claude + Gemini + Yahoo Finance multi-provider routing, VIOLATIONS parsing, memory computation)
- `app/components/tabs/Account.tsx` — Existing API key fields (Claude + Gemini pattern to extend for AV + Polygon)

### External API documentation
- Alpha Vantage MCP: `https://mcp.alphavantage.co/mcp` — remote MCP exposing all AV endpoints as Claude tools
- Alpha Vantage REST docs: `https://www.alphavantage.co/documentation/` — full endpoint reference
- FRED API: `https://fred.stlouisfed.org/docs/api/fred/` — series IDs and request format
- Polygon.io docs: `https://polygon.io/docs/options/getting-started` — continuous contracts and futures endpoints

### Project design system
- `CLAUDE.md` — Design system tokens, development rules, localStorage key names
- `.planning/codebase/INTEGRATIONS.md` — Current integration inventory (Yahoo Finance, Supabase, Claude, Gemini)
- `.planning/codebase/ARCHITECTURE.md` — Route architecture, data flow patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/api/coach/route.ts`: Multi-provider routing (Claude + Gemini + Yahoo Finance) already implemented. Phase 7 adds more providers using the same per-call pattern.
- `app/components/tabs/Account.tsx`: API key field components + `user_metadata` read/write pattern. Extend with 2 more key fields using identical pattern.
- `next.config.ts`: Location to configure `unstable_cache` if any custom fetch config needed.

### Established Patterns
- **API key storage**: `user_metadata` via Supabase, read server-side in route.ts from session — `av_api_key` and `polygon_api_key` follow `claude_api_key` pattern exactly.
- **Tool-use loop**: `@anthropic-ai/sdk` supports multi-turn tool_use; route.ts needs to handle the agentic loop (call Claude → get tool_use → execute tool → call Claude again with result → repeat until final response).
- **Yahoo Finance pre-fetch**: `fetchFuturesSnapshot(watchlistSymbols)` in marketData.ts — no changes needed here, continues as-is.
- **Graceful degradation**: Phase 6 pattern — if any provider fails, Claude proceeds with remaining context. Same pattern applies to AV/FRED/Polygon tool failures.
- **Fire-and-forget memory**: `supabase.auth.updateUser` for memory writes — no changes to this pattern.

### Integration Points
- `app/api/coach/route.ts`: Primary file for all changes — add tool definitions, agentic loop, caching, new key reads
- `app/components/tabs/Account.tsx`: Add 2 API key fields (AV + Polygon)
- `.env.local` + Vercel env vars: Add `FRED_API_KEY`
- `package.json`: Evaluate if any new packages needed for Polygon or FRED clients (may be plain `fetch` calls)

</code_context>

<specifics>
## Specific Ideas

- **Polygon rate limit UX**: When multiple Polygon calls are queued, Claude's response just takes longer — no error messages, no partial responses. The user's preference is patience over error messages.
- **Gemini adaptive search**: Claude generates the Gemini search query based on the user's message + trade context. No hardcoded query strings. Gemini is just a web search tool — Claude decides when to use it and what to ask.
- **AV on-demand examples**: "What's the RSI on ES?" triggers AV RSI tool call. "What's the macro backdrop?" triggers FRED + AV TREASURY_YIELD/FEDERAL_FUNDS_RATE calls. "Any news on NQ?" triggers AV NEWS_SENTIMENT for NQ.
- **Phase 6 Gemini refactor**: The hardcoded `market-pulse` and `strategy-review` Gemini queries in route.ts are removed. Gemini becomes a `tool_use` definition available to all 4 modes, with Claude generating the search query adaptively.

</specifics>

<deferred>
## Deferred Ideas

- **Chat typing/loading animation** — animated dots in the coach chat bubble while waiting for multi-API responses. Deferred to a future UI/UX polish phase (the user has many minor graphical tweaks planned toward end of the build process).
- **Offline queue / retry** — queuing failed API calls for retry. Deferred (current pattern: graceful skip, Claude proceeds without the data).
- **Streaming responses** — streaming Claude's response token-by-token to reduce perceived latency. Deferred to UI polish phase.

</deferred>

---

*Phase: 7-market-data-api-infrastructure*
*Context gathered: 2026-05-06*
