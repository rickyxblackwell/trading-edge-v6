// Server-only — used in Next.js API routes. Never import from client components.

// yahoo-finance2 v3: default export is a constructor despite type declarations saying otherwise
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinanceClass = require("yahoo-finance2").default
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf: any = new YahooFinanceClass({ suppressNotices: ["yahooSurvey"] })

const CORE_FUTURES = [
  { symbol: "ES=F",  label: "ES (S&P 500)" },
  { symbol: "NQ=F",  label: "NQ (Nasdaq-100)" },
  { symbol: "YM=F",  label: "YM (Dow)" },
  { symbol: "RTY=F", label: "RTY (Russell 2000)" },
]

// Common futures root → Yahoo Finance symbol
const FUTURES_ROOTS: Record<string, string> = {
  ES: "ES=F", MES: "MES=F", NQ: "NQ=F", MNQ: "MNQ=F",
  YM: "YM=F", MYM: "MYM=F", RTY: "RTY=F", M2K: "M2K=F",
  GC: "GC=F", SI: "SI=F", CL: "CL=F", NG: "NG=F",
  ZB: "ZB=F", ZN: "ZN=F", VX: "VX=F",
}

function resolveSymbol(raw: string): { symbol: string; label: string } {
  const upper = raw.trim().toUpperCase()
  if (upper in FUTURES_ROOTS) return { symbol: FUTURES_ROOTS[upper], label: upper }
  return { symbol: upper, label: upper }
}

interface Quote {
  regularMarketPrice?: number
  regularMarketChange?: number
  regularMarketChangePercent?: number
  regularMarketDayHigh?: number
  regularMarketDayLow?: number
  regularMarketPreviousClose?: number
}

export async function fetchFuturesSnapshot(symbols: string[] = []): Promise<string> {
  try {
    // When no symbols passed, default to core futures watchlist.
    // When specific symbols are passed, query only those (supports any YF-valid ticker: stocks, ETFs, crypto, etc.)
    const items = symbols.length === 0
      ? CORE_FUTURES
      : symbols.map(resolveSymbol)

    const settled = await Promise.allSettled(
      items.map(({ symbol, label }) =>
        (yf.quote(symbol) as Promise<Quote>).then((q) => ({ label, q }))
      )
    )

    const lines: string[] = []
    for (const r of settled) {
      if (r.status !== "fulfilled") continue
      const { label, q } = r.value
      if (!q.regularMarketPrice) continue
      const chg = q.regularMarketChange ?? 0
      const pct = q.regularMarketChangePercent ?? 0
      const sign = chg >= 0 ? "+" : ""
      lines.push(
        `${label}: ${q.regularMarketPrice.toFixed(2)} (${sign}${chg.toFixed(2)} / ${sign}${pct.toFixed(2)}%)` +
        ` | Day range: ${q.regularMarketDayLow?.toFixed(2)}–${q.regularMarketDayHigh?.toFixed(2)}` +
        ` | Prev close: ${q.regularMarketPreviousClose?.toFixed(2)}`
      )
    }

    if (lines.length === 0) return ""

    const ts = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit", timeZone: "America/New_York",
    })
    return `QUOTES (~15 min delay · ${ts} ET):\n${lines.join("\n")}`
  } catch {
    return ""
  }
}
