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

**Pure tool-based: all data sources are Claude tools. Claude is the hub.**

Yahoo Finance is no longer pre-fetched. It becomes a tool like all other data sources — Claude calls it when the user's message warrants market data. Nothing is automatic.

All data sources are Claude `tool_use` definitions:
- Yahoo Finance (`fetchFuturesSnapshot`) — existing marketData.ts helper, wrapped as a tool
- Alpha Vantage MCP (`https://mcp.alphavantage.co/mcp?apikey=KEY`) — all AV endpoints as tools
- FRED API endpoints — defined as Claude tools
- Polygon.io endpoints — defined as Claude tools
- Gemini search — refactored from hardcoded calls into a Claude tool for all 4 modes

Claude decides which tools to call based on the user's message. Nothing is pre-fetched. This is a pure agentic loop: Claude → tool call → result → Claude response.

**Gemini refactor:** Phase 6 hardcoded mode-specific Gemini queries (for market-pulse and strategy-review) are replaced with Claude-driven adaptive search. Claude generates the search query based on context. Gemini search is now available to all 4 modes (Analyze, Chat, Market Pulse, Strategy Review) — Claude uses it when relevant.

**Historical coaching memory (from Phase 6) is unchanged.** Session index, temporal sampling (buildCoachingContextSelection), behavior ledger, milestone log, streaks, journal memory, weekly/monthly summaries — all continue exactly as Phase 6 designed. Phase 7 adds tool-based market data alongside this existing memory system.

### Data Fetch Policy (D-03)

**On-demand only for all new APIs** — Claude calls tools when your message warrants it:
- "What's the RSI on ES?" → Claude calls AV RSI tool for ES
- "What's the macro backdrop?" → Claude calls FRED for Fed funds + treasury yield
- "Show me the ES continuous contract" → Claude calls Polygon for ES1! bars + OI
- "Any news on NQ?" → Claude calls AV NEWS_SENTIMENT for NQ
- No data is fetched proactively without user intent driving it

**Polygon specifically:** fetched only when user asks about a specific instrument in chat. Not proactively fetched on session start.

### Two-Store Architecture (D-04)

The coach has exactly two places to store data — they serve different purposes and must never be conflated:

**Store 1 — Historical Coaching Store (Supabase `user_metadata`)**
- What: session index, behavior ledger, milestone log, streaks, journal memory, weekly/monthly summaries
- Lifespan: permanent — persists across sessions, devices, and browser clears
- Purpose: coaching memory — the coach's long-term knowledge of the trader
- Managed by: Phase 6 system (unchanged in Phase 7)
- Injected into: Claude's system prompt on every call (not a tool call — always present)
- Written by: **server-side Supabase write** (see D-06 — data integrity)

**Store 2 — Daily Market Cache (Next.js `unstable_cache`)**
- What: API responses — prices, technical indicators, news, economic data, futures bars
- Lifespan: maximum 24hr — all cache entries expire within 24hr, no exceptions
- Purpose: deduplication — prevent redundant API calls for the same data within a day
- Managed by: Phase 7 tool call wrapper layer
- Injected into: Claude's context only when Claude calls the relevant tool
- Long-term persistence: NONE — anything that must survive past 24hr must be written to Store 1

These two stores are independent. Cache expiring does not affect coaching memory. Coaching memory updates do not touch the market cache. Nothing lives in cache longer than 24hr.

### Server-Side Cache Design (D-05)

Cache layer: **Next.js `unstable_cache`** — no new dependencies, compatible with Vercel serverless.

**Cache keys:** per-source + per-endpoint + per-symbol + per-timeframe
Examples: `av:RSI:ES:daily`, `fred:DFF`, `polygon:ES1!:bars:10d`, `yf:snapshot:ES,NQ`

**Cache philosophy:** Pure TTL-based. Claude calls the tool — the tool layer handles cache lookup, API call if needed, cache write. Claude never knows whether data came from cache or a live fetch.

