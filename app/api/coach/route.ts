import { NextRequest, NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"
import { createClient } from "@/lib/supabase/server"

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

export async function POST(req: NextRequest) {
  try {
    // Auth check — before reading body (D-13, SEC-02)
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const geminiApiKey = user.user_metadata?.gemini_api_key as string | undefined
    if (!geminiApiKey || geminiApiKey.trim().length < 10) {
      return NextResponse.json(
        { error: "No Gemini API key configured. Add one in Settings." },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { message, mode, trades, history, patternSummary, strategyText, sessionId } = body

    const sid = (sessionId as string) || "default"
    const last = lastCallTime.get(sid) || 0
    if (Date.now() - last < RATE_LIMIT_MS) {
      return NextResponse.json({ error: "Rate limited — wait 15 seconds" }, { status: 429 })
    }
    lastCallTime.set(sid, Date.now())

    const ai = new GoogleGenAI({ apiKey: geminiApiKey.trim() })

    const useGrounding = mode === "market-pulse" || mode === "strategy-review"
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

    const systemContext = `${STRATEGY_SYSTEM}${extraStrategy}

RECENT TRADES (newest first):
${tradesSummary}
${patternContext}
RECENT COACHING SESSIONS:
${recentCoaching}

You are an elite prop futures trading coach. Be direct, specific, and actionable. Reference actual trade data when you see it. Never give generic advice. Focus on what's most important right now.`

    let userPrompt = message || ""

    if (mode === "analyze") {
      userPrompt = `Analyze my recent trading journal thoroughly. Look for patterns in my entries, exits, sessions, confluences used, and outcomes. Give me a specific, actionable coaching report covering:
1. What patterns do you see (positive and negative)?
2. How is my risk management and position sizing?
3. What's my process quality like — am I following my rules?
4. What is my single highest-priority focus area right now?
5. What's my current momentum direction?

Be specific about instruments, sessions, and setups. Reference actual trades from my journal.

At the END of your response, include these two sections exactly:
TITLE: <6-8 word summary of the single most important finding>
PATTERN SUMMARY UPDATE: <200-word compressed summary of overall trading patterns for memory>`
    } else if (mode === "market-pulse") {
      userPrompt = `Search for current market conditions and sentiment for equity index futures (NQ, ES). I trade primarily during NYSE open hours (09:30–11:30 ET). What should I know for my trading today? Include:
- Current macro/market backdrop
- Key levels or events to watch
- Any relevant news that could impact intraday volatility
- How current conditions align with my strategy (trend-following, S/R confluence)
Keep it concise and trader-focused.

End your response with: TITLE: <6-8 word summary of the key market finding>`
    } else if (mode === "strategy-review") {
      userPrompt = `Search the web and compare my trading strategy (SMC/ICT-based S/R confluence system for prop futures trading) to current best practices and what's working for other prop traders. I want to avoid echo chamber thinking. Look for:
- Alternative approaches that might complement my strategy
- Common mistakes prop traders make with SMC/ICT systems
- Any evolving market conditions that might require strategy adaptation
- Critique of confluence-based systems — what are their weaknesses?
Be honest, even if it challenges my current approach.

End your response with: TITLE: <6-8 word summary of the key strategic insight>`
    }

    if (!userPrompt) {
      return NextResponse.json({ error: "No message provided" }, { status: 400 })
    }

    const requestConfig = useGrounding
      ? { tools: [{ googleSearch: {} }] }
      : {}

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user", parts: [{ text: systemContext }] },
        { role: "model", parts: [{ text: "Understood. I have full context on your strategy, recent trades, and coaching history. I'm ready to coach you with specific, actionable insights. What do you need?" }] },
        { role: "user", parts: [{ text: userPrompt }] },
      ],
      config: requestConfig,
    })

    const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
    if (!rawText) {
      return NextResponse.json({ error: "Empty response from Gemini" }, { status: 502 })
    }

    let reply = rawText
    let newPatternSummary: string | undefined
    let sessionTitle: string | undefined

    // Extract TITLE line from any response
    const titleMatch = rawText.match(/^TITLE:\s*(.+)$/im)
    if (titleMatch) {
      sessionTitle = titleMatch[1].trim()
      reply = reply.replace(/^TITLE:\s*.+$/im, "").trim()
    }

    // Extract PATTERN SUMMARY UPDATE for analyze mode
    if (mode === "analyze") {
      const summaryMatch = rawText.match(/PATTERN SUMMARY UPDATE:\s*([\s\S]+?)(?:\n\n|$)/i)
      if (summaryMatch) {
        newPatternSummary = summaryMatch[1].trim()
        reply = reply.replace(/PATTERN SUMMARY UPDATE:[\s\S]+$/i, "").trim()
      }

      const momentum = reply.toLowerCase().includes("improving") || reply.toLowerCase().includes("positive") ? "positive"
        : reply.toLowerCase().includes("struggle") || reply.toLowerCase().includes("negative") ? "negative"
        : "neutral"

      const coaching = {
        marketSnapshot: reply.slice(0, 200),
        patterns: "See full analysis",
        process: "See full analysis",
        risk: "See full analysis",
        priority: reply.split("\n").find(l => l.toLowerCase().includes("priority") || l.toLowerCase().includes("focus")) || reply.slice(0, 100),
        momentum,
      }

      return NextResponse.json({ reply, coaching, newPatternSummary, sessionTitle })
    }

    // For non-analyze modes, add a TITLE instruction at the end of the prompt
    // (we inject it above into userPrompt for analyze; for others we extract if Gemini includes one)
    return NextResponse.json({ reply, newPatternSummary, sessionTitle })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    if (message.includes("API_KEY") || message.includes("401")) {
      return NextResponse.json({ error: "Invalid Gemini API key" }, { status: 401 })
    }
    return NextResponse.json({ error: "Coach unavailable — try again" }, { status: 500 })
  }
}
