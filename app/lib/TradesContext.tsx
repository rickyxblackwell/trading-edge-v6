"use client"

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react"
import type { Trade, CoachingEntry, SessionIndexEntry, BehaviorLedger, MilestoneLog, Streaks, JournalMemory, WeeklySummary, MonthlySummary } from "./types"
import { tradeToRow, rowToTrade, coachingEntryToRow, rowToCoachingEntry } from "./supabaseSerializers"
import { useToast } from "./toast"
import { Toast } from "../components/Toast"
import { createClient } from "@/lib/supabase/client"
import { useAuthContext } from "../components/AuthProvider"

const TRADES_KEY = "edge_v5_trades"
const COACHING_KEY = "edge_v5_coaching_history"
const PATTERN_KEY = "edge_v5_pattern_summary"
const STRATEGY_KEY = "edge_v5_strategy_text"
const WATCHLIST_KEY = "edge_v5_watchlist"

const ZERO_BEHAVIOR_LEDGER: BehaviorLedger = {
  lunchChop: 0, overtrading: 0, revengeTrade: 0, noSetup: 0,
  skippedBreak: 0, positionSizing: 0, dailyLimitBreached: 0,
}
const ZERO_STREAKS: Streaks = {
  currentWin: 0, currentLoss: 0, longestWin: 0, longestLoss: 0,
  ruleAdherentDays: 0, longestRuleAdherent: 0,
}
const ZERO_JOURNAL_MEMORY: JournalMemory = {
  shortTerm: "", mediumTerm: "", longTerm: "",
  mediumCounter: 0, longCounter: 0,
}

export interface ExportPackage {
  version: "v5"
  exportedAt: string
  trades: Trade[]
  coachingHistory: CoachingEntry[]
  strategyText: string
}

interface TradesContextValue {
  trades: Trade[]
  addTrade: (t: Trade) => void
  deleteTrade: (id: string) => void
  coachingHistory: CoachingEntry[]
  addCoachingEntry: (e: CoachingEntry) => void
  updateCoachingEntry: (id: string, updates: Partial<CoachingEntry>) => void
  importData: (pkg: ExportPackage) => void
  patternSummary: string
  updatePatternSummary: (s: string) => void
  strategyText: string
  updateStrategyText: (s: string) => void
  watchlist: string[]
  updateWatchlist: (add: string[], remove: string[]) => void
  sessionIndex: SessionIndexEntry[]
  updateSessionIndex: (entry: SessionIndexEntry) => void
  behaviorLedger: BehaviorLedger
  updateBehaviorLedger: (increments: Partial<BehaviorLedger>) => void
  milestoneLog: MilestoneLog
  updateMilestoneLog: (updates: Partial<MilestoneLog>) => void
  streaks: Streaks
  updateStreaks: (s: Streaks) => void
  journalMemory: JournalMemory
  updateJournalMemory: (j: JournalMemory) => void
  weeklySummaries: WeeklySummary[]
  updateWeeklySummaries: (updates: WeeklySummary[]) => void
  monthlySummaries: MonthlySummary[]
  updateMonthlySummaries: (updates: MonthlySummary[]) => void
}

const TradesContext = createContext<TradesContextValue | null>(null)

