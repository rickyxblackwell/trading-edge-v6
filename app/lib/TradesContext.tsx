"use client"

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react"
import type { Trade, CoachingEntry } from "./types"
import { tradeToRow, rowToTrade, coachingEntryToRow, rowToCoachingEntry } from "./supabaseSerializers"
import { useToast } from "./toast"
import { Toast } from "../components/Toast"
import { createClient } from "@/lib/supabase/client"
import { useAuthContext } from "../components/AuthProvider"

const TRADES_KEY = "edge_v5_trades"
const COACHING_KEY = "edge_v5_coaching_history"
const PATTERN_KEY = "edge_v5_pattern_summary"
const STRATEGY_KEY = "edge_v5_strategy_text"

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

export function TradesProvider({ children }: { children: React.ReactNode }) {
  const [trades, setTrades] = useState<Trade[]>([])
  const [coachingHistory, setCoachingHistory] = useState<CoachingEntry[]>([])
  const [patternSummary, setPatternSummary] = useState("")
  const [strategyText, setStrategyText] = useState("")
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

      // Pattern summary + strategy text live in user_metadata — no DB call needed (D-11, D-12)
      const meta = user!.user_metadata ?? {}
      const summary = typeof meta.pattern_summary === "string" ? meta.pattern_summary : undefined
      const strategy = typeof meta.strategy_text === "string" ? meta.strategy_text : undefined
      if (!cancelled && summary !== undefined) setPatternSummary(summary)
      if (!cancelled && strategy !== undefined) setStrategyText(strategy)
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

  // Persist coaching to localStorage (cap at 30 — known bug, fixed in Phase 3 STABLE-02; preserve current behavior here)
  useEffect(() => {
    if (hydrated) localStorage.setItem(COACHING_KEY, JSON.stringify(coachingHistory.slice(-30)))
  }, [coachingHistory, hydrated])

  // Persist pattern summary
  useEffect(() => {
    if (hydrated) localStorage.setItem(PATTERN_KEY, patternSummary)
  }, [patternSummary, hydrated])

  // Persist strategy text
  useEffect(() => {
    if (hydrated) localStorage.setItem(STRATEGY_KEY, strategyText)
  }, [strategyText, hydrated])

  // ============================================================
  // Mutations — D-01 optimistic, D-02 toast + rollback on error
  // ============================================================

  const addTrade = useCallback(
    async (t: Trade) => {
      setTrades((prev) => [t, ...prev])
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