**No change-detection.** TTL IS the staleness signal. No proactive polling or "has this changed?" checks — that would require an API call to check, defeating the cache.

**TTL strategy — differentiated by API budget:**

| Data source | TTL | Write policy | Rationale |
|-------------|-----|-------------|-----------|
| Alpha Vantage | EOD (market close 4 PM ET) | Once per EOD window | AV updates at NYSE close. Budget is capped (25 req/day per key). Cache once, serve all day. |
| Polygon.io | EOD (market close 4 PM ET) | Once per EOD window | Polygon CME futures bars update at session close. Same budget logic. |
| Yahoo Finance | 24hr hard expiry | **Write on every tool call** | Uncapped — no reason to conserve calls. Always holds the freshest fetch. |
| FRED API | 24hr hard expiry | **Write on every tool call** | Uncapped, unlimited. FRED data is slow-moving but always write fresh when called. |
| AV MARKET_STATUS | 15min | Standard TTL-based | Open/closed/pre-market changes intraday — needs more frequent refresh than EOD. |

**EOD boundary:** 4:00 PM US/Eastern on NYSE trading days. On weekends/holidays, EOD cache from Friday close remains valid until Monday 4 PM ET (no new data to fetch).

**Result:** AV and Polygon — each distinct endpoint+symbol called at most once per trading day. Yahoo Finance and FRED — always fresh on each call, no call conservation needed.

### Data Integrity on Interruption (D-06)

**Server writes memory to Supabase directly — client never handles memory persistence.**

In Phase 6, memory updates (behavior ledger, streaks, milestones, session index, weekly/monthly summaries) were returned in the API response and written to Supabase by the client. If the network drops between server response and client write, the update is lost.

**Phase 7 fixes this:** `route.ts` writes all memory updates to Supabase directly on the server before sending the response to the client. The client only needs to re-fetch state on next mount — it never writes memory itself. Memory updates are atomic at the server level.

Implementation:
- After computing memory updates (VIOLATIONS parse, streak compute, weekly/monthly summaries), call `supabase.auth.admin.updateUserById(userId, { user_metadata: {...} })` server-side using the Supabase service role key
- The client response still includes the updated memory fields so the UI can update without a round-trip, but these are now "confirmations" of what's already persisted — not the write itself
- If the server Supabase write fails, the route returns a 500 — the client shows an error and the user can retry. No silent data loss.

**New env vars required:**
- `SUPABASE_SERVICE_ROLE_KEY` — server-only service role key for direct Supabase writes from route.ts
- `FRED_API_KEY` — server-only FRED API key

### Rate Limit and Error Handling (D-07)

**Data API rate limits (Polygon 5/min, AV throttle) → queue silently, no user notification.**

These are infrastructure concerns the user never needs to see. Tool wrapper queues and retries; response takes longer; that's acceptable.

**AI provider rate limits (Claude, Gemini) → show a visible notification box.**

When Claude or Gemini hits a rate limit, display a UI notification box that explains what's happening. The user should know why their coach isn't responding, not just see a spinner.

Notification box content:
- **Claude rate limit:** "Claude is at capacity — your request is queued and will resume shortly."
- **Gemini rate limit:** "Gemini search is rate-limited — queued for retry. Coach will respond once search completes."
- Box dismisses automatically when the request completes or the user can dismiss manually.

**Error surface policy:**
| Error type | Behavior |
|------------|---------|
| Data API rate limit (429) | Silent queue + retry |
| AI provider rate limit (Claude/Gemini 429) | Visible notification box |
| Invalid API key (401/403) | Visible error — "Check Account settings" |
| API server error (500/503, persistent after 1 retry) | Visible error + Claude degrades gracefully |
| Network timeout (after 1 retry) | Visible error + Claude proceeds without that data |
| Cache miss + successful fetch | Transparent — no notification |

**Graceful degradation:** On any real data API error after retry, Claude proceeds with whatever context it has. The failure is noted in Claude's context so it can acknowledge the gap if the user asks about it.

