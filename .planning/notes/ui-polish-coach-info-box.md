# UI Polish Note: Coach Page "Your Training Coach" Info Box

**Captured:** 2026-05-06
**For:** Future UI polish phase (post Phase 7)

## Change Required

The "Your training coach" explanation box in the Coach tab needs to be redesigned as a **3-tab panel**:

### Tab 1: Commands
- Remove the "type anything" bullet point (self-evident)
- List every named command/mode the coach understands:
  - `/analyze` — deep analysis of recent trades against your strategy rules
  - `/market` or Market Pulse mode — current macro + instrument context
  - `/strategy` or Strategy Review mode — review your strategy against current conditions
  - `/chat` — open-ended conversation about trading
  - Any shorthand triggers discovered during build (e.g., asking about specific instruments, R-mult patterns, etc.)
- Goal: show users the coach is more capable than a generic chatbot

### Tab 2: Memory
- Visual diagram or clear explanation showing the 3 memory tiers:
  1. **Active (in-session)** — what Claude knows from this conversation right now
  2. **Passive (always-on)** — injected on every call: behavior ledger, streak data, pattern summary, milestone log, journal memory, weekly/monthly summaries
  3. **On-demand** — market data tools Claude calls when your message warrants it (AV, FRED, Polygon, Gemini search)
- Emphasize what makes this different from generic AI: it knows your trading history, your specific violation patterns, your win/loss streaks, and adapts its coaching to your behavioral profile
- Keep it concise — surprise the user, don't overwhelm them

### Tab 3: AI Stack
- Show all the APIs and tools Claude can use:
  - Claude Sonnet 4.x — primary reasoning and coaching
  - Gemini 2.5 Flash — web search grounding (live market news, strategy research)
  - Yahoo Finance — real-time futures snapshot (ES, NQ, MES, MNQ, YM, MYM)
  - Alpha Vantage — technical indicators (RSI, MACD, BBANDS, VWAP), time series, news sentiment, earnings calendar, treasury yields
  - FRED API — macro economic data (Fed funds rate, CPI, NFP, unemployment, GDP, yield curve, VIX)
  - Polygon.io — CME futures continuous contracts (ES1!, NQ1!, YM1!, micro contracts), historical bars, open interest
- Design goal: make users realize this is a serious multi-source intelligence system, not a chatbot wrapper
- Use logos or clean icon rows if space permits

## Design Notes
- The 3-tab treatment fits the glass card pattern already used in the app
- Tab labels should be short: "Commands" / "Memory" / "AI Stack"
- Each tab content should be skimmable in 15 seconds — this is a discovery moment, not documentation
- The "surprise factor" should come from the AI Stack tab — show the full depth of what's wired up
