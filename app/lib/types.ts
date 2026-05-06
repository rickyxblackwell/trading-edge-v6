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
