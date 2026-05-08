"use client"

import { useMemo, useRef, useState } from "react"
import type { Trade } from "../../lib/types"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from "recharts"
import { useTrades, type ExportPackage } from "../../lib/TradesContext"

/* ─── Types ─────────────────────────────────────────────────── */
type EquityPeriod = "5d" | "30d" | "6m" | "1y" | "5y" | "all"

/* ─── Equity curve data ──────────────────────────────────────── */
function getFilteredCurve(allTrades: Trade[], period: EquityPeriod) {
  const sorted = [...allTrades].sort((a, b) => a.date.localeCompare(b.date))
  let filtered = sorted
  if (period !== "all") {
    const now = new Date()
    const cutoff = new Date(now)
    if (period === "5d") cutoff.setDate(now.getDate() - 5)
    else if (period === "30d") cutoff.setDate(now.getDate() - 30)
    else if (period === "6m") cutoff.setMonth(now.getMonth() - 6)
    else if (period === "1y") cutoff.setFullYear(now.getFullYear() - 1)
    else if (period === "5y") cutoff.setFullYear(now.getFullYear() - 5)
    const cutStr = cutoff.toISOString().slice(0, 10)
    filtered = sorted.filter((t) => t.date >= cutStr)
  }
  // Cumulative P&L — one point per trading day
  let cum = 0
  const byDate: Record<string, number> = {}
  for (const t of filtered) {
    cum += t.pnl
    byDate[t.date] = cum
  }
  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, pnl]) => ({ date: date.slice(5), pnl }))
}

/* ─── Stat helpers ─────────────────────────────────────────── */
function computeStats(trades: Trade[]) {
  if (!trades.length) return null

  const wins = trades.filter((t) => t.outcome === "win")
  const losses = trades.filter((t) => t.outcome === "loss")
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0)
  const avgR = trades.reduce((s, t) => s + t.rmult, 0) / trades.length
  const grossWin = wins.reduce((s, t) => s + t.pnl, 0)
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0))
  const profitFactor = grossLoss === 0 ? Infinity : grossWin / grossLoss

  const bestTrade = Math.max(...trades.map((t) => t.pnl))
  const worstTrade = Math.min(...trades.map((t) => t.pnl))

  // Equity curve — cumulative P&L by date (full, unfiltered)
  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date))
  let cumulative = 0
  const equityCurve = sorted.map((t) => {
    cumulative += t.pnl
    return { date: t.date.slice(5), pnl: cumulative }
  })

  // Session breakdown
  const sessionMap: Record<string, number> = {}
  trades.forEach((t) => {
    sessionMap[t.session] = (sessionMap[t.session] || 0) + 1
  })
  const sessionData = Object.entries(sessionMap).map(([name, value]) => ({ name, value }))

  // Max drawdown (peak-to-trough on cumulative equity)
  let peak = 0
  let maxDrawdown = 0
  let maxDrawdownPct = 0
  equityCurve.forEach((pt) => {
    if (pt.pnl > peak) peak = pt.pnl
    const dd = peak - pt.pnl
    if (dd > maxDrawdown) {
      maxDrawdown = dd
      maxDrawdownPct = peak > 0 ? (dd / peak) * 100 : 0
    }
  })

  // Streaks
  let longestWinStreak = 0
  let longestLossStreak = 0
  let tempStreak = 0
  let tempType = ""
  sorted.forEach((t) => {
    if (t.outcome === tempType) {
      tempStreak++
    } else {
      tempType = t.outcome
      tempStreak = 1
    }
    if (t.outcome === "win" && tempStreak > longestWinStreak) longestWinStreak = tempStreak
    if (t.outcome === "loss" && tempStreak > longestLossStreak) longestLossStreak = tempStreak
  })

  // Current streak from most recent trade
  const lastOutcome = sorted[sorted.length - 1]?.outcome
  let cs = 0
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].outcome === lastOutcome) cs++
    else break
  }
  const currentStreak = cs
  const currentStreakType = lastOutcome ?? ""

  // Avg win $ vs avg loss $
  const avgWin = wins.length ? grossWin / wins.length : 0
  const avgLoss = losses.length ? grossLoss / losses.length : 0
  const payoffRatio = avgLoss > 0 ? avgWin / avgLoss : 0

  // Confluence win-rate breakdown
  const confMap: Record<string, { wins: number; total: number }> = {}
  trades.forEach((t) => {
    t.confluences.forEach((c) => {
      if (!confMap[c]) confMap[c] = { wins: 0, total: 0 }
      confMap[c].total++
      if (t.outcome === "win") confMap[c].wins++
    })
  })
  const confData = Object.entries(confMap)
    .map(([name, d]) => ({ name, winRate: Math.round((d.wins / d.total) * 100), total: d.total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)

  // Day of week P&L
  const dowMap: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
  trades.forEach((t) => {
    const dow = new Date(t.date + "T12:00:00").getDay()
    dowMap[dow] = (dowMap[dow] || 0) + t.pnl
  })
  const dowData = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    .map((d, i) => ({ day: d, pnl: dowMap[i] || 0 }))
    .filter((d) => d.pnl !== 0)

  return {
    wins,
    losses,
    totalPnl,
    avgR,
    profitFactor,
    bestTrade,
    worstTrade,
    equityCurve,
    sessionData,
    maxDrawdown,
    maxDrawdownPct,
    currentStreak,
    currentStreakType,
    longestWinStreak,
    longestLossStreak,
    avgWin,
    avgLoss,
    payoffRatio,
    confData,
    dowData,
  }
}

const SESSION_COLORS = ["var(--accent)", "var(--purple)", "var(--yellow)", "var(--green)"]
const EQUITY_PERIODS: EquityPeriod[] = ["5d", "30d", "6m", "1y", "5y", "all"]

/* ─── Custom tooltips ───────────────────────────────────────── */
function EquityTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const val = payload[0].value
  return (
    <div
      className="glass rounded-lg px-3 py-2 text-xs mono"
      style={{ backdropFilter: "blur(12px) saturate(160%)" }}
    >
      <p className="label-upper mb-0.5">{label}</p>
      <p style={{ color: val >= 0 ? "var(--green)" : "var(--red)" }}>
        {val >= 0 ? "+" : ""}${val.toLocaleString()}
      </p>
    </div>
  )
}

function DowTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const val = payload[0].value
  return (
    <div
      className="glass rounded-lg px-3 py-2 text-xs mono"
      style={{ backdropFilter: "blur(12px) saturate(160%)" }}
    >
      <p className="label-upper mb-0.5">{label}</p>
      <p style={{ color: val >= 0 ? "var(--green)" : "var(--red)" }}>
        {val >= 0 ? "+" : ""}${val.toLocaleString()}
      </p>
    </div>
  )
}

/* ─── KPI card ─────────────────────────────────────────────── */
function KPI({
  label,
  value,
  sub,
  color,
  size = "normal",
}: {
  label: string
  value: string
  sub?: string
  color?: string
  size?: "normal" | "large"
}) {
  return (
    <div className="glass rounded-2xl p-4 flex flex-col justify-between" style={{ minHeight: 76 }}>
      <p className="label-upper mb-2" style={{ color: "var(--text2)" }}>
        {label}
      </p>
      <p
        className="mono font-semibold leading-none"
        style={{
          color: color ?? "var(--text)",
          fontSize: size === "large" ? "1.75rem" : "1.25rem",
        }}
      >
        {value}
      </p>
      {sub && (
        <p className="mono text-xs mt-1" style={{ color: "var(--text2)" }}>
          {sub}
        </p>
      )}
    </div>
  )
}

/* ─── V4 → V5 trade normalizer ───────────────────────────────
   V4.0 stored: outcome "Win"/"Loss"/"BE"/"Rule Break", direction "Long"/"Short"
   V5 expects:  outcome "win"/"loss"/"breakeven",        direction "long"/"short"
──────────────────────────────────────────────────────────── */
function normalizeOutcome(raw: unknown): "win" | "loss" | "breakeven" {
  const s = String(raw ?? "").toLowerCase().trim()
  if (s === "win") return "win"
  if (s === "loss") return "loss"
  return "breakeven" // covers "be", "breakeven", "rule break", ""
}

