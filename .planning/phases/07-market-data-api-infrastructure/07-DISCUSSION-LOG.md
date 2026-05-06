# Phase 7: Market Data API Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-06
**Phase:** 7-market-data-api-infrastructure
**Areas discussed:** API key strategy, Cache layer design, Mode-to-data mapping, Polygon vs Yahoo Finance scope, AV endpoint selection

---

## API Key Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Server env var — shared key | One AV key in .env.local / Vercel. All users share the 25 req/day budget. | |
| Per-user in Account tab | Each user enters their own AV key alongside Claude/Gemini keys. | ✓ |
| Both — server fallback | Per-user key if set, fall back to server env key. | |

**User's choice:** Per-user in Account tab for AV. FRED server-side only. Polygon per-user in Account tab.

**Notes:** AV and Polygon both go in Account tab same section as Claude/Gemini keys. Stored in user_metadata as `av_api_key` and `polygon_api_key`. FRED is free/unlimited — shared server key makes sense.

---

## Cache Layer Design

| Option | Description | Selected |
|--------|-------------|----------|
| Next.js unstable_cache | Built-in, survives requests within deployment, no new deps. | ✓ |
| In-memory Map | Fast but resets on cold starts — risky on Vercel. | |
| Upstash Redis | True persistent cache across instances, but adds new service. | |

**User's choice:** Next.js unstable_cache.

**TTL discussion:**
- User asked whether custom-TTL-per-endpoint means more API calls → explained it doesn't inherently, only if shorter TTLs are set
- Settled on 3-tier TTL: 24hr (economic/daily), 1hr (technical/news), 15min (market status)

**Fetch mode discussion:**
- User wanted ability to ask for specific timeframes during a session (not just latest data)
- Led to AV MCP tool discussion — Claude can call AV on-demand for specific timeframes
- Settled on: REST pre-fetch (standard snapshot) + AV MCP tools (on-demand by Claude)

**Notes:** The final architecture shift (Area 5 discussion) changed "REST pre-fetch" to "Yahoo Finance only pre-fetched; all others tool-based." Cache still applies to all tool call results via unstable_cache.

---

## Mode-to-Data Mapping

| Option | Description | Selected |
|--------|-------------|----------|
| Market Pulse + Analyze only | AV data only for market-heavy modes. | |
| All 4 modes get full AV data | Every mode gets complete snapshot. | ✓ |
| Market Pulse only | Only Market Pulse is market-aware. | |

**User's choice:** All 4 modes. "I want it to be one big system."

**Notes:** User asked about current infrastructure SOP — explained Yahoo Finance is already all-modes in Phase 6. With caching, all-modes AV data is feasible (1 AV call per endpoint per TTL window, not 1 per session). User also requested Gemini be enabled in all 4 modes (previously only market-pulse and strategy-review in Phase 6). Gemini to use adaptive queries (Claude picks the search query based on context).

---

## Polygon vs Yahoo Finance Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Continuous contracts + open interest | ES1!/NQ1!/YM1! continuous contracts + OI. | |
| Historical OHLCV + volume profile bars | Last N daily bars with CME volume. | |
| Both | Continuous contracts + historical bars + OI. | ✓ |

**User's choice:** Both — continuous contracts + historical bars.

**Notes on fetch policy:** User specified Polygon should ONLY be fetched when a specific instrument is explicitly asked about in chat. Not proactively fetched. Rate limit (5 calls/min) handled by queuing — never return errors, just delay. "I'd rather the bot take longer to respond than give error messages."

User also mentioned: watchlist status requests will be parsed into sections; expects to ask one symbol at a time but wants worst-case handled.

Typing animation (loading bubble) mentioned here — deferred to future UI polish phase.

---

## AV Endpoint Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Always-on pre-fetch for specific endpoints | Select subset to pre-fetch every call. | |
| All on-demand based on user message | Claude decides what to call; nothing automatic. | ✓ |

**User's choice:** Everything on-demand. "Claude should determine whether to interact with the gemini, yahoo finance, polygon API, alpha vantage MCP, alpha vantage API, or fred API based on my prompts/responses. For APIs, nothing is automatic or routine."

**Architecture resolution:** Settled on hybrid — Yahoo Finance stays pre-fetched (Phase 6 baseline, all modes, unchanged). All other sources become Claude tool_use definitions. Claude decides what to call based on user's message.

**Gemini refactor confirmed:** Phase 6's hardcoded market-pulse / strategy-review Gemini queries will be replaced in Phase 7 with Claude-driven adaptive search, available to all 4 modes.

---

## Claude's Discretion

- Exact tool definitions and parameter schemas for AV MCP → planner determines from AV MCP docs
- Which FRED series to expose as tools beyond the confirmed list (DFF, CPIAUCSL, PAYEMS, UNRATE, GDP, T10Y2Y, VIXCLS) → planner may add more
- Exact Anthropic SDK agentic loop implementation (tool_use → execute → loop) → planner decides approach

---

## Deferred Ideas

- **Chat typing/loading animation** — animated dots in bot chat bubble while waiting for multi-API tool calls. User said there will be many minor graphical tweaks toward end of build process — defer to UI polish phase.
- **Streaming responses** — token-by-token streaming to reduce perceived latency. Defer to UI polish.
- **Offline retry queue** — queue and retry failed API calls. Deferred.