function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function readLSString(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

function buildCompactLine(t: { date: string; instrument: string; direction: string; session: string; pnl: number; rmult: number; outcome: string; confluences: string[]; notes: string }): string {
  const sign = t.pnl >= 0 ? "+" : ""
  const confs = t.confluences.length > 0 ? t.confluences.join(",") : "none"
  const noteSnippet = t.notes ? t.notes.slice(0, 40) : ""
  return `${t.date} | ${t.instrument} ${t.direction.toUpperCase()} | ${t.session} | ${sign}$${t.pnl} | ${t.rmult.toFixed(1)}R | ${t.outcome.toUpperCase()} | ${confs}${noteSnippet ? " | " + noteSnippet : ""}`
}

export function TradesProvider({ children }: { children: React.ReactNode }) {
  const [trades, setTrades] = useState<Trade[]>([])
  const [coachingHistory, setCoachingHistory] = useState<CoachingEntry[]>([])
  const [patternSummary, setPatternSummary] = useState("")
  const [strategyText, setStrategyText] = useState("")
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [sessionIndex, setSessionIndex] = useState<SessionIndexEntry[]>([])
  const [behaviorLedger, setBehaviorLedger] = useState<BehaviorLedger>(ZERO_BEHAVIOR_LEDGER)
  const [milestoneLog, setMilestoneLog] = useState<MilestoneLog>({})
  const [streaks, setStreaks] = useState<Streaks>(ZERO_STREAKS)
  const [journalMemory, setJournalMemory] = useState<JournalMemory>(ZERO_JOURNAL_MEMORY)
  const [weeklySummaries, setWeeklySummaries] = useState<WeeklySummary[]>([])
  const [monthlySummaries, setMonthlySummaries] = useState<MonthlySummary[]>([])
  const [hydrated, setHydrated] = useState(false)

  const { user } = useAuthContext()
  // Stable Supabase client across renders — prevents re-instantiation on every render
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  if (!supabaseRef.current) supabaseRef.current = createClient()
  const supabase = supabaseRef.current

  const { toast, showToast } = useToast()

  // Hydrate from localStorage on mount (warm cache — instant render)
  useEffect(() => {
    setTrades(readLS<Trade[]>(TRADES_KEY, []))
    setCoachingHistory(readLS<CoachingEntry[]>(COACHING_KEY, []))
    setPatternSummary(readLS<string>(PATTERN_KEY, ""))
    setStrategyText(readLSString(STRATEGY_KEY, ""))
    setWatchlist(readLS<string[]>(WATCHLIST_KEY, []))
    setHydrated(true)
  }, [])

  // Fetch from Supabase after hydration AND user available — overwrites cache with truth (PERSIST-05)
  // Gate on hydrated && user — prevents empty-array overwrite before auth resolves (Pitfall 2)
  useEffect(() => {
    if (!hydrated || !user) return
    let cancelled = false
    async function fetchFromSupabase() {
      const userId = user!.id
      const tradesRes = await supabase
        .from("trades")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false })
      if (!cancelled && tradesRes.data) {
        setTrades(tradesRes.data.map(rowToTrade))
      }

      const coachingRes = await supabase
        .from("coaching_entries")
        .select("*")
        .eq("user_id", userId)
        .order("timestamp", { ascending: true })
      if (!cancelled && coachingRes.data) {
        setCoachingHistory(coachingRes.data.map(rowToCoachingEntry))
      }

      // user.user_metadata is the cached JWT payload — stale after updateUser calls.
      // getUser() fetches fresh metadata from Supabase server, ensuring watchlist/pattern/strategy reflect latest writes.
      const { data: freshUserData } = await supabase.auth.getUser()
      const meta = freshUserData?.user?.user_metadata ?? user!.user_metadata ?? {}
      const summary = typeof meta.pattern_summary === "string" ? meta.pattern_summary : undefined
      const strategy = typeof meta.strategy_text === "string" ? meta.strategy_text : undefined
      const wl = Array.isArray(meta.watchlist) ? (meta.watchlist as string[]) : undefined
      if (!cancelled && summary !== undefined) setPatternSummary(summary)
      if (!cancelled && strategy !== undefined) setStrategyText(strategy)
      // Only overwrite local watchlist if Supabase has items — empty Supabase must not wipe locally-added tickers
      if (!cancelled && wl !== undefined && wl.length > 0) setWatchlist(wl)
      const rawSessionIndex = meta.session_index
      const rawBehaviorLedger = meta.behavior_ledger
      const rawMilestoneLog = meta.milestone_log
      const rawStreaks = meta.streaks
      const rawJournal = meta.journal_memory
      const rawWeekly = meta.weekly_summaries
      const rawMonthly = meta.monthly_summaries
      if (!cancelled && Array.isArray(rawSessionIndex)) setSessionIndex(rawSessionIndex as SessionIndexEntry[])
      if (!cancelled && rawBehaviorLedger && typeof rawBehaviorLedger === "object") setBehaviorLedger({ ...ZERO_BEHAVIOR_LEDGER, ...(rawBehaviorLedger as Partial<BehaviorLedger>) })
      if (!cancelled && rawMilestoneLog && typeof rawMilestoneLog === "object") setMilestoneLog(rawMilestoneLog as MilestoneLog)
      if (!cancelled && rawStreaks && typeof rawStreaks === "object") setStreaks({ ...ZERO_STREAKS, ...(rawStreaks as Partial<Streaks>) })
      if (!cancelled && rawJournal && typeof rawJournal === "object") setJournalMemory({ ...ZERO_JOURNAL_MEMORY, ...(rawJournal as Partial<JournalMemory>) })
      if (!cancelled && Array.isArray(rawWeekly)) setWeeklySummaries(rawWeekly as WeeklySummary[])
      if (!cancelled && Array.isArray(rawMonthly)) setMonthlySummaries(rawMonthly as MonthlySummary[])
    }
    fetchFromSupabase()
    return () => {
      cancelled = true
    }
  }, [hydrated, user, supabase])

  // Persist trades to localStorage (warm cache stays in sync)
  useEffect(() => {
    if (hydrated) localStorage.setItem(TRADES_KEY, JSON.stringify(trades))
  }, [trades, hydrated])

  useEffect(() => {
    if (hydrated) localStorage.setItem(COACHING_KEY, JSON.stringify(coachingHistory.slice(-60)))
  }, [coachingHistory, hydrated])

  // Persist pattern summary
  useEffect(() => {
    if (hydrated) localStorage.setItem(PATTERN_KEY, patternSummary)
  }, [patternSummary, hydrated])

  // Persist strategy text
  useEffect(() => {
    if (hydrated) localStorage.setItem(STRATEGY_KEY, strategyText)
  }, [strategyText, hydrated])

  // Persist watchlist
  useEffect(() => {
    if (hydrated) localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist))
  }, [watchlist, hydrated])

  // ============================================================
  // Mutations — D-01 optimistic, D-02 toast + rollback on error
  // ============================================================

  const addTrade = useCallback(
    async (t: Trade) => {
      setTrades((prev) => [t, ...prev])
      setJournalMemory(prev => {
        const line = buildCompactLine(t)
        const shortLines = [line, ...(prev.shortTerm ? prev.shortTerm.split("\n") : [])].slice(0, 100)
        const newMediumCounter = prev.mediumCounter + 1
        const mediumLines = prev.mediumTerm ? prev.mediumTerm.split("\n") : []
        if (newMediumCounter >= 5) mediumLines.unshift(line)
        const cappedMedium = mediumLines.slice(0, 100)
        const newLongCounter = prev.longCounter + 1
        const longLines = prev.longTerm ? prev.longTerm.split("\n") : []
        if (newLongCounter >= 10) longLines.unshift(line)
        const cappedLong = longLines.slice(0, 200)
        const next: JournalMemory = {
          shortTerm: shortLines.join("\n"),
          mediumTerm: cappedMedium.join("\n"),
          longTerm: cappedLong.join("\n"),
          mediumCounter: newMediumCounter >= 5 ? 0 : newMediumCounter,
          longCounter: newLongCounter >= 10 ? 0 : newLongCounter,
        }
        if (user) void supabase.auth.updateUser({ data: { journal_memory: next } })
        return next
      })
      if (!user) return // unauthenticated — localStorage only (Phase 1 D-01)
      const { error } = await supabase.from("trades").insert(tradeToRow(t, user.id))
      if (error) {
        setTrades((prev) => prev.filter((trade) => trade.id !== t.id))
        showToast("Failed to save trade — please try again")
      }
    },
    [user, supabase, showToast]
  )

  const deleteTrade = useCallback(
    async (id: string) => {
      // Capture pre-delete snapshot via functional setter to avoid stale-closure rollback (Pitfall 3)
      let snapshot: Trade[] = []
      setTrades((prev) => {
        snapshot = prev
        return prev.filter((t) => t.id !== id)
      })
      if (!user) return
      const { error } = await supabase
        .from("trades")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id)
      if (error) {
        setTrades(snapshot)
        showToast("Failed to delete trade — please try again")
      }
    },
    [user, supabase, showToast]
  )

  const addCoachingEntry = useCallback(
    async (e: CoachingEntry) => {
      setCoachingHistory((prev) => [...prev, e].slice(-60))
      if (!user) return
      const { error } = await supabase
        .from("coaching_entries")
        .insert(coachingEntryToRow(e, user.id))
      if (error) {
        setCoachingHistory((prev) => prev.filter((entry) => entry.id !== e.id))
        showToast("Failed to save coaching entry — please try again")
      }
    },
    [user, supabase, showToast]
  )

  const updateCoachingEntry = useCallback(
    async (id: string, updates: Partial<CoachingEntry>) => {
      let snapshot: CoachingEntry[] = []
      setCoachingHistory((prev) => {
        snapshot = prev
        return prev.map((e) => (e.id === id ? { ...e, ...updates } : e))
      })
      if (!user) return
      // Map only the fields present in updates to snake_case columns
      const rowUpdates: Record<string, unknown> = {}
      if (updates.timestamp !== undefined) rowUpdates.timestamp = updates.timestamp
      if (updates.tradeCount !== undefined) rowUpdates.trade_count = updates.tradeCount
      if (updates.title !== undefined) rowUpdates.title = updates.title
      if (updates.fullContent !== undefined) rowUpdates.full_content = updates.fullContent
      if (updates.archived !== undefined) rowUpdates.archived = updates.archived
      if (updates.mode !== undefined) rowUpdates.mode = updates.mode
      if (updates.marketSnapshot !== undefined) rowUpdates.market_snapshot = updates.marketSnapshot
      if (updates.patterns !== undefined) rowUpdates.patterns = updates.patterns
      if (updates.process !== undefined) rowUpdates.process = updates.process
      if (updates.risk !== undefined) rowUpdates.risk = updates.risk
      if (updates.priority !== undefined) rowUpdates.priority = updates.priority
      if (updates.momentum !== undefined) rowUpdates.momentum = updates.momentum

      const { error } = await supabase
        .from("coaching_entries")
        .update(rowUpdates)
        .eq("id", id)
        .eq("user_id", user.id)
      if (error) {
        setCoachingHistory(snapshot)
        showToast("Failed to update coaching entry — please try again")
      }
    },
    [user, supabase, showToast]
  )

  // Pattern summary — fire-and-forget per D-04 (derived data, regenerable)
  const updatePatternSummary = useCallback(
    (s: string) => {
      setPatternSummary(s)
      if (!user) return
      void supabase.auth.updateUser({ data: { pattern_summary: s } })
    },
    [user, supabase]
  )

  // Strategy text — same fire-and-forget approach to user_metadata per D-12
  const updateStrategyText = useCallback(
    (s: string) => {
      setStrategyText(s)
      if (!user) return
      void supabase.auth.updateUser({ data: { strategy_text: s } })
    },
    [user, supabase]
  )

  const updateWatchlist = useCallback((add: string[], remove: string[]) => {
    setWatchlist(prev => {
      const removeSet = new Set(remove)
      const addFiltered = add.filter(s => !prev.includes(s))
      const next = [...prev.filter(s => !removeSet.has(s)), ...addFiltered]
      if (user) void supabase.auth.updateUser({ data: { watchlist: next } })
      return next
    })
  }, [user, supabase])

  const updateSessionIndex = useCallback(
    (entry: SessionIndexEntry) => {
      setSessionIndex(prev => {
        const next = [entry, ...prev].slice(0, 50)
        if (user) void supabase.auth.updateUser({ data: { session_index: next } })
        return next
      })
    },
    [user, supabase]
  )

  const updateBehaviorLedger = useCallback(
    (increments: Partial<BehaviorLedger>) => {
      setBehaviorLedger(prev => {
        const next: BehaviorLedger = {
          lunchChop: prev.lunchChop + (increments.lunchChop ?? 0),
          overtrading: prev.overtrading + (increments.overtrading ?? 0),
          revengeTrade: prev.revengeTrade + (increments.revengeTrade ?? 0),
          noSetup: prev.noSetup + (increments.noSetup ?? 0),
          skippedBreak: prev.skippedBreak + (increments.skippedBreak ?? 0),
          positionSizing: prev.positionSizing + (increments.positionSizing ?? 0),
          dailyLimitBreached: prev.dailyLimitBreached + (increments.dailyLimitBreached ?? 0),
        }
        if (user) void supabase.auth.updateUser({ data: { behavior_ledger: next } })
        return next
      })
    },
    [user, supabase]
  )

  const updateMilestoneLog = useCallback(
    (updates: Partial<MilestoneLog>) => {
      setMilestoneLog(prev => {
        const next = { ...prev, ...updates }
        if (user) void supabase.auth.updateUser({ data: { milestone_log: next } })
        return next
      })
    },
    [user, supabase]
  )

  const updateStreaks = useCallback(
    (s: Streaks) => {
      setStreaks(s)
      if (!user) return
      void supabase.auth.updateUser({ data: { streaks: s } })
    },
    [user, supabase]
  )

  const updateJournalMemory = useCallback(
    (j: JournalMemory) => {
      setJournalMemory(j)
      if (!user) return
      void supabase.auth.updateUser({ data: { journal_memory: j } })
    },
    [user, supabase]
  )

  const updateWeeklySummaries = useCallback(
    (updates: WeeklySummary[]) => {
      setWeeklySummaries(prev => {
        const map = new Map(prev.map(w => [w.weekOf, w]))
        for (const u of updates) map.set(u.weekOf, u)
        const next = [...map.values()]
          .sort((a, b) => b.weekOf.localeCompare(a.weekOf))
          .slice(0, 52)
        if (user) void supabase.auth.updateUser({ data: { weekly_summaries: next } })
        return next
      })
    },
    [user, supabase]
  )

  const updateMonthlySummaries = useCallback(
    (updates: MonthlySummary[]) => {
      setMonthlySummaries(prev => {
        const map = new Map(prev.map(m => [m.monthOf, m]))
        for (const u of updates) map.set(u.monthOf, u)
        const next = [...map.values()]
          .sort((a, b) => b.monthOf.localeCompare(a.monthOf))
          .slice(0, 24)
        if (user) void supabase.auth.updateUser({ data: { monthly_summaries: next } })
        return next
      })
    },
    [user, supabase]
  )

  const importData = useCallback((pkg: ExportPackage) => {
    setTrades(pkg.trades ?? [])
    setCoachingHistory(pkg.coachingHistory ?? [])
    if (pkg.strategyText !== undefined) {
      setStrategyText(pkg.strategyText)
    }
  }, [])

  return (
    <TradesContext.Provider
      value={{
        trades,
        addTrade,
        deleteTrade,
        coachingHistory,
        addCoachingEntry,
        updateCoachingEntry,
        importData,
        patternSummary,
        updatePatternSummary,
        strategyText,
        updateStrategyText,
        watchlist,
        updateWatchlist,
        sessionIndex,
        updateSessionIndex,
        behaviorLedger,
        updateBehaviorLedger,
        milestoneLog,
        updateMilestoneLog,
        streaks,
        updateStreaks,
        journalMemory,
        updateJournalMemory,
        weeklySummaries,
        updateWeeklySummaries,
        monthlySummaries,
        updateMonthlySummaries,
      }}
    >
      {children}
      <Toast message={toast} />
    </TradesContext.Provider>
  )
}

export function useTrades() {
  const ctx = useContext(TradesContext)
  if (!ctx) throw new Error("useTrades must be inside TradesProvider")
  return ctx
}