function normalizeDirection(raw: unknown): "long" | "short" {
  return String(raw ?? "").toLowerCase().trim() === "short" ? "short" : "long"
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeTrade(t: any): Trade {
  return {
    id: String(t.id ?? crypto.randomUUID()),
    date: String(t.date ?? ""),
    time: String(t.time ?? ""),
    instrument: String(t.instrument ?? ""),
    direction: normalizeDirection(t.direction),
    session: String(t.session ?? ""),
    contracts: Number(t.contracts ?? 1),
    pnl: Number(t.pnl ?? 0),
    rmult: Number(t.rmult ?? 0),
    outcome: normalizeOutcome(t.outcome),
    confluences: Array.isArray(t.confluences) ? t.confluences.map(String) : [],
    notes: String(t.notes ?? ""),
  }
}

/* ─── Data manager — export / import ────────────────────────── */
function DataManager() {
  const { trades, coachingHistory, importData } = useTrades()
  const fileRef = useRef<HTMLInputElement>(null)
  const [importStatus, setImportStatus] = useState<"idle" | "ok" | "err">("idle")
  const [importCount, setImportCount] = useState(0)

  const doExport = () => {
    const pkg: ExportPackage = {
      version: "v5",
      exportedAt: new Date().toISOString(),
      trades,
      coachingHistory,
      strategyText: localStorage.getItem("edge_v5_strategy_text") ?? "",
    }
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `trading-edge-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = JSON.parse(ev.target?.result as string) as any

        const rawTrades: unknown[] = Array.isArray(raw)
          ? raw
          : Array.isArray(raw.trades)
          ? raw.trades
          : null

        if (!rawTrades) throw new Error("No trades array found")

        const normalizedTrades = rawTrades.map(normalizeTrade)
        importData({
          version: "v5",
          exportedAt: new Date().toISOString(),
          trades: normalizedTrades,
          coachingHistory: Array.isArray(raw.coachingHistory) ? raw.coachingHistory : [],
          strategyText: typeof raw.strategyText === "string" ? raw.strategyText : "",
        })
        setImportCount(normalizedTrades.length)
        setImportStatus("ok")
        setTimeout(() => setImportStatus("idle"), 4000)
      } catch {
        setImportStatus("err")
        setTimeout(() => setImportStatus("idle"), 3000)
      }
      e.target.value = ""
    }
    reader.readAsText(file)
  }

  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      <p className="label-upper">Data</p>

      <div className="grid grid-cols-2 gap-2">
        {/* Export */}
        <button
          onClick={doExport}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl mono text-xs font-semibold transition-colors duration-150"
          style={{
            background: "var(--accent3)",
            border: "1px solid var(--border-accent)",
            color: "var(--accent)",
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export JSON
        </button>

        {/* Import */}
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl mono text-xs font-semibold transition-colors duration-150"
          style={{
            background:
              importStatus === "ok"
                ? "rgba(52,211,153,0.08)"
                : importStatus === "err"
                ? "rgba(248,113,113,0.08)"
                : "rgba(255,255,255,0.04)",
            border: `1px solid ${
              importStatus === "ok"
                ? "rgba(52,211,153,0.4)"
                : importStatus === "err"
                ? "rgba(248,113,113,0.4)"
                : "var(--border)"
            }`,
            color:
              importStatus === "ok"
                ? "var(--green)"
                : importStatus === "err"
                ? "var(--red)"
                : "var(--text2)",
          }}
        >
          {importStatus === "ok" ? (
            <>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {importCount} trades
            </>
          ) : importStatus === "err" ? (
            <>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Invalid file
            </>
          ) : (
            <>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Import JSON
            </>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={onFileChange}
        />
      </div>

      <p className="mono text-xs" style={{ color: "var(--text3)" }}>
        Export saves all trades, coaching history, and strategy text. Import replaces current data.
      </p>
    </div>
  )
}

/* ─── Main component ────────────────────────────────────────── */
export default function StatsTab() {
  const { trades } = useTrades()
  const stats = useMemo(() => computeStats(trades), [trades])
  const [equityPeriod, setEquityPeriod] = useState<EquityPeriod>("all")
  const filteredCurve = useMemo(
    () => getFilteredCurve(trades, equityPeriod),
    [trades, equityPeriod]
  )

  if (!stats) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-center h-48">
          <p className="label-upper" style={{ color: "var(--text3)" }}>
            No trades logged yet
          </p>
        </div>
        <DataManager />
      </div>
    )
  }

  const {
    wins,
    losses,
    totalPnl,
    avgR,
    profitFactor,
    bestTrade,
    worstTrade,
    sessionData,
    maxDrawdown,
    maxDrawdownPct,
    currentStreak,
    currentStreakType,
    avgWin,
    avgLoss,
    payoffRatio,
    confData,
    dowData,
  } = stats

  const winRate = (wins.length / trades.length) * 100

  // Streak display: "3W" green, "2L" red
  const streakLabel =
    currentStreak > 0
      ? `${currentStreak}${currentStreakType === "win" ? "W" : currentStreakType === "loss" ? "L" : "BE"}`
      : "—"
  const streakColor =
    currentStreakType === "win"
      ? "var(--green)"
      : currentStreakType === "loss"
      ? "var(--red)"
      : "var(--text2)"

  // Max drawdown display
  const drawdownLabel =
    maxDrawdown > 0
      ? `-$${maxDrawdown.toLocaleString(undefined, { maximumFractionDigits: 0 })} (${maxDrawdownPct.toFixed(1)}%)`
      : "$0"
  const drawdownColor = maxDrawdown > 0 ? "var(--red)" : "var(--green)"

  return (
    <div className="p-4 space-y-4">
      {/* ── Row 1: Hero P&L + Win Rate ── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Hero P&L — spans context via large size */}
        <div
          className="glass rounded-2xl p-4 col-span-2"
          style={{ borderBottom: `1px solid ${totalPnl >= 0 ? "rgba(0,229,160,0.2)" : "rgba(255,61,90,0.2)"}` }}
        >
          <p className="label-upper mb-1" style={{ color: "var(--text2)" }}>
            Total P&amp;L
          </p>
          <p
            className="mono font-semibold leading-none"
            style={{
              color: totalPnl >= 0 ? "var(--green)" : "var(--red)",
              fontSize: "2.5rem",
            }}
          >
            {totalPnl >= 0 ? "+" : ""}${totalPnl.toLocaleString()}
          </p>
          <p className="mono text-xs mt-2" style={{ color: "var(--text2)" }}>
            {trades.length} trades &middot; {wins.length}W&nbsp;{losses.length}L
          </p>
        </div>

        <KPI
          label="Win Rate"
          value={`${winRate.toFixed(0)}%`}
          color={winRate >= 50 ? "var(--green)" : "var(--red)"}
        />
        <KPI
          label="Avg R-Mult"
          value={`${avgR >= 0 ? "+" : ""}${avgR.toFixed(2)}R`}
          color={avgR >= 0 ? "var(--green)" : "var(--red)"}
        />
      </div>

      {/* ── Row 2: Profit Factor + Total Trades ── */}
      <div className="grid grid-cols-2 gap-3">
        <KPI
          label="Profit Factor"
          value={isFinite(profitFactor) ? profitFactor.toFixed(2) : "∞"}
          color="var(--accent)"
        />
        <KPI label="Total Trades" value={trades.length.toString()} />
      </div>

      {/* ── Row 3: Best Trade + Worst Trade ── */}
      <div className="grid grid-cols-2 gap-3">
        <KPI
          label="Best Trade"
          value={`${bestTrade >= 0 ? "+" : ""}$${Math.abs(bestTrade).toLocaleString()}`}
          color="var(--green)"
        />
        <KPI
          label="Worst Trade"
          value={`${worstTrade >= 0 ? "+" : "-"}$${Math.abs(worstTrade).toLocaleString()}`}
          color={worstTrade < 0 ? "var(--red)" : "var(--text2)"}
        />
      </div>

      {/* ── Row 4: Max Drawdown + Current Streak ── */}
      <div className="grid grid-cols-2 gap-3">
        <KPI label="Max Drawdown" value={drawdownLabel} color={drawdownColor} />
        <KPI
          label="Streak"
          value={streakLabel}
          color={streakColor}
          sub={currentStreak > 0 ? `current ${currentStreakType}` : undefined}
        />
      </div>

      {/* ── Row 5: Avg Win + Avg Loss ── */}
      <div className="grid grid-cols-2 gap-3">
        <KPI
          label="Avg Win $"
          value={`+$${avgWin.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          color="var(--green)"
        />
        <KPI
          label="Avg Loss $"
          value={`-$${avgLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          color="var(--red)"
        />
      </div>

      {/* ── Row 6: Payoff Ratio ── */}
      <div className="grid grid-cols-2 gap-3">
        <KPI
          label="Payoff Ratio"
          value={payoffRatio > 0 ? payoffRatio.toFixed(2) : "—"}
          color="var(--accent)"
          sub="avg win / avg loss"
        />
        <KPI
          label="Break-Even"
          value={trades.length - wins.length - losses.length > 0
            ? String(trades.length - wins.length - losses.length)
            : "0"}
          sub="trades"
        />
      </div>

      {/* ── Equity Curve ── */}
      {(() => {
        const lastVal = filteredCurve.length > 0 ? filteredCurve[filteredCurve.length - 1].pnl : 0
        const lineColor = lastVal >= 0 ? "#00e5a0" : "#ff3d5a"
        const gradId = lastVal >= 0 ? "equity-grad-pos" : "equity-grad-neg"
        return (
          <div className="glass rounded-2xl p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <p className="label-upper">Equity Curve</p>
                {filteredCurve.length > 0 && (
                  <span className="mono text-xs font-semibold"
                    style={{ color: lineColor }}>
                    {lastVal >= 0 ? "+" : ""}${Math.abs(lastVal).toLocaleString()}
                  </span>
                )}
              </div>
              <div className="flex gap-1">
                {EQUITY_PERIODS.map((p) => (
                  <button key={p} onClick={() => setEquityPeriod(p)}
                    className="mono text-xs px-2 py-0.5 rounded-md transition-all duration-150"
                    style={{
                      background: equityPeriod === p ? "var(--accent)" : "rgba(255,255,255,0.05)",
                      color: equityPeriod === p ? "#060b14" : "var(--text2)",
                      border: `1px solid ${equityPeriod === p ? "var(--accent)" : "rgba(255,255,255,0.08)"}`,
                      fontWeight: equityPeriod === p ? 700 : 400,
                    }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {filteredCurve.length === 0 ? (
              <p className="mono text-xs text-center py-8" style={{ color: "var(--text3)" }}>
                No trades in selected period
              </p>
            ) : (
              <div style={{ height: 190 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={filteredCurve} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="equity-grad-pos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#00e5a0" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="#00e5a0" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="equity-grad-neg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#ff3d5a" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="#ff3d5a" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      interval="preserveStartEnd"
                      tick={{ fontSize: 10, fill: "var(--text3)", fontFamily: "var(--font-ibm-plex-mono)" }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={46}
                      tick={{ fontSize: 10, fill: "var(--text3)", fontFamily: "var(--font-ibm-plex-mono)" }}
                      tickFormatter={(v: number) => {
                        const abs = Math.abs(v)
                        const fmt = abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : String(abs)
                        return v < 0 ? `-$${fmt}` : `$${fmt}`
                      }}
                    />
                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
                    <Tooltip content={<EquityTooltip />} cursor={{ stroke: "rgba(255,255,255,0.15)", strokeWidth: 1 }} />
                    <Area
                      type="natural"
                      dataKey="pnl"
                      stroke={lineColor}
                      strokeWidth={1.5}
                      fill={`url(#${gradId})`}
                      fillOpacity={0.4}
                      dot={false}
                      activeDot={{ r: 4, fill: lineColor, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )
      })()}

      {/* ── Outcome Breakdown ── */}
      {(() => {
        const be = trades.length - wins.length - losses.length
        const outcomeData = [
          { name: "Win",  value: wins.length,   color: "var(--green)"  },
          { name: "Loss", value: losses.length,  color: "var(--red)"    },
          { name: "B/E",  value: be,             color: "var(--yellow)" },
        ].filter(d => d.value > 0)
        const total = trades.length
        return (
          <div className="glass rounded-2xl p-4">
            <p className="label-upper mb-3">Outcome Breakdown</p>
            <div className="flex items-center gap-4">
              <div style={{ width: 96, height: 96, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={outcomeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={26}
                      outerRadius={42}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {outcomeData.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 flex-1 min-w-0">
                {outcomeData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                      <span className="text-xs" style={{ color: "var(--text2)" }}>{d.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="mono text-xs" style={{ color: "var(--text3)" }}>
                        {total > 0 ? Math.round((d.value / total) * 100) : 0}%
                      </span>
                      <span className="mono text-xs" style={{ color: "var(--text)" }}>{d.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Session Breakdown ── */}
      <div className="glass rounded-2xl p-4">
        <p className="label-upper mb-3">Session Breakdown</p>
        <div className="flex items-center gap-4">
          <div style={{ width: 96, height: 96, flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sessionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={26}
                  outerRadius={42}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {sessionData.map((_, i) => (
                    <Cell key={i} fill={SESSION_COLORS[i % SESSION_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 flex-1 min-w-0">
            {sessionData.map((s, i) => (
              <div key={s.name} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: SESSION_COLORS[i % SESSION_COLORS.length] }}
                  />
                  <span
                    className="text-xs truncate"
                    style={{ color: "var(--text2)" }}
                  >
                    {s.name}
                  </span>
                </div>
                <span className="mono text-xs flex-shrink-0" style={{ color: "var(--text)" }}>
                  {s.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Confluence Performance ── */}
      {confData.length > 0 && (
        <div className="glass rounded-2xl p-4">
          <p className="label-upper mb-3">Confluence Performance</p>
          <div className="space-y-3">
            {confData.map((c) => (
              <div key={c.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs" style={{ color: "var(--text2)" }}>
                    {c.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className="mono text-xs font-semibold"
                      style={{
                        color:
                          c.winRate >= 60
                            ? "var(--green)"
                            : c.winRate >= 45
                            ? "var(--yellow)"
                            : "var(--red)",
                      }}
                    >
                      {c.winRate}%
                    </span>
                    <span className="mono text-xs" style={{ color: "var(--text3)" }}>
                      ({c.total})
                    </span>
                  </div>
                </div>
                {/* Progress bar */}
                <div
                  className="w-full rounded-full overflow-hidden"
                  style={{ height: 4, background: "rgba(255,255,255,0.06)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${c.winRate}%`,
                      background:
                        c.winRate >= 60
                          ? "var(--green)"
                          : c.winRate >= 45
                          ? "var(--yellow)"
                          : "var(--red)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Day of Week P&L ── */}
      {dowData.length > 0 && (
        <div className="glass rounded-2xl p-4">
          <p className="label-upper mb-3">P&amp;L by Day of Week</p>
          <div style={{ height: 100 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dowData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <XAxis
                  dataKey="day"
                  tick={{
                    fontSize: 9,
                    fill: "var(--text3)",
                    fontFamily: "var(--font-ibm-plex-mono)",
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{
                    fontSize: 9,
                    fill: "var(--text3)",
                    fontFamily: "var(--font-ibm-plex-mono)",
                  }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip content={<DowTooltip />} />
                <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                  {dowData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.pnl >= 0 ? "var(--green)" : "var(--red)"}
                      fillOpacity={0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Data Manager ── */}
      <DataManager />
    </div>
  )
}
