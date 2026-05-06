"use client"

import { createContext, useContext, useEffect, useState, useCallback } from "react"
import type { Trade, CoachingEntry } from "./types"

const TRADES_KEY = "edge_v5_trades"
const COACHING_KEY = "edge_v5_coaching_history"
const PATTERN_KEY = "edge_v5_pattern_summary"

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

export function TradesProvider({ children }: { children: React.ReactNode }) {
  const [trades, setTrades] = useState<Trade[]>([])
  const [coachingHistory, setCoachingHistory] = useState<CoachingEntry[]>([])
  const [patternSummary, setPatternSummary] = useState("")
  const [hydrated, setHydrated] = useState(false)

  // Hydrate from localStorage on mount
  useEffect(() => {
    setTrades(readLS<Trade[]>(TRADES_KEY, []))
    setCoachingHistory(readLS<CoachingEntry[]>(COACHING_KEY, []))
    setPatternSummary(readLS<string>(PATTERN_KEY, ""))
    setHydrated(true)
  }, [])

  // Persist trades
  useEffect(() => {
    if (hydrated) localStorage.setItem(TRADES_KEY, JSON.stringify(trades))
  }, [trades, hydrated])

  // Persist coaching (cap at 30)
  useEffect(() => {
    if (hydrated) localStorage.setItem(COACHING_KEY, JSON.stringify(coachingHistory.slice(-30)))
  }, [coachingHistory, hydrated])

  // Persist pattern summary
  useEffect(() => {
    if (hydrated) localStorage.setItem(PATTERN_KEY, patternSummary)
  }, [patternSummary, hydrated])

  const addTrade = useCallback((t: Trade) => {
    setTrades((prev) => [t, ...prev])
  }, [])

  const deleteTrade = useCallback((id: string) => {
    setTrades((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addCoachingEntry = useCallback((e: CoachingEntry) => {
    setCoachingHistory((prev) => [...prev, e].slice(-60))
  }, [])

  const updateCoachingEntry = useCallback((id: string, updates: Partial<CoachingEntry>) => {
    setCoachingHistory((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updates } : e))
    )
  }, [])

  const updatePatternSummary = useCallback((s: string) => {
    setPatternSummary(s)
  }, [])

  const importData = useCallback((pkg: ExportPackage) => {
    setTrades(pkg.trades ?? [])
    setCoachingHistory(pkg.coachingHistory ?? [])
    if (pkg.strategyText !== undefined) {
      localStorage.setItem("edge_v5_strategy_text", pkg.strategyText)
    }
  }, [])

  return (
    <TradesContext.Provider value={{ trades, addTrade, deleteTrade, coachingHistory, addCoachingEntry, updateCoachingEntry, importData, patternSummary, updatePatternSummary }}>
      {children}
    </TradesContext.Provider>
  )
}

export function useTrades() {
  const ctx = useContext(TradesContext)
  if (!ctx) throw new Error("useTrades must be inside TradesProvider")
  return ctx
}
