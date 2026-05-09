import { NextRequest, NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@/lib/supabase/server"
import { fetchFuturesSnapshot } from "@/app/lib/marketData"
import type { BehaviorLedger, MilestoneLog, Streaks, SessionIndexEntry, WeeklySummary, MonthlySummary } from "@/app/lib/types"
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"

const supabaseAdmin = createSupabaseAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

function getTradingDayKey(): string {
  const now = new Date()
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }))
  const day = et.getDay()
  if (day === 0) et.setDate(et.getDate() - 2)
  if (day === 6) et.setDate(et.getDate() - 1)
  return et.toISOString().split("T")[0]
}

async function fetchFREDSeries(seriesId: string): Promise<string> {
  const apiKey = process.env.FRED_API_KEY
  if (!apiKey) return `[FRED ${seriesId}: no FRED_API_KEY configured]`
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${encodeURIComponent(seriesId)}&api_key=${encodeURIComponent(apiKey)}&file_type=json&sort_order=desc&limit=5`
  try {
    const res = await fetch(url)
    if (!res.ok) {
      if (res.status === 429) return `[FRED ${seriesId}: rate limited]`
      return `[FRED ${seriesId}: HTTP ${res.status}]`
    }
    const data = await res.json() as { observations: Array<{ date: string; value: string }> }
    const obs = data.observations.filter(o => o.value !== ".").slice(0, 3)
    if (obs.length === 0) return `[FRED ${seriesId}: no data]`
    return `${seriesId}: ${obs.map(o => `${o.date}=${o.value}`).join(", ")}`
  } catch {
    return `[FRED ${seriesId}: fetch failed]`
  }
}

async function fetchPolygonFutures(symbol: string, apiKey: string): Promise<string> {
  // Wave 0 (.planning/phases/07-market-data-api-infrastructure/07-01-WAVE0-LOG.md): polygon_tier = full
  try {
    const lookupUrl = `https://api.polygon.io/v3/reference/tickers?market=futures&active=true&search=${encodeURIComponent(symbol)}&limit=1&apiKey=${encodeURIComponent(apiKey)}`
    const lookupRes = await fetch(lookupUrl)
    if (lookupRes.status === 403) return `[Polygon ${symbol}: futures requires plan upgrade]`
    if (!lookupRes.ok) return `[Polygon ${symbol}: HTTP ${lookupRes.status}]`
    const lookupData = await lookupRes.json() as { results?: Array<{ ticker: string }> }
    const ticker = lookupData.results?.[0]?.ticker
    if (!ticker) return `[Polygon ${symbol}: no active contract found]`

    const today = new Date().toISOString().split("T")[0]
    const start = new Date(Date.now() - 30 * 86400_000).toISOString().split("T")[0]
    const aggUrl = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/day/${start}/${today}?adjusted=true&sort=desc&limit=10&apiKey=${encodeURIComponent(apiKey)}`
    const aggRes = await fetch(aggUrl)
    if (aggRes.status === 403) return `[Polygon ${symbol}: futures requires plan upgrade]`
    if (!aggRes.ok) return `[Polygon ${symbol}: HTTP ${aggRes.status}]`
    const aggData = await aggRes.json() as { results?: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }> }
    const bars = aggData.results ?? []
    if (bars.length === 0) return `[Polygon ${symbol}: no recent bars]`
    const formatted = bars.slice(0, 10).map(b => {
      const d = new Date(b.t).toISOString().split("T")[0]
      return `${d} O=${b.o} H=${b.h} L=${b.l} C=${b.c} V=${b.v}`
    }).join(" | ")
    return `${symbol} (${ticker}) last ${bars.length} bars: ${formatted}`
  } catch {
    return `[Polygon ${symbol}: fetch failed]`
  }
}

async function fetchAlphaVantage(fn: string, symbol: string, apiKey: string): Promise<string> {
  let url: string
  if (fn === "RSI") {
    url = `https://www.alphavantage.co/query?function=RSI&symbol=${encodeURIComponent(symbol)}&interval=daily&time_period=14&series_type=close&apikey=${encodeURIComponent(apiKey)}`
  } else if (fn === "MACD") {
    url = `https://www.alphavantage.co/query?function=MACD&symbol=${encodeURIComponent(symbol)}&interval=daily&series_type=close&apikey=${encodeURIComponent(apiKey)}`
  } else if (fn === "NEWS_SENTIMENT") {
    url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${encodeURIComponent(symbol)}&limit=5&apikey=${encodeURIComponent(apiKey)}`
  } else {
    return `[AlphaVantage: unsupported function '${fn}']`
  }
  try {
    const res = await fetch(url)
    if (!res.ok) {
      if (res.status === 429) return `[AlphaVantage: rate limited]`
      return `[AlphaVantage: HTTP ${res.status}]`
    }
    const data = await res.json() as Record<string, unknown>
    if (data["Note"]) return `[AlphaVantage: rate limited — free tier cap reached]`
    if (data["Information"]) return `[AlphaVantage: ${String(data["Information"]).slice(0, 100)}]`
    if (fn === "RSI") {
      const series = data["Technical Analysis: RSI"] as Record<string, { RSI: string }> | undefined
      if (!series) return `[AlphaVantage RSI: no data for ${symbol}]`
      const entries = Object.entries(series).slice(0, 5)
      return `${symbol} RSI(14) daily: ` + entries.map(([d, v]) => `${d}=${parseFloat(v.RSI).toFixed(2)}`).join(", ")
    }
    if (fn === "MACD") {
      const series = data["Technical Analysis: MACD"] as Record<string, { MACD: string; MACD_Signal: string; MACD_Hist: string }> | undefined
      if (!series) return `[AlphaVantage MACD: no data for ${symbol}]`
      const entries = Object.entries(series).slice(0, 3)
      return `${symbol} MACD(12,26,9) daily: ` + entries.map(([d, v]) => `${d} M=${parseFloat(v.MACD).toFixed(4)} S=${parseFloat(v.MACD_Signal).toFixed(4)} H=${parseFloat(v.MACD_Hist).toFixed(4)}`).join(" | ")
    }
    if (fn === "NEWS_SENTIMENT") {
      const feed = data["feed"] as Array<{ title: string; overall_sentiment_label: string }> | undefined
      if (!feed || feed.length === 0) return `[AlphaVantage NEWS: no articles for ${symbol}]`
      return `${symbol} news (top ${Math.min(feed.length, 5)}): ` + feed.slice(0, 5).map(a => `[${a.overall_sentiment_label}] ${a.title.slice(0, 80)}`).join(" | ")
    }
    return `[AlphaVantage: unhandled response]`
  } catch {
    return `[AlphaVantage ${fn}: fetch failed]`
  }
}

async function fetchGeminiSearch(query: string, geminiApiKey: string): Promise<string> {
  try {
    const genAI = new GoogleGenAI({ apiKey: geminiApiKey })
    const res = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: query,
      config: {
        tools: [{ googleSearch: {} }],
      },
    })
    return res.text?.trim() ?? "[Gemini search: empty response]"
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
      throw new Error("GEMINI_RATE_LIMIT")
    }
    if (msg.includes("401") || msg.includes("403") || msg.includes("API_KEY")) {
      throw new Error("GEMINI_INVALID_KEY")
    }
    return "[Gemini search: failed]"
  }
}


const AV_DAILY_CAP = 25
const AV_CACHE_TTL_MS = 60 * 60 * 1000
const avCache = new Map<string, { value: string; expiresAt: number }>()

const POLYGON_PER_MIN_CAP = 5
const POLYGON_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const polygonCache = new Map<string, { value: string; expiresAt: number }>()
const polygonReqWindow: number[] = []

const GEMINI_DAILY_CAP = 500
const GEMINI_PER_MIN_CAP = 5
const geminiReqWindow: number[] = []

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

async function fetchPolygonWithCounter(symbol: string, apiKey: string): Promise<string> {
  const cached = polygonCache.get(symbol)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  const cutoff = Date.now() - 60_000
  while (polygonReqWindow.length && polygonReqWindow[0] < cutoff) {
    polygonReqWindow.shift()
  }
  if (polygonReqWindow.length >= POLYGON_PER_MIN_CAP) {
    const oldestAge = Math.ceil((60_000 - (Date.now() - polygonReqWindow[0])) / 1000)
    return `[Polygon: rate limit (${POLYGON_PER_MIN_CAP}/min, free tier) — wait ${oldestAge}s and retry]`
  }
  polygonReqWindow.push(Date.now())

  const result = await fetchPolygonFutures(symbol, apiKey)
  polygonCache.set(symbol, { value: result, expiresAt: Date.now() + POLYGON_CACHE_TTL_MS })
  return result
}

async function fetchGeminiWithCounter(
  query: string,
  apiKey: string,
  geminiUsage: { date: string; count: number },
): Promise<string> {
  const today = todayUTC()
  if (geminiUsage.date !== today) {
    geminiUsage.date = today
    geminiUsage.count = 0
  }
  if (geminiUsage.count >= GEMINI_DAILY_CAP) {
    return `[Gemini: daily cap reached (${GEMINI_DAILY_CAP}/day, free tier 2.5 Flash) — resets 00:00 UTC]`
  }

  const cutoff = Date.now() - 60_000
  while (geminiReqWindow.length && geminiReqWindow[0] < cutoff) {
    geminiReqWindow.shift()
  }
  if (geminiReqWindow.length >= GEMINI_PER_MIN_CAP) {
    const oldestAge = Math.ceil((60_000 - (Date.now() - geminiReqWindow[0])) / 1000)
    return `[Gemini: rate limit (${GEMINI_PER_MIN_CAP}/min, free tier 2.5 Flash) — wait ${oldestAge}s and retry]`
  }
  geminiReqWindow.push(Date.now())

  geminiUsage.count++
  return await fetchGeminiSearch(query, apiKey)
}

async function fetchAlphaVantageWithCounter(
  fn: string,
  symbol: string,
  apiKey: string,
  avUsage: { date: string; count: number },
): Promise<string> {
  const today = todayUTC()
  if (avUsage.date !== today) {
    avUsage.date = today
    avUsage.count = 0
  }

  const key = `${fn}|${symbol}`
  const cached = avCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  if (avUsage.count >= AV_DAILY_CAP) {
    return `[AlphaVantage: daily cap reached (${AV_DAILY_CAP} req/day) — resets 00:00 UTC]`
  }
  avUsage.count++

  const result = await fetchAlphaVantage(fn, symbol, apiKey)
  avCache.set(key, { value: result, expiresAt: Date.now() + AV_CACHE_TTL_MS })
  return result
}

const localTools: Anthropic.Tool[] = [
  {
    name: "fetchYahooFinanceSnapshot",
    description: "Fetch live market quotes via Yahoo Finance (~15 min delay). Supports any valid ticker: futures (ES, NQ, YM, MES, MNQ), ETFs (SPY, QQQ, DIA, IWM), stocks (AAPL, NVDA, etc.), crypto (BTC-USD), forex (EURUSD=X), indices (^VIX, ^GSPC). Pass an empty array to get the default ES/NQ/YM/RTY futures snapshot. Use whenever the user asks about price, level, or market condition for any instrument.",
    input_schema: {
      type: "object" as const,
      properties: {
        symbols: {
          type: "array",
          items: { type: "string" },
          description: "Ticker symbols to quote. Use Yahoo Finance format: futures roots (ES, NQ), ETF tickers (SPY, QQQ), stock tickers (AAPL), or pass [] for the default core futures snapshot."
        }
      },
      required: []
    }
  },
  {
    name: "fetchFREDSeries",
    description: "Fetch the latest 3 observations for a FRED economic series. Use for macro context: DFF (Fed funds rate), CPIAUCSL (CPI), PAYEMS (nonfarm payrolls), UNRATE (unemployment), GDP, T10Y2Y (10Y-2Y yield curve), VIXCLS (VIX close).",
    input_schema: {
      type: "object" as const,
      properties: {
        series_id: {
          type: "string",
          enum: ["DFF", "CPIAUCSL", "PAYEMS", "UNRATE", "GDP", "T10Y2Y", "VIXCLS"],
          description: "FRED series ID. Must be one of the seven supported macro series."
        }
      },
      required: ["series_id"]
    }
  },
  {
    name: "fetchPolygonFutures",
    description: "Fetch CME futures historical bars (last ~10 daily OHLCV) for a specific contract. Only call when the user asks about a specific futures instrument by name — do not call speculatively.",
    input_schema: {
      type: "object" as const,
      properties: {
        symbol: {
          type: "string",
          enum: ["ES", "NQ", "YM", "MES", "MNQ", "MYM"],
          description: "CME futures root symbol. Returns the active front-month contract's last 10 daily bars."
        }
      },
      required: ["symbol"]
    }
  },
  {
    name: "fetchAlphaVantage",
    description: "Fetch technical indicators or news sentiment for a symbol via Alpha Vantage. Use RSI and MACD for equity/ETF proxies of the user's instruments (SPY=ES, QQQ=NQ, DIA=YM). Use NEWS_SENTIMENT for sentiment analysis on a ticker or index ETF.",
    input_schema: {
      type: "object" as const,
      properties: {
        function: {
          type: "string",
          enum: ["RSI", "MACD", "NEWS_SENTIMENT"],
          description: "RSI — 14-period daily RSI (last 5 values). MACD — daily MACD(12,26,9) (last 3 values). NEWS_SENTIMENT — top 5 recent news articles with sentiment label."
        },
        symbol: {
          type: "string",
          description: "Ticker symbol. For index futures use ETF proxies: SPY (ES/MES), QQQ (NQ/MNQ), DIA (YM/MYM). Accepts any valid equity or ETF ticker."
        }
      },
      required: ["function", "symbol"]
    }
  },
  {
    name: "searchGemini",
    description: "Perform a web search for current market news, strategy research, economic events, or trader-facing information. Generate the search query adaptively based on the user's question and trading context. Examples: 'latest CPI release reaction ES futures', 'FOMC meeting outcome September 2026', 'breakout pattern false signal recent research'.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "The search query to execute. Be specific — include date references and instrument names where relevant."
        }
      },
      required: ["query"]
    }
  }
]

type ToolDeps = {
  polygonApiKey?: string
  geminiApiKey?: string
  avApiKey?: string
  watchlist: string[]
  polygonTier?: "full" | "forbidden" | "endpoint_unknown"
  avUsage: { date: string; count: number }
  geminiUsage: { date: string; count: number }
}

async function executeToolCall(
  block: Anthropic.ToolUseBlock,
  deps: ToolDeps
): Promise<{ toolUseId: string; result: string }> {
  const { name, id, input } = block
  const inp = (input ?? {}) as Record<string, unknown>
  try {
    switch (name) {
      case "fetchYahooFinanceSnapshot": {
        const passed = Array.isArray(inp.symbols) ? (inp.symbols as string[]) : []
        const symbols = passed.length > 0 ? passed : deps.watchlist
        const result = await fetchFuturesSnapshot(symbols)
        return { toolUseId: id, result: result || "[Yahoo Finance: no data available]" }
      }
      case "fetchFREDSeries": {
        const seriesId = String(inp.series_id ?? "")
        if (!["DFF", "CPIAUCSL", "PAYEMS", "UNRATE", "GDP", "T10Y2Y", "VIXCLS"].includes(seriesId)) {
          return { toolUseId: id, result: `[FRED: invalid series_id '${seriesId}']` }
        }
        const result = await fetchFREDSeries(seriesId)
        return { toolUseId: id, result }
      }
      case "fetchPolygonFutures": {
        const symbol = String(inp.symbol ?? "")
        if (!["ES", "NQ", "YM", "MES", "MNQ", "MYM"].includes(symbol)) {
          return { toolUseId: id, result: `[Polygon: invalid symbol '${symbol}']` }
        }
        if (!deps.polygonApiKey) {
          return { toolUseId: id, result: "[Polygon: no API key configured — set in Account tab]" }
        }
        // D-05: cache Polygon EOD when tier == "full". When tier == "forbidden", bypass cache so
        // we don't waste cache slots on a constant string.
        const result = deps.polygonTier === "forbidden"
          ? await fetchPolygonFutures(symbol, deps.polygonApiKey)
          : await fetchPolygonWithCounter(symbol, deps.polygonApiKey)
        return { toolUseId: id, result }
      }
      case "fetchAlphaVantage": {
        const fn = String(inp.function ?? "").toUpperCase()
        const symbol = String(inp.symbol ?? "").toUpperCase().trim()
        if (!["RSI", "MACD", "NEWS_SENTIMENT"].includes(fn)) {
          return { toolUseId: id, result: `[AlphaVantage: invalid function '${fn}']` }
        }
        if (!symbol) return { toolUseId: id, result: "[AlphaVantage: symbol required]" }
        if (!deps.avApiKey) {
          return { toolUseId: id, result: "[AlphaVantage: no API key configured — set in Account tab]" }
        }
        const result = await fetchAlphaVantageWithCounter(fn, symbol, deps.avApiKey, deps.avUsage)
        return { toolUseId: id, result }
      }
      case "searchGemini": {
        const query = String(inp.query ?? "").trim()
        if (!query) return { toolUseId: id, result: "[Gemini search: empty query]" }
        if (!deps.geminiApiKey) {
          return { toolUseId: id, result: "[Gemini search: no API key configured — set in Account tab]" }
        }
        const result = await fetchGeminiWithCounter(query, deps.geminiApiKey, deps.geminiUsage)
        return { toolUseId: id, result }
      }
      default:
        return { toolUseId: id, result: `[Unknown tool: ${name}]` }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    // Re-throw rate-limit and invalid-key sentinels for outer POST handler to surface
    if (msg === "GEMINI_RATE_LIMIT" || msg === "GEMINI_INVALID_KEY") throw err
    return { toolUseId: id, result: `[${name}: ${msg.slice(0, 80)}]` }
  }
}

const lastCallTime = new Map<string, number>()
const RATE_LIMIT_MS = 15_000

const STRATEGY_SYSTEM = `
TRADING STRATEGY — Trend Line & S/R Confluence System

ACCOUNT: $50,000 prop account | INSTRUMENTS: MES, ES, MNQ, NQ, YM, MYM (equity index futures only)

TOP-DOWN ANALYSIS (macro to micro):
1D → Market structure (HH/HL vs LH/LL), major S/R zones, HTF bias & liquidity pools
4H → Swing H/L, retracement zones, FVGs, imbalances, premium/discount zones
1H → S/R flips, BOS confirmation, trend lines, narrow entry zone to ±10–20 pts
15M → Micro BOS/CHoCH, retest of broken S/R, volume spikes, TP1 internal liq.
5M → Entry pattern forming, wicks, pinbar, engulf, volume confirmation, final SL level
1M/3M → Execution: trigger candle, momentum shift, limit or market entry

10 CONFLUENCES (minimum 3 required to enter, 5+ = strong setup):
C1 — HTF Trend Aligned (non-negotiable, most important filter)
C2 — S/R Zone Hit (PDH, PDL, weekly levels, structural flip)
C3 — Trend Line Touch/Break
C4 — BOS / CHoCH on 5M or 15M
C5 — FVG / Imbalance Present
C6 — VWAP Confluence (AVWAP anchor: Monday open, major swings)
C7 — Volume Confirmation (spike on break/rejection candle)
C8 — Session Open / Close (high-probability window)
C9 — Liquidity Sweep / SFP (stop-hunt then reversal)
C10 — Clean Entry Pattern (pinbar, engulf, B&R micro trend line, displacement)

LIQUIDITY TARGETING:
External (TP2/Runner): PDH/PDL, weekly H/L, HTF swing H/L, equal H/L pools, round numbers
Internal (TP1/Scale): FVGs on 5M/15M, imbalance zones, VWAP/POC, prior day close
Scale-out: 50% at TP1 → move SL to BE → 25% at TP2 → 25% runner. Min 2:1 R:R to TP1.

RISK RULES:
Position sizing: Risk $ ÷ (SL distance in pts × tick value) = contracts
SL: 0.5% ($250) tight setups, 1.0% ($500) wider zones — always structural, never arbitrary
Daily: Soft $500 (1%), Hard $1,000 (2%) — hard limit = shut down, no exceptions
After +$1,000 day: reduce size or stop

KILL SWITCHES (non-negotiable):
• 2 consecutive losses → 30-min mandatory break
• 3 consecutive losses → done for the day
• Daily loss limit hit → close platform, no revenge trades
• Tilt/revenge feeling detected → walk away immediately
• No setup = no trade (boredom is not a reason to enter)

SESSIONS & TIMING (ET):
Pre-market (08:00–09:30): mark levels only, cautious entries
NYSE Open — PRIMARY (09:30–11:30): highest priority, strongest setups
Lunch Chop (11:30–13:30): AVOID or skip — high chop risk, most overtrading losses
PM Session (13:30–15:30): continuation only with clear HTF setup
Power Hour (15:30–16:00): final liquidity grabs, HTF confirmation only
Economic calendar: no trades ±5 min of high-impact events (CPI, FOMC, NFP)

WEEKLY DISCIPLINE:
Target 1–2% weekly gain ($500–$1,000). Compounding beats swinging big.
Friday review: Win%, avg R:R, most common mistake, process adherence score (1–10).
`

function buildTradesSummary(trades: Array<{
  date: string; instrument: string; direction: string; session: string;
  pnl: number; rmult: number; outcome: string; confluences: string[]; notes: string
}>) {
  return trades.slice(0, 20).map(t =>
    `${t.date} | ${t.instrument} ${t.direction.toUpperCase()} | ${t.session} | P&L: $${t.pnl} | R: ${t.rmult.toFixed(1)} | ${t.outcome.toUpperCase()} | Confluences: ${t.confluences.join(", ") || "none"} | Notes: ${t.notes || "none"}`
  ).join("\n")
}

function buildWeaknessProfile(ledger: Record<string, number> | undefined): string {
  if (!ledger) return ""
  const entries = Object.entries(ledger)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
  if (entries.length === 0) return "No violations recorded yet."
  return entries.map(([key, count], i) => `${i + 1}. ${key} (${count}x)`).join(" | ")
}

function buildSessionIndexContext(index: Array<{ title: string; timestamp: string; mode: string; momentumLabel: string }> | undefined): string {
  if (!index || index.length === 0) return "No previous sessions."
  return index.slice(0, 10).map(s =>
    `[${new Date(s.timestamp).toLocaleDateString()}] ${s.mode}: "${s.title}" (${s.momentumLabel})`
  ).join("\n")
}

function buildMilestoneContext(log: Record<string, string | number | undefined>): string {
  const parts: string[] = []
  if (log.firstProfitableDay) parts.push(`First profitable day: ${log.firstProfitableDay}`)
  if (log.bestRSession) parts.push(`Best R session: ${log.bestRSession}R`)
  if (log.bestDayPnl) parts.push(`Best day P&L: $${log.bestDayPnl}`)
  if (log.firstWinStreak3) parts.push(`First 3-win streak: ${log.firstWinStreak3}`)
  if (log.firstWinStreak5) parts.push(`First 5-win streak: ${log.firstWinStreak5}`)
  return parts.join(" | ")
}

function computeStreaks(
  trades: Array<{ date: string; outcome: string; confluences: string[] }>,
  current: Streaks
): Streaks {
  if (!trades.length) return current

  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date))

  let currentWin = 0, currentLoss = 0, longestWin = current.longestWin, longestLoss = current.longestLoss
  for (const t of sorted) {
    if (t.outcome === "win") {
      currentWin++; currentLoss = 0
      if (currentWin > longestWin) longestWin = currentWin
    } else if (t.outcome === "loss") {
      currentLoss++; currentWin = 0
      if (currentLoss > longestLoss) longestLoss = currentLoss
    }
  }

  const byDate = new Map<string, Array<{ confluences: string[] }>>()
  for (const t of sorted) {
    const existing = byDate.get(t.date) ?? []
    existing.push(t)
    byDate.set(t.date, existing)
  }
  const dates = [...byDate.keys()].sort()
  let ruleAdherentDays = 0, longestRuleAdherent = current.longestRuleAdherent, streak = 0
  for (const d of dates) {
    const dayTrades = byDate.get(d)!
    const adherent = dayTrades.every(t => t.confluences.length >= 3)
    if (adherent) { streak++; ruleAdherentDays = streak; if (streak > longestRuleAdherent) longestRuleAdherent = streak }
    else streak = 0
  }

  return { currentWin, currentLoss, longestWin, longestLoss, ruleAdherentDays, longestRuleAdherent }
}

function computeMilestones(
  trades: Array<{ date: string; outcome: string; pnl: number; rmult: number }>,
  existing: MilestoneLog
): Partial<MilestoneLog> {
  const updates: Partial<MilestoneLog> = {}
  if (!trades.length) return updates

  if (!existing.firstProfitableDay) {
    const byDate = new Map<string, number>()
    for (const t of trades) byDate.set(t.date, (byDate.get(t.date) ?? 0) + t.pnl)
    const profitableDay = [...byDate.entries()].find(([, pnl]) => pnl > 0)
    if (profitableDay) updates.firstProfitableDay = profitableDay[0]
  }

  const maxR = Math.max(...trades.map(t => t.rmult))
  if (maxR > (existing.bestRSession ?? 0)) updates.bestRSession = maxR

  const byDate = new Map<string, number>()
  for (const t of trades) byDate.set(t.date, (byDate.get(t.date) ?? 0) + t.pnl)
  const maxDayPnl = Math.max(...byDate.values())
  if (maxDayPnl > (existing.bestDayPnl ?? 0)) updates.bestDayPnl = maxDayPnl

  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date))
  let streak = 0, best = 0
  for (const t of sorted) {
    if (t.outcome === "win") { streak++; if (streak > best) best = streak }
    else streak = 0
  }
  if (best >= 3 && !existing.firstWinStreak3) updates.firstWinStreak3 = new Date().toISOString().split("T")[0]
  if (best >= 5 && !existing.firstWinStreak5) updates.firstWinStreak5 = new Date().toISOString().split("T")[0]

  return updates
}

type TradeLike = { date: string; outcome: string; pnl: number; session: string }

function computeWeeklySummaries(trades: TradeLike[]): WeeklySummary[] {
  if (!trades.length) return []
  const getMonday = (dateStr: string) => {
    const d = new Date(dateStr)
    const day = d.getUTCDay()
    const diff = (day === 0 ? -6 : 1 - day)
    d.setUTCDate(d.getUTCDate() + diff)
    return d.toISOString().split("T")[0]
  }
  const byWeek = new Map<string, TradeLike[]>()
  for (const t of trades) {
    const week = getMonday(t.date)
    const existing = byWeek.get(week) ?? []
    existing.push(t)
    byWeek.set(week, existing)
  }
  return [...byWeek.entries()].map(([weekOf, wTrades]) => {
    const wins = wTrades.filter(t => t.outcome === "win").length
    const sessions = wTrades.map(t => t.session)
    const sessionCount = sessions.reduce((acc, s) => { acc[s] = (acc[s] ?? 0) + 1; return acc }, {} as Record<string, number>)
    const topSession = Object.entries(sessionCount).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "NYSE"
    return {
      weekOf,
      trades: wTrades.length,
      pnl: Math.round(wTrades.reduce((sum, t) => sum + t.pnl, 0)),
      winRate: Math.round((wins / wTrades.length) * 100),
      topSession,
      topViolation: "none",
    }
  })
}

function computeMonthlySummaries(trades: TradeLike[]): MonthlySummary[] {
  if (!trades.length) return []
  const getMonday = (dateStr: string) => {
    const d = new Date(dateStr)
    const day = d.getUTCDay()
    d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day))
    return d.toISOString().split("T")[0]
  }
  const byMonth = new Map<string, TradeLike[]>()
  for (const t of trades) {
    const month = t.date.slice(0, 7)
    const existing = byMonth.get(month) ?? []
    existing.push(t)
    byMonth.set(month, existing)
  }
  return [...byMonth.entries()].map(([monthOf, mTrades]) => {
    const wins = mTrades.filter(t => t.outcome === "win").length
    const byWeek = new Map<string, number>()
    for (const t of mTrades) {
      const week = getMonday(t.date)
      byWeek.set(week, (byWeek.get(week) ?? 0) + t.pnl)
    }
    const weekEntries = [...byWeek.entries()]
    const bestWeekOf = weekEntries.sort(([, a], [, b]) => b - a)[0]?.[0] ?? monthOf
    const worstWeekOf = weekEntries.sort(([, a], [, b]) => a - b)[0]?.[0] ?? monthOf
    return {
      monthOf,
      trades: mTrades.length,
      pnl: Math.round(mTrades.reduce((sum, t) => sum + t.pnl, 0)),
      winRate: Math.round((wins / mTrades.length) * 100),
      bestWeekOf,
      worstWeekOf,
    }
  })
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> | undefined
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const geminiApiKey = user.user_metadata?.gemini_api_key as string | undefined
    const claudeApiKey = user.user_metadata?.claude_api_key as string | undefined
    const polygonApiKey = user.user_metadata?.polygon_api_key as string | undefined
    const avApiKey = user.user_metadata?.av_api_key as string | undefined

    body = await req.json()
    const {
      message,
      mode,
      trades,
      history,
      patternSummary,
      strategyText,
      sessionId,
      watchlist,
      sessionIndex: incomingSessionIndex,
      behaviorLedger: incomingBehaviorLedger,
      milestoneLog: incomingMilestoneLog,
      streaks: incomingStreaks,
      journalMemory,
      coachingContextFull,
      weeklySummaries,
      monthlySummaries,
      conversationHistory,
    } = body as {
      message: string
      mode: string
      trades: Array<{ date: string; instrument: string; direction: string; session: string; pnl: number; rmult: number; outcome: string; confluences: string[]; notes: string }>
      history: Array<{ priority: string; timestamp: string }>
      patternSummary: string
      strategyText: string
      sessionId: string
      watchlist: string[]
      sessionIndex: SessionIndexEntry[]
      behaviorLedger: BehaviorLedger
      milestoneLog: MilestoneLog
      streaks: Streaks
      journalMemory: { shortTerm?: string; mediumTerm?: string; longTerm?: string }
      coachingContextFull: Array<{ title: string; timestamp: string; mode: string; content: string }>
      weeklySummaries: Array<{ weekOf: string; trades: number; pnl: number; winRate: number; topSession: string; topViolation: string }>
      monthlySummaries: Array<{ monthOf: string; trades: number; pnl: number; winRate: number; bestWeekOf: string; worstWeekOf: string }>
      conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>
    }

    const nowET = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }))
    const todayET = getTradingDayKey()
    const dayOfWeek = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][nowET.getDay()]
    const timeET = nowET.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
    const currentDateLine = `CURRENT DATE/TIME: ${dayOfWeek}, ${todayET} | ${timeET} ET`

    const sid = (sessionId as string) || "default"
    const last = lastCallTime.get(sid) || 0
    if (Date.now() - last < RATE_LIMIT_MS) {
      return NextResponse.json({ error: "Rate limited — wait 15 seconds" }, { status: 429 })
    }
    lastCallTime.set(sid, Date.now())

    // Claude key required for all modes
    if (!claudeApiKey || claudeApiKey.trim().length < 20) {
      return NextResponse.json(
        { error: "No Claude API key configured. Add one in Account Settings." },
        { status: 403 }
      )
    }

    const tradesSummary = Array.isArray(trades) && trades.length > 0
      ? buildTradesSummary(trades)
      : "No trades logged yet."

    const recentCoaching = Array.isArray(history) && history.length > 0
      ? history.slice(-3).map((h: { priority: string; timestamp: string }) =>
          `[${new Date(h.timestamp).toLocaleDateString()}]: ${h.priority}`
        ).join("\n")
      : "No previous coaching sessions."

    const extraStrategy = strategyText ? `\nTRADER'S PERSONAL NOTES:\n${strategyText}` : ""
    const patternContext = patternSummary ? `\nPATTERN HISTORY (compressed from past analyses):\n${patternSummary}` : ""

    const watchlistArr = Array.isArray(watchlist) ? (watchlist as string[]) : []
    const watchlistSection = watchlistArr.length > 0
      ? `WATCHLIST (user is tracking): ${watchlistArr.join(", ")}\n`
      : ""

    const weaknessProfile = buildWeaknessProfile(incomingBehaviorLedger as unknown as Record<string, number> | undefined)
    const sessionHistory = buildSessionIndexContext(
      incomingSessionIndex as unknown as Array<{ title: string; timestamp: string; mode: string; momentumLabel: string }> | undefined
    )
    const streaksContext = incomingStreaks
      ? `Current streaks: ${(incomingStreaks as Streaks).currentWin}-win | ${(incomingStreaks as Streaks).currentLoss}-loss | Rule-adherent days: ${(incomingStreaks as Streaks).ruleAdherentDays} (best: ${(incomingStreaks as Streaks).longestRuleAdherent})`
      : ""
    const milestoneContext = incomingMilestoneLog
      ? buildMilestoneContext(incomingMilestoneLog as unknown as Record<string, string | number | undefined>)
      : ""

    const jm = journalMemory as { shortTerm?: string; mediumTerm?: string; longTerm?: string } | undefined
    const shortJournal = jm?.shortTerm?.trim() || ""
    const mediumJournal = jm?.mediumTerm?.trim() || ""
    const longJournal = jm?.longTerm?.trim() || ""

    const journalSection = mode === "analyze"
      ? [
          shortJournal ? `SHORT-TERM JOURNAL (last 100 trades — raw data):\n${shortJournal}` : "",
          mediumJournal ? `MEDIUM-TERM JOURNAL (every 5th trade — ~500 trade span):\n${mediumJournal}` : "",
          longJournal ? `LONG-TERM JOURNAL (every 10th trade — ~2000 trade span):\n${longJournal}` : "",
        ].filter(Boolean).join("\n\n")
      : mode === "chat" && shortJournal
      ? `RECENT TRADE HISTORY (last 100):\n${shortJournal}`
      : ""

    const ctxEntries = Array.isArray(coachingContextFull)
      ? (coachingContextFull as Array<{ title: string; timestamp: string; mode: string; content: string }>)
      : []
    const coachingContextSection = ctxEntries.length > 0 && mode !== "market-pulse"
      ? `COACHING HISTORY (full arc — first session + sampled + recent, ${ctxEntries.length} entries):\n` +
        ctxEntries.map(e =>
          `[${new Date(e.timestamp).toLocaleDateString()}] ${e.mode} — "${e.title}"\n${e.content}`
        ).join("\n---\n")
      : ""

    const wSummaries = Array.isArray(weeklySummaries)
      ? (weeklySummaries as Array<{ weekOf: string; trades: number; pnl: number; winRate: number; topSession: string; topViolation: string }>)
          .slice(0, 8)
      : []
    const mSummaries = Array.isArray(monthlySummaries)
      ? (monthlySummaries as Array<{ monthOf: string; trades: number; pnl: number; winRate: number; bestWeekOf: string; worstWeekOf: string }>)
          .slice(0, 6)
      : []
    const weeklySummarySection = wSummaries.length > 0
      ? `WEEKLY SUMMARIES (last ${wSummaries.length} weeks):\n` +
        wSummaries.map(w =>
          `${w.weekOf}: ${w.trades} trades | ${w.pnl >= 0 ? "+" : ""}$${w.pnl} | ${w.winRate}% WR | top violation: ${w.topViolation}`
        ).join("\n")
      : ""
    const monthlySummarySection = mSummaries.length > 0
      ? `MONTHLY SUMMARIES (last ${mSummaries.length} months):\n` +
        mSummaries.map(m =>
          `${m.monthOf}: ${m.trades} trades | ${m.pnl >= 0 ? "+" : ""}$${m.pnl} | ${m.winRate}% WR`
        ).join("\n")
      : ""

    const claudeSystemContext = `${currentDateLine}\n\n${STRATEGY_SYSTEM}${extraStrategy}
${watchlistSection}
RECENT TRADES (newest first):
${tradesSummary}
${patternContext}
${journalSection ? journalSection + "\n" : ""}${weeklySummarySection ? weeklySummarySection + "\n" : ""}${monthlySummarySection ? monthlySummarySection + "\n" : ""}RECENT COACHING SESSIONS:
${recentCoaching}
${coachingContextSection ? "\n" + coachingContextSection + "\n" : ""}
Past session titles (newest first):
${sessionHistory}

Top weaknesses: ${weaknessProfile}

${streaksContext ? `Streaks: ${streaksContext}` : ""}
${milestoneContext ? `Milestones: ${milestoneContext}` : ""}

COACH IDENTITY & PROTOCOLS

You are a disciplined prop trading coach and honest mentor. Process-first, outcome-second. You've seen every psychological trap and you don't let traders off the hook. Your job is to develop the trader, not validate them.

CORE PRINCIPLES:
- Process beats outcome. A losing trade with clean execution is better than a winning trade with sloppy entries. Say so when it applies.
- Psychology is the primary failure mode — not indicators, not markets. Treat it as the main event.
- Ego is the enemy. Confidence inflated by wins leads directly to the biggest giveback losses. Never feed it.

ON WINS: One or two sentences maximum. Acknowledge clean execution briefly, identify anything sloppy even if it was profitable, then move on. Do not linger. Do not inflate.

ON LOSSES: One brief human line acknowledging the sting — then spend real time on the breakdown. What rule was broken or bent? What emotional state got here? What does the data say about this pattern?

PSYCHOLOGY RED FLAGS — flag these immediately and by name whenever detected in trade data or messages. These are the primary causes of account damage:
- Revenge trading: two or more trades placed within minutes of each other following a loss. Name it directly.
- Overconfident overtrading: position size spikes or trade frequency jumps after a large win. Name it.
- Imagining setups: entering without 3+ confluences confirmed. The setup wasn't there — say so.
- Skipping analysis phases: jumping from HTF bias to execution without working the TF ladder.
- Breaking the giveback rule: continuing after hitting daily or per-loss limits. No exceptions, no context makes this acceptable.

COMMUNICATION STYLE:
Precise and professional with edge. Direct opinions — no hedging. Short sentences. Strong verbs. No performative positivity. Omit filler phrases like "that said", "however", "it's worth noting". Dry observations are fine. Only say what earns its place.

ABSOLUTE RULES:
1. Never praise sloppy execution because it was profitable. Luck and skill are not the same.
2. Never give buy/sell signals, price targets, or entry recommendations. Develop the trader, not the trade.
3. Never open with filler: no "Great question!", "Certainly!", "Absolutely!", "Of course!", "Sure!". Start with substance.
4. Never moralize: no "you'll get it next time", "stay positive", "keep your head up". The market doesn't care.
5. Every response must reference actual trade data — specific dates, instruments, confluence counts, R-multiples, or session context from what's provided. No generic coaching.

Use markdown formatting (## headers, bullet points) for structured responses. Plain prose for conversational chat.

SPECIAL COMMANDS — include at the very end of every response (no markdown, one per line):
MOMENTUM: <value> — always required. Choose exactly one:
  positive — trader is improving, clean execution, rule adherence, encouraging trend
  negative — rule violations, emotional trading, avoidable losses, concerning pattern
  neutral  — strategic discussion, mixed signals, general process chat
  info     — factual question, educational inquiry, market data request, watchlist management
WATCHLIST_ADD: TICKER — when the user asks to track a symbol
WATCHLIST_REMOVE: TICKER — when the user asks to stop tracking a symbol`

    let userPrompt = message || ""

    if (mode === "analyze") {
      userPrompt = `Analyze my trading journal. Use markdown formatting. Be specific and concise — under 350 words.

## Patterns
- What's working (cite specific trades/sessions/instruments)
- What's not working (cite specific trades/sessions/instruments)

## Risk & Process
- Risk management quality
- Rule adherence issues

## Priority Focus
One sentence: the single most important thing to fix right now.

---
End with these exact lines (plain text, no markdown, one per line):
MOMENTUM: positive|neutral|negative
TITLE: <6-8 word summary of the key finding>
PATTERN SUMMARY UPDATE: <100-word compressed pattern memory update>
VIOLATIONS: <comma-separated list of violated categories, or "none"> — valid categories: lunchChop, overtrading, revengeTrade, noSetup, skippedBreak, positionSizing, dailyLimitBreached`
    } else if (mode === "market-pulse") {
      const watchlistFocus = watchlistArr.length > 0
        ? `## Watchlist (priority)
${watchlistArr.map(s => `- **${s}**: price action, key S/R levels, anything notable today`).join("\n")}

## Broader Market`
        : `## Market`
      userPrompt = `Give me a trader-focused market pulse for ${dayOfWeek}, ${todayET} — NYSE open session (09:30–11:30 ET). Use markdown formatting.

${watchlistFocus}
- ES / NQ macro backdrop and intraday bias
- Key levels or events to watch
- Any high-impact news affecting volatility today
- How conditions align with my trend-following S/R confluence strategy

Under 250 words. End with: TITLE: <6-8 word summary of the key market finding>`
    } else if (mode === "strategy-review") {
      userPrompt = `Using my personal trade history, critique my SMC/ICT S/R confluence system. Use markdown formatting. Cover:
- How my actual trade patterns align with best practices
- Specific weaknesses in my confluence system (cite my actual trades)
- Market conditions I'm adapting to vs where I'm lagging
- One concrete improvement to implement this week

Under 300 words. End with: TITLE: <6-8 word summary of the key strategic insight>`
    }

    if (!userPrompt) {
      return NextResponse.json({ error: "No message provided" }, { status: 400 })
    }

    const anthropic = new Anthropic({ apiKey: claudeApiKey.trim() })

    const finalSystemContext = claudeSystemContext

    // Build conversation history — cap at last 18 messages (9 turns) for context window budget
    const priorMessages: Anthropic.MessageParam[] = Array.isArray(conversationHistory)
      ? conversationHistory
          .slice(-18)
          .map(m => ({ role: m.role as "user" | "assistant", content: m.content }))
      : []

    const messages: Anthropic.MessageParam[] = [
      ...priorMessages,
      { role: "user", content: userPrompt },
    ]

    // 07-03 Task 3 deleted the original watchlistSymbols const from the pre-fetch block.
    // This is now the single canonical declaration in the POST handler scope (no shadowing).
    const watchlistSymbols = watchlistArr
    const today = todayUTC()
    const storedAvUsage = user.user_metadata?.av_usage as { date?: string; count?: number } | undefined
    const avUsage = {
      date: today,
      count: storedAvUsage?.date === today ? (storedAvUsage.count ?? 0) : 0,
    }
    const avUsageStartCount = avUsage.count
    const storedGeminiUsage = user.user_metadata?.gemini_usage as { date?: string; count?: number } | undefined
    const geminiUsage = {
      date: today,
      count: storedGeminiUsage?.date === today ? (storedGeminiUsage.count ?? 0) : 0,
    }
    const geminiUsageStartCount = geminiUsage.count
    const toolDeps: ToolDeps = {
      polygonApiKey,
      geminiApiKey,
      avApiKey,
      watchlist: watchlistSymbols,
      polygonTier: process.env.POLYGON_TIER as "full" | "forbidden" | "endpoint_unknown" | undefined,
      avUsage,
      geminiUsage,
    }

    let response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: finalSystemContext,
      messages,
      tools: localTools,
    })

    let loopCount = 0
    const MAX_LOOP_ITERATIONS = 10
    while (response.stop_reason === "tool_use" && loopCount < MAX_LOOP_ITERATIONS) {
      loopCount++
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      )
      const toolResults = await Promise.all(toolUseBlocks.map(b => executeToolCall(b, toolDeps)))

      messages.push({ role: "assistant", content: response.content as Anthropic.MessageParam["content"] })
      messages.push({
        role: "user",
        content: toolResults.map(r => ({
          type: "tool_result" as const,
          tool_use_id: r.toolUseId,
          content: r.result,
        }))
      })

      response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: finalSystemContext,
        messages,
        tools: localTools,
      })
    }

    // Extract final text from the last assistant message
    const textBlocks = response.content.filter(
      (b): b is Anthropic.TextBlock => b.type === "text"
    )
    const rawText = textBlocks.map(b => b.text).join("\n").trim()

    if (!rawText) {
      return NextResponse.json({ error: "Empty response from Claude" }, { status: 502 })
    }

    let reply = rawText
    let newPatternSummary: string | undefined
    let sessionTitle: string | undefined

    // Extract TITLE (handles ### TITLE: prefix from markdown formatting)
    const titleMatch = rawText.match(/^#{0,3}\s*TITLE:\s*(.+)$/im)
    if (titleMatch) {
      sessionTitle = titleMatch[1].trim()
      reply = reply.replace(/^#{0,3}\s*TITLE:\s*.+$/im, "").trim()
    }

    // Extract PATTERN SUMMARY UPDATE
    const summaryMatch = rawText.match(/PATTERN SUMMARY UPDATE:\s*([\s\S]+?)(?:\n\n|$)/i)
    if (summaryMatch) {
      newPatternSummary = summaryMatch[1].trim()
      reply = reply.replace(/PATTERN SUMMARY UPDATE:[\s\S]+$/i, "").trim()
    }

    // Extract MOMENTUM marker — present on every response via system prompt instruction
    let momentum = "neutral"
    const momentumMatch = rawText.match(/^MOMENTUM:\s*(positive|neutral|negative|info)/im)
    if (momentumMatch) {
      momentum = momentumMatch[1].toLowerCase()
    } else if (mode === "analyze") {
      const lc = rawText.toLowerCase()
      if (lc.includes("improving") || lc.includes("positive momentum")) momentum = "positive"
      else if (lc.includes("consistent losses") || lc.includes("declining") || lc.includes("overtrading")) momentum = "negative"
    } else if (mode === "market-pulse") {
      momentum = "info"
    }
    reply = reply.replace(/^MOMENTUM:\s*.+$/im, "").trim()

    // Parse VIOLATIONS marker — analyze mode only (D-08)
    let behaviorLedgerUpdate: Partial<BehaviorLedger> | null = null
    if (mode === "analyze") {
      const violationsMatch = rawText.match(/^VIOLATIONS:\s*(.+)$/im)
      if (violationsMatch) {
        reply = reply.replace(/^VIOLATIONS:\s*.+$/im, "").trim()
        const raw = violationsMatch[1].trim().toLowerCase()
        if (raw !== "none") {
          const VALID_KEYS: Array<keyof BehaviorLedger> = [
            "lunchChop", "overtrading", "revengeTrade", "noSetup",
            "skippedBreak", "positionSizing", "dailyLimitBreached",
          ]
          const parsed: Partial<BehaviorLedger> = {}
          for (const key of VALID_KEYS) {
            if (raw.includes(key.toLowerCase())) parsed[key] = 1
          }
          if (Object.keys(parsed).length > 0) behaviorLedgerUpdate = parsed
        }
      }
    }

    // Extract and strip WATCHLIST commands
    const watchlistAdd: string[] = []
    const watchlistRemove: string[] = []
    for (const m of rawText.matchAll(/^WATCHLIST_ADD:\s*(\S+)/gim)) watchlistAdd.push(m[1].toUpperCase())
    for (const m of rawText.matchAll(/^WATCHLIST_REMOVE:\s*(\S+)/gim)) watchlistRemove.push(m[1].toUpperCase())
    reply = reply.replace(/^WATCHLIST_(?:ADD|REMOVE):\s*\S+\s*$/gim, "").trim()

    // Compute memory updates — analyze mode only
    let streaksUpdate: Streaks | null = null
    let milestoneUpdate: Partial<MilestoneLog> | null = null
    let sessionIndexUpdate: SessionIndexEntry | null = null
    let weeklyUpdate: WeeklySummary[] | null = null
    let monthlyUpdate: MonthlySummary[] | null = null

    if (mode === "analyze" && Array.isArray(trades) && trades.length > 0) {
      const currentStreaks = (incomingStreaks ?? { currentWin: 0, currentLoss: 0, longestWin: 0, longestLoss: 0, ruleAdherentDays: 0, longestRuleAdherent: 0 }) as Streaks
      streaksUpdate = computeStreaks(
        trades as Array<{ date: string; outcome: string; confluences: string[]; pnl: number; rmult: number }>,
        currentStreaks
      )
      const currentMilestones = (incomingMilestoneLog ?? {}) as MilestoneLog
      const milestoneChanges = computeMilestones(
        trades as Array<{ date: string; outcome: string; pnl: number; rmult: number }>,
        currentMilestones
      )
      if (Object.keys(milestoneChanges).length > 0) milestoneUpdate = milestoneChanges
      weeklyUpdate = computeWeeklySummaries(trades as TradeLike[])
      monthlyUpdate = computeMonthlySummaries(trades as TradeLike[])
    }

    // Session index entry — any mode that produces a title
    if (sessionTitle) {
      sessionIndexUpdate = {
        title: sessionTitle,
        timestamp: new Date().toISOString(),
        mode: mode as SessionIndexEntry["mode"],
        momentumLabel: momentum === "positive" ? "↑ Positive" : momentum === "negative" ? "↓ Negative" : "→ Neutral",
      }
    }

    // D-06: Server writes memory to Supabase before responding. Eliminates silent data loss
    // if the network drops between server response and client write.
    const memoryUpdates: Record<string, unknown> = {}
    if (sessionIndexUpdate !== null) {
      const existingIndex = Array.isArray(incomingSessionIndex) ? incomingSessionIndex : []
      memoryUpdates.session_index = [sessionIndexUpdate, ...existingIndex].slice(0, 60)
    }
    if (behaviorLedgerUpdate !== null) {
      const existingLedger = (incomingBehaviorLedger ?? {}) as BehaviorLedger
      memoryUpdates.behavior_ledger = Object.fromEntries(
        Object.entries({ ...existingLedger, ...behaviorLedgerUpdate }).map(
          ([k, v]) => [k, (existingLedger[k as keyof BehaviorLedger] ?? 0) + (v ?? 0)]
        )
      ) as unknown as BehaviorLedger
    }
    if (milestoneUpdate !== null) memoryUpdates.milestone_log = { ...(user.user_metadata?.milestone_log ?? {}), ...milestoneUpdate }
    if (streaksUpdate !== null) memoryUpdates.streaks = streaksUpdate
    if (weeklyUpdate !== null) memoryUpdates.weekly_summaries = weeklyUpdate
    if (monthlyUpdate !== null) memoryUpdates.monthly_summaries = monthlyUpdate
    if (newPatternSummary !== undefined && newPatternSummary !== null) memoryUpdates.pattern_summary = newPatternSummary
    if (avUsage.count !== avUsageStartCount || storedAvUsage?.date !== avUsage.date) {
      memoryUpdates.av_usage = { date: avUsage.date, count: avUsage.count }
    }
    if (geminiUsage.count !== geminiUsageStartCount || storedGeminiUsage?.date !== geminiUsage.date) {
      memoryUpdates.gemini_usage = { date: geminiUsage.date, count: geminiUsage.count }
    }

    if (Object.keys(memoryUpdates).length > 0) {
      const { error: writeError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          ...memoryUpdates,
        },
      })
      if (writeError) {
        console.error("[coach] memory write failed:", writeError.message)
        return NextResponse.json({ error: "Memory write failed" }, { status: 500 })
      }
    }

    if (mode === "analyze") {
      const coaching = {
        marketSnapshot: reply.slice(0, 200),
        patterns: "See full analysis",
        process: "See full analysis",
        risk: "See full analysis",
        priority: reply.split("\n").find(l => l.toLowerCase().includes("priority") || l.toLowerCase().includes("focus")) || reply.slice(0, 100),
        momentum,
      }
      return NextResponse.json({
        reply, coaching, newPatternSummary, sessionTitle, watchlistAdd, watchlistRemove,
        sessionIndexUpdate, behaviorLedgerUpdate, milestoneUpdate, streaksUpdate,
        weeklyUpdate, monthlyUpdate,
      })
    }

    return NextResponse.json({
      reply, momentum, newPatternSummary, sessionTitle, watchlistAdd, watchlistRemove,
      sessionIndexUpdate, behaviorLedgerUpdate: null, milestoneUpdate: null, streaksUpdate: null,
      weeklyUpdate: null, monthlyUpdate: null,
    })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[coach] error:", message)

    if (message === "GEMINI_RATE_LIMIT" || message.includes("GEMINI_RATE_LIMIT")) {
      return NextResponse.json(
        { error: "Gemini search is rate-limited — queued for retry. Coach will respond once search completes.", type: "rate_limit", provider: "gemini" },
        { status: 429 }
      )
    }
    if (message === "GEMINI_INVALID_KEY" || message.includes("GEMINI_INVALID_KEY")) {
      return NextResponse.json(
        { error: "Invalid Gemini API key — check Account settings.", type: "key_error", provider: "gemini" },
        { status: 401 }
      )
    }

    if (message.includes("rate_limit_error") || message.includes("rate-limit") ||
        (message.includes("429") && !message.includes("Polygon") && !message.includes("FRED"))) {
      return NextResponse.json(
        { error: "Claude is at capacity — your request is queued and will resume shortly.", type: "rate_limit", provider: "claude" },
        { status: 429 }
      )
    }

    if (message.includes("invalid x-api-key") || message.includes("authentication_error") ||
        (message.includes("401") && !message.includes("Polygon") && !message.includes("FRED"))) {
      return NextResponse.json(
        { error: "Invalid Claude API key — check Account settings.", type: "key_error", provider: "claude" },
        { status: 401 }
      )
    }

    if (message.includes("API_KEY") || message.includes("403") || message.includes("authentication")) {
      return NextResponse.json(
        { error: "Coach authentication failed — check API keys in Account settings.", type: "key_error" },
        { status: 401 }
      )
    }
    if (message.includes("RESOURCE_EXHAUSTED") || message.includes("quota")) {
      return NextResponse.json(
        { error: "Quota exceeded — check your API plan limits.", type: "rate_limit" },
        { status: 429 }
      )
    }

    if (message.includes("credit balance") || message.includes("Plans & Billing") || message.includes("billing")) {
      return NextResponse.json(
        { error: "Anthropic account has no credits — add credits at console.anthropic.com/settings/plans.", type: "key_error", provider: "claude" },
        { status: 402 }
      )
    }

    return NextResponse.json({ error: "Coach unavailable — try again." }, { status: 500 })
  }
}
