"use client"

import { useState, useMemo } from "react"
import type { Trade } from "../../lib/types"
import { useTrades } from "../../lib/TradesContext"
import { TradeForm, outcomeColor } from "../TradeForm"

type JournalView = "daily" | "weekly" | "monthly"

/* ─── Calendar ──────────────────────────────────────────────── */
function Calendar({
  trades, selectedDate, onSelectDate,
}: {
  trades: Trade[]
  selectedDate: string | null
  onSelectDate: (d: string | null) => void
}) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth()) // 0-indexed

  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDow = new Date(year, month, 1).getDay() // 0=Sun

  // Build day → net P&L map
  const dayMap = useMemo(() => {
    const m: Record<string, number> = {}
    trades.forEach(t => {
      m[t.date] = (m[t.date] ?? 0) + t.pnl
    })
    return m
  }, [trades])

  function dayColor(dateStr: string) {
    if (!(dateStr in dayMap)) return null
    const pnl = dayMap[dateStr]
    if (pnl > 0) return "var(--green)"
    if (pnl < 0) return "var(--red)"
    return "var(--yellow)"
  }

  const nav = (dir: number) => {
    const d = new Date(year, month + dir, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth())
  }

  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`
  const blanks = Array(firstDow).fill(null)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => nav(-1)} className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors" style={{ border: "1px solid var(--border)", color: "var(--text2)" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <span className="mono text-sm font-semibold" style={{ color: "var(--text)" }}>{monthLabel}</span>
        <button onClick={() => nav(1)} className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors" style={{ border: "1px solid var(--border)", color: "var(--text2)" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-0.5">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="label-upper text-center py-1">{d}</div>
        ))}
        {/* Blanks for first-day offset */}
        {blanks.map((_, i) => <div key={`b${i}`} />)}
        {/* Day cells */}
        {days.map(day => {
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
          const color = dayColor(dateStr)
          const isToday = dateStr === todayStr
          const isSel = dateStr === selectedDate
          return (
            <button
              key={day}
              onClick={() => onSelectDate(isSel ? null : dateStr)}
              className="flex flex-col items-center justify-center gap-0.5 rounded-lg transition-colors"
              style={{
                paddingTop: 6,
                paddingBottom: 6,
                background: isSel ? "var(--accent3)" : "transparent",
                border: isToday ? "1px solid var(--border-accent)" : "1px solid transparent",
                color: isSel ? "var(--accent)" : isToday ? "var(--accent)" : "var(--text2)",
              }}
            >
              <span className="mono text-xs leading-none">{day}</span>
              {/* Reserved dot slot — always rendered so numbers don't shift */}
              <span
                className="rounded-full"
                style={{
                  width: 5, height: 5, flexShrink: 0,
                  background: color ?? "transparent",
                  boxShadow: color ? `0 0 4px ${color}` : "none",
                  transition: "background 0.2s ease",
                }}
              />
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 justify-center pt-1">
        {[["var(--green)", "Win day"], ["var(--red)", "Loss day"], ["var(--yellow)", "BE day"]].map(([c, l]) => (
          <div key={l} className="flex items-center gap-1">
            <span className="rounded-full" style={{ width: 7, height: 7, background: c, flexShrink: 0, boxShadow: `0 0 5px ${c}` }} />
            <span className="label-upper">{l}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Stats bar ─────────────────────────────────────────────── */
function StatsBar({ trades }: { trades: Trade[] }) {
  const pnl = trades.reduce((s, t) => s + t.pnl, 0)
  const wins = trades.filter(t => t.outcome === "win").length
  const losses = trades.filter(t => t.outcome === "loss").length
  const be = trades.filter(t => t.outcome === "breakeven").length

  const pnlColor = pnl > 0 ? "var(--green)" : pnl < 0 ? "var(--red)" : "var(--text2)"
  const pnlStr = `${pnl >= 0 ? "+" : "-"}$${Math.abs(pnl).toLocaleString()}`

  const stats = [
    { label: "P&L",    val: pnlStr,         color: pnlColor },
    { label: "Wins",   val: String(wins),   color: "var(--green)" },
    { label: "Losses", val: String(losses), color: "var(--red)" },
    { label: "BE",     val: String(be),     color: "var(--yellow)" },
  ]

  return (
    <div className="glass rounded-2xl px-4 py-3">
      <div className="grid grid-cols-4 gap-2">
        {stats.map(({ label, val, color }) => (
          <div key={label} className="flex flex-col items-center gap-1">
            <span className="label-upper" style={{ color: "var(--text3)" }}>{label}</span>
            <span className="mono font-semibold" style={{ fontSize: 15, color }}>{val}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Weekly / monthly summary ───────────────────────────── */
function PeriodSummary({ trades, mode }: { trades: Trade[]; mode: "weekly" | "monthly" }) {
  const grouped = useMemo(() => {
    const m: Record<string, Trade[]> = {}
    trades.forEach(t => {
      const [dy, dm, dd] = t.date.split("-").map(Number)
      const d = new Date(dy, dm - 1, dd) // local date — avoids UTC midnight shift
      let key: string
      if (mode === "weekly") {
        const mon = new Date(d)
        mon.setDate(d.getDate() - ((d.getDay() + 6) % 7))
        key = `${mon.getFullYear()}-${String(mon.getMonth()+1).padStart(2,"0")}-${String(mon.getDate()).padStart(2,"0")}`
      } else {
        key = t.date.slice(0, 7)
      }
      if (!m[key]) m[key] = []
      m[key].push(t)
    })
    return Object.entries(m).sort((a, b) => b[0].localeCompare(a[0]))
  }, [trades, mode])

  if (!grouped.length) return (
    <div className="glass rounded-2xl p-8 flex items-center justify-center">
      <p className="label-upper" style={{ color: "var(--text3)" }}>No trades yet</p>
    </div>
  )

  return (
    <div className="space-y-3">
      {grouped.map(([key, group]) => {
        const wins = group.filter(t => t.outcome === "win").length
        const losses = group.filter(t => t.outcome === "loss").length
        const pnl = group.reduce((s, t) => s + t.pnl, 0)
        const label = mode === "weekly"
          ? `Week of ${new Date(key).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
          : new Date(key + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" })
        return (
          <div key={key} className="glass rounded-xl p-4">
            <p className="label-upper mb-3">{label}</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "P&L", val: `${pnl >= 0 ? "+" : ""}$${Math.abs(pnl).toLocaleString()}`, color: pnl >= 0 ? "var(--green)" : "var(--red)" },
                { label: "Trades", val: group.length.toString(), color: "var(--text)" },
                { label: "Wins", val: wins.toString(), color: "var(--green)" },
                { label: "Losses", val: losses.toString(), color: "var(--red)" },
              ].map(({ label, val, color }) => (
                <div key={label} className="text-center">
                  <p className="label-upper mb-1">{label}</p>
                  <p className="mono text-sm font-semibold" style={{ color }}>{val}</p>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ─── Trade card (collapsible) ──────────────────────────────── */
const OUTCOME_BORDER: Record<string, string> = {
  win: "rgba(0,229,160,0.25)",
  loss: "rgba(255,61,90,0.25)",
  breakeven: "rgba(255,208,96,0.2)",
}
const DIR_BG: Record<string, string> = {
  long: "rgba(0,229,160,0.12)",
  short: "rgba(255,61,90,0.12)",
}

function TradeCard({ trade, onDelete }: { trade: Trade; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const pnlColor = outcomeColor(trade.outcome)

  return (
    <div
      className="glass rounded-xl overflow-hidden"
      style={{ borderColor: OUTCOME_BORDER[trade.outcome] ?? "var(--border)" }}
    >
      {/* Summary row — always visible */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-3 py-3 text-left"
        style={{ background: "transparent" }}
      >
        {/* Outcome glow strip */}
        <div
          className="flex-shrink-0 rounded-full"
          style={{
            width: 3,
            height: 36,
            background: pnlColor,
            boxShadow: `0 0 8px ${pnlColor}`,
          }}
        />

        {/* Symbol + direction */}
        <div className="flex-shrink-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="mono text-sm font-semibold" style={{ color: "var(--text)" }}>{trade.instrument}</span>
            <span
              className="mono text-xs px-1.5 py-0.5 rounded"
              style={{ color: trade.direction === "long" ? "var(--green)" : "var(--red)", background: DIR_BG[trade.direction] ?? "transparent" }}
            >
              {trade.direction.toUpperCase()}
            </span>
          </div>
          <span className="label-upper" style={{ color: "var(--text3)" }}>{trade.session}</span>
        </div>

        {/* P&L + R-mult (center) */}
        <div className="flex-1 flex flex-col items-end">
          <span className="mono text-base font-semibold" style={{ color: pnlColor }}>
            {trade.pnl >= 0 ? "+" : ""}${trade.pnl.toLocaleString()}
          </span>
          <span className="mono text-xs" style={{ color: "var(--text2)" }}>
            {trade.rmult >= 0 ? "+" : ""}{trade.rmult.toFixed(1)}R
          </span>
        </div>

        {/* Date + chevron */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          <span className="mono text-xs" style={{ color: "var(--text3)" }}>
            {new Date(trade.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="var(--text3)" strokeWidth="2" strokeLinecap="round"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div
          className="px-4 pb-4 space-y-3"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          {/* Meta row */}
          <div className="flex flex-wrap gap-3 pt-3">
            {[
              { label: "Date", val: trade.date },
              { label: "Time", val: trade.time || "—" },
              { label: "Contracts", val: trade.contracts.toString() },
              { label: "Session", val: trade.session },
            ].map(({ label, val }) => (
              <div key={label}>
                <p className="label-upper mb-0.5">{label}</p>
                <p className="mono text-xs" style={{ color: "var(--text2)" }}>{val}</p>
              </div>
            ))}
          </div>

          {/* Confluences */}
          {trade.confluences.length > 0 && (
            <div>
              <p className="label-upper mb-1.5">Confluences</p>
              <div className="flex flex-wrap gap-1">
                {trade.confluences.map(c => (
                  <span
                    key={c}
                    className="mono text-xs px-1.5 py-0.5 rounded"
                    style={{ background: "var(--accent3)", color: "var(--accent)", border: "1px solid var(--border-accent)" }}
                  >{c}</span>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {trade.notes && (
            <div>
              <p className="label-upper mb-1.5">Notes</p>
              <p
                className="text-sm rounded-lg p-3"
                style={{
                  color: "var(--text2)",
                  lineHeight: 1.6,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--border)",
                }}
              >{trade.notes}</p>
            </div>
          )}

          {/* Delete */}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="flex items-center gap-1.5 mono text-xs px-3 py-1.5 rounded-lg transition-opacity"
            style={{ color: "var(--red)", border: "1px solid rgba(255,61,90,0.3)", background: "rgba(255,61,90,0.06)" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
            </svg>
            Delete trade
          </button>
        </div>
      )}
    </div>
  )
}

/* ─── Main component ────────────────────────────────────────── */
export default function LogTab() {
  const { trades, addTrade, deleteTrade } = useTrades()
  const [view, setView] = useState<JournalView>("daily")
  const [showForm, setShowForm] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const displayedTrades = useMemo(() => {
    const sorted = [...trades].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
    if (view === "daily" && selectedDate) return sorted.filter(t => t.date === selectedDate)
    return sorted
  }, [trades, view, selectedDate])

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="label-upper">Journal</p>
        <button
          onClick={() => { setShowForm(v => !v) }}
          className="flex items-center gap-1.5 mono text-xs px-3 py-1.5 rounded-lg transition-colors duration-150"
          style={{
            color: showForm ? "var(--text2)" : "var(--accent)",
            border: `1px solid ${showForm ? "var(--border)" : "var(--border-accent)"}`,
            background: showForm ? "transparent" : "var(--accent3)",
          }}
        >
          {showForm ? "✕ Cancel" : "+ New Trade"}
        </button>
      </div>

      {/* Entry form */}
      {showForm && (
        <TradeForm
          onSubmit={t => { addTrade(t); setShowForm(false) }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Sub-tabs */}
      <div className="flex gap-0 rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        {(["daily", "weekly", "monthly"] as JournalView[]).map(v => (
          <button
            key={v}
            onClick={() => { setView(v); setSelectedDate(null) }}
            className="flex-1 py-2 mono text-xs capitalize transition-colors duration-150"
            style={{
              background: view === v ? "var(--accent3)" : "transparent",
              color: view === v ? "var(--accent)" : "var(--text3)",
              borderRight: v !== "monthly" ? "1px solid var(--border)" : "none",
            }}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Stats bar (daily view) */}
      {view === "daily" && (
        <StatsBar trades={displayedTrades} />
      )}

      {/* Calendar (daily view only) */}
      {view === "daily" && (
        <Calendar trades={trades} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
      )}

      {/* Weekly / Monthly summaries */}
      {(view === "weekly" || view === "monthly") && (
        <PeriodSummary trades={trades} mode={view} />
      )}

      {/* Trade list (daily view) */}
      {view === "daily" && (
        <>
          {selectedDate && (
            <div className="flex justify-end px-1">
              <button onClick={() => setSelectedDate(null)} className="mono text-xs" style={{ color: "var(--text3)" }}>
                ← All trades
              </button>
            </div>
          )}
          {displayedTrades.length === 0 ? (
            <div className="glass rounded-2xl p-8 flex items-center justify-center">
              <p className="label-upper" style={{ color: "var(--text3)" }}>
                {selectedDate ? "No trades on this day" : "No trades logged yet"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayedTrades.map(trade => (
                <TradeCard key={trade.id} trade={trade} onDelete={() => deleteTrade(trade.id)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
