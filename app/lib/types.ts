export interface Trade {
  id: string
  date: string
  time: string
  instrument: string
  direction: "long" | "short"
  session: string
  contracts: number
  pnl: number
  rmult: number
  outcome: "win" | "loss" | "breakeven"
  confluences: string[]
  notes: string
}

export interface CoachingEntry {
  id: string
  timestamp: string
  tradeCount: number
  title: string          // AI-generated 6-8 word summary
  fullContent: string    // full coach response text
  archived: boolean
  mode: "analyze" | "market-pulse" | "strategy-review" | "chat"
  // legacy structured fields (kept for backward compat)
  marketSnapshot: string
  patterns: string
  process: string
  risk: string
  priority: string
  momentum: string
}

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
  mode?: "analyze" | "market-pulse" | "strategy-review" | "chat"
}

export type TabId = "strategy" | "checklist" | "log" | "coach"

export interface SessionIndexEntry {
  title: string
  timestamp: string
  mode: CoachingEntry["mode"]
  momentumLabel: string
}

export interface BehaviorLedger {
  lunchChop: number
  overtrading: number
  revengeTrade: number
  noSetup: number
  skippedBreak: number
  positionSizing: number
  dailyLimitBreached: number
}

export interface MilestoneLog {
  firstProfitableDay?: string
  firstWinStreak3?: string
  firstWinStreak5?: string
  bestRSession?: number
  bestDayPnl?: number
  lowestDrawdown?: number
}

export interface Streaks {
  currentWin: number
  currentLoss: number
  longestWin: number
  longestLoss: number
  ruleAdherentDays: number
  longestRuleAdherent: number
}

export interface JournalMemory {
  shortTerm: string
  mediumTerm: string
  longTerm: string
  mediumCounter: number
  longCounter: number
}

export interface WeeklySummary {
  weekOf: string
  trades: number
  pnl: number
  winRate: number
  topSession: string
  topViolation: string
}

export interface MonthlySummary {
  monthOf: string
  trades: number
  pnl: number
  winRate: number
  bestWeekOf: string
  worstWeekOf: string
}