### Available AV Endpoints (D-07)

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

### FRED Endpoints (D-08)

Key FRED series to expose as Claude tools (free, unlimited):
- `DFF` — Federal Funds Rate (daily)
- `CPIAUCSL` — Consumer Price Index (monthly)
- `PAYEMS` — Nonfarm Payrolls (monthly)
- `UNRATE` — Unemployment Rate (monthly)
- `GDP` — Gross Domestic Product (quarterly)
- `T10Y2Y` — 10-Year minus 2-Year Treasury spread (yield curve inversion signal)
- `VIXCLS` — CBOE VIX close (daily)

### Polygon Endpoints (D-09)

Continuous contracts + historical bars + open interest for CME futures:
- `ES1!` (E-mini S&P 500), `NQ1!` (E-mini Nasdaq), `YM1!` (E-mini Dow)
- `MES1!`, `MNQ1!`, `MYM1!` (Micro futures)
- Data: last 10 daily OHLCV bars + open interest per instrument
- Triggered only when user asks about a specific instrument

### Mode Behavior (D-10)

All 4 modes share the same tool palette. Nothing is pre-fetched. Claude decides what to call based on the user's message.

| Mode | Pre-fetched | Tools available on-demand |
|------|-------------|--------------------------|
| Analyze | — | Yahoo Finance, AV, FRED, Polygon, Gemini search |
| Chat | — | Yahoo Finance, AV, FRED, Polygon, Gemini search |
| Market Pulse | — | Yahoo Finance, AV, FRED, Polygon, Gemini search |
| Strategy Review | — | Yahoo Finance, AV, FRED, Polygon, Gemini search |

Claude's coaching memory (session index, behavior ledger, milestone log, streaks, journal memory, weekly/monthly summaries) continues to be injected into the system context on every call — this is not market data and is not affected by the tool-based architecture change.

### Route Architecture (D-11)

No new route files — everything goes in `app/api/coach/route.ts` (existing pattern).

Changes to route.ts:
1. Read `av_api_key` and `polygon_api_key` from Supabase user session (same as `claude_api_key` pattern)
2. Read `FRED_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` from server env vars
3. Build Claude tool definitions for: Yahoo Finance (wrap `fetchFuturesSnapshot`), AV MCP endpoints, FRED series, Polygon endpoints, Gemini search
4. Remove the Yahoo Finance unconditional pre-fetch — no longer called on every request
5. Pass all tools to Claude alongside existing memory context in system prompt
6. Handle tool_use agentic loop: execute tool call → check cache → fetch on miss → write cache → return result → loop until final `stop_reason: "end_turn"`
7. Remove hardcoded Gemini mode-specific queries; replace with Gemini-as-tool (adaptive)
8. After final response: compute memory updates → **write to Supabase server-side** via service role key → include updated fields in response as UI confirmation (not as write instruction)
9. The memory context (session index, behavior ledger, streaks, journal memory, etc.) continues to be injected into the system prompt directly on every call — NOT a tool call

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 6 — existing infrastructure to build on
- `.planning/phases/06-ai-coach-enhancement-3-api-infrastructure-memory/06-CONTEXT.md` — Phase 6 locked decisions (D-01 through D-15): API routing, Claude/Gemini/Yahoo Finance patterns, memory architecture, Account tab key storage pattern
- `app/api/coach/route.ts` — Current route implementation (Claude + Gemini + Yahoo Finance multi-provider routing, VIOLATIONS parsing, memory computation)
- `app/components/tabs/Account.tsx` — Existing API key fields (Claude + Gemini pattern to extend for AV + Polygon)
- `app/components/tabs/Coach.tsx` — Rate limit notification box UI (new component for Claude/Gemini limit events; must integrate with existing ChatView)

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
- **Yahoo Finance tool**: `fetchFuturesSnapshot(watchlistSymbols)` in marketData.ts — wrap this existing helper as a Claude tool definition. Remove the unconditional pre-fetch call in route.ts.
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
