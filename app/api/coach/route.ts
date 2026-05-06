import { NextRequest, NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@/lib/supabase/server"
import { fetchFuturesSnapshot } from "@/app/lib/marketData"
import type { BehaviorLedger, MilestoneLog, Streaks, SessionIndexEntry, WeeklySummary, MonthlySummary } from "@/app/lib/types"

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
    }

    const sid = (sessionId as string) || "default"
    const last = lastCallTime.get(sid) || 0
    if (Date.now() - last < RATE_LIMIT_MS) {
      return NextResponse.json({ error: "Rate limited — wait 15 seconds" }, { status: 429 })
    }
    lastCallTime.set(sid, Date.now())

    const useGeminiSearch = mode === "market-pulse" || mode === "strategy-review"

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

    const watchlistSymbols = Array.isArray(watchlist) ? (watchlist as string[]) : []
    const marketSnapshot = await fetchFuturesSnapshot(watchlistSymbols)
    const marketSection = marketSnapshot ? `\n${marketSnapshot}\n` : ""
    const watchlistSection = watchlistSymbols.length > 0
      ? `WATCHLIST (user is tracking): ${watchlistSymbols.join(", ")}\n`
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

    const claudeSystemContext = `${STRATEGY_SYSTEM}${extraStrategy}
${marketSection}${watchlistSection}
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

You are an elite prop futures trading coach. Be direct, specific, and concise. Use markdown formatting (## headers, bullet points). Reference actual trade data. Never give generic advice.

SPECIAL COMMANDS — include at the very end of your response when applicable (no markdown, one per line):
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
      const watchlistFocus = watchlistSymbols.length > 0
        ? `## Watchlist (priority — use the Yahoo Finance price data already in context)
${watchlistSymbols.map(s => `- **${s}**: price action, key S/R levels, anything notable today`).join("\n")}

## Broader Market`
        : `## Market`
      userPrompt = `Using the live Yahoo Finance market data and web research already in your context, give me a trader-focused market pulse for my NYSE open session (09:30–11:30 ET). Use markdown formatting.

${watchlistFocus}
- ES / NQ macro backdrop and intraday bias
- Key levels or events to watch
- Any high-impact news affecting volatility today
- How conditions align with my trend-following S/R confluence strategy

Under 250 words. End with: TITLE: <6-8 word summary of the key market finding>`
    } else if (mode === "strategy-review") {
      userPrompt = `Using the web research in your context (if available) plus my personal trade history and Yahoo Finance market data, critique my SMC/ICT S/R confluence system. Use markdown formatting. Cover:
- How my actual trade patterns compare to current best practices (cite web research when available)
- Specific weaknesses in my confluence system (cite my actual trades)
- Market conditions I'm adapting to vs where I'm lagging
- One concrete improvement to implement this week

Under 300 words. End with: TITLE: <6-8 word summary of the key strategic insight>`
    }

    if (!userPrompt) {
      return NextResponse.json({ error: "No message provided" }, { status: 400 })
    }

    let rawText: string
    const anthropic = new Anthropic({ apiKey: claudeApiKey.trim() })

    // Step 1 (market-pulse and strategy-review): Gemini fetches web research via Google Search
    // Result is injected into Claude's system context. Failure = graceful degradation (empty string).
    let webResearch = ""
    if (useGeminiSearch && geminiApiKey) {
      try {
        const geminiAi = new GoogleGenAI({ apiKey: geminiApiKey.trim() })
        const geminiQuery = mode === "market-pulse"
          ? "Futures market news and key events today for ES NQ YM traders — under 150 words, key facts only"
          : "Current best practices and pitfalls for SMC/ICT S/R confluence futures trading 2025 — under 150 words, actionable insights only"
        const geminiRes = await geminiAi.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ text: geminiQuery }] }],
          config: { tools: [{ googleSearch: {} }] },
        })
        webResearch = geminiRes.text?.trim() ?? ""
      } catch {
        webResearch = ""
      }
    }

    // Build final Claude system context — inject web research when available
    const finalSystemContext = webResearch
      ? `${claudeSystemContext}\n\nWEB RESEARCH (live search results):\n${webResearch}`
      : claudeSystemContext

    // Step 2: Claude generates the user-facing response for ALL modes
    const claudeRes = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: finalSystemContext,
      messages: [{ role: "user", content: userPrompt }],
    })
    const firstBlock = claudeRes.content[0]
    rawText = firstBlock.type === "text" ? firstBlock.text : ""

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

    // Extract MOMENTUM marker — fallback to keyword detection for analyze mode
    let momentum = "neutral"
    const momentumMatch = rawText.match(/^MOMENTUM:\s*(positive|neutral|negative)/im)
    if (momentumMatch) {
      momentum = momentumMatch[1].toLowerCase()
    } else if (mode === "analyze") {
      const lc = rawText.toLowerCase()
      if (lc.includes("improving") || lc.includes("positive momentum")) momentum = "positive"
      else if (lc.includes("consistent losses") || lc.includes("declining") || lc.includes("overtrading")) momentum = "negative"
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
      reply, newPatternSummary, sessionTitle, watchlistAdd, watchlistRemove,
      sessionIndexUpdate, behaviorLedgerUpdate: null, milestoneUpdate: null, streaksUpdate: null,
      weeklyUpdate: null, monthlyUpdate: null,
    })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    const isClaudeMode = typeof body?.mode === "string" && (body.mode === "analyze" || body.mode === "chat")
    console.error(`[coach] ${isClaudeMode ? "Claude" : "Gemini"} error:`, message)
    if (message.includes("API_KEY") || message.includes("401") || message.includes("403") || message.includes("authentication")) {
      const provider = isClaudeMode ? "Claude" : "Gemini"
      return NextResponse.json({ error: `Invalid ${provider} API key` }, { status: 401 })
    }
    if (message.includes("429") || message.includes("RESOURCE_EXHAUSTED") || message.includes("quota")) {
      return NextResponse.json({ error: "Quota exceeded — check your API plan limits" }, { status: 429 })
    }
    return NextResponse.json({ error: "Coach unavailable — try again" }, { status: 500 })
  }
}
