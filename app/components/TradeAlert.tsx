"use client"

import { useEffect, useRef, useState } from "react"
import { useTrades } from "../lib/TradesContext"
import { useNotifications } from "../lib/NotificationContext"
import type { Trade } from "../lib/types"

interface Alert {
  type: "revenge" | "overtrading" | "daily-soft" | "daily-hard"
  title: string
  message: string
  severity: "warning" | "danger"
  key: string
}

function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// Runs on every trade change — P&L limit alerts only (immediate feedback)
function detectPnlAlert(trades: Trade[]): Alert | null {
  const today = localToday()
  const todayTrades = trades.filter(t => t.date === today)
  if (todayTrades.length === 0) return null

  const todayPnl = todayTrades.reduce((sum, t) => sum + t.pnl, 0)

  if (todayPnl <= -750) {
    return {
      type: "daily-hard",
      title: "Hard Limit Alert",
      message: `Daily P&L: -$${Math.abs(todayPnl).toFixed(0)}. Hard limit hit. Close the platform. No more trades today.`,
      severity: "danger",
      key: `daily-hard-${today}-${Math.floor(todayPnl / 50)}`,
    }
  }

  if (todayPnl <= -500) {
    return {
      type: "daily-soft",
      title: "Soft Limit Hit",
      message: `Daily P&L: -$${Math.abs(todayPnl).toFixed(0)}. You've crossed your soft limit. Reduce size or stop — the hard limit is $${(1000 + todayPnl).toFixed(0)} away.`,
      severity: "warning",
      key: `daily-soft-${today}-${Math.floor(todayPnl / 50)}`,
    }
  }

  return null
}

// Runs on modal open only — interrupts revenge trading and overtrading patterns
function detectModalAlert(trades: Trade[]): Alert | null {
  const now = Date.now()
  const today = localToday()

  const todayTrades = trades
    .filter(t => t.date === today && !isNaN(new Date(`${t.date}T${t.time}:00`).getTime()))
    .sort((a, b) => new Date(`${a.date}T${a.time}:00`).getTime() - new Date(`${b.date}T${b.time}:00`).getTime())

  if (todayTrades.length === 0) return null

  const last = todayTrades[todayTrades.length - 1]
  const lastTs = new Date(`${last.date}T${last.time}:00`).getTime()
  const minAgo = (now - lastTs) / 60000

  // Only fire if the trade actually happened in the past 30 minutes
  if (minAgo < 0 || minAgo > 30) return null

  if (last.outcome === "loss") {
    return {
      type: "revenge",
      title: "Revenge Trade Warning",
      message: `Your last ${last.instrument} trade was a loss ${Math.floor(minAgo)} min ago. Stop — this is how accounts blow up. Take 30 minutes away from the screen.`,
      severity: "danger",
      key: `revenge-${last.id}`,
    }
  }

  if (last.outcome === "win" && last.pnl >= 500) {
    return {
      type: "overtrading",
      title: "Overtrading Alert",
      message: `You just banked $${last.pnl.toFixed(0)} on ${last.instrument}. The next trade is always harder after a big win — you'll chase it. Lock it in or size down.`,
      severity: "warning",
      key: `overtrading-${last.id}`,
    }
  }

  return null
}

export default function TradeAlert({ tradeModalOpen }: { tradeModalOpen: boolean }) {
  const { trades } = useTrades()
  const { addNotification } = useNotifications()
  const [alert, setAlert] = useState<Alert | null>(null)
  const dismissedKeys = useRef(new Set<string>())
  const notifiedKeys = useRef(new Set<string>())

  // P&L limit alerts fire immediately when trades update (no modal needed)
  useEffect(() => {
    const detected = detectPnlAlert(trades)
    if (detected && !dismissedKeys.current.has(detected.key)) {
      setAlert(detected)
      if (!notifiedKeys.current.has(detected.key)) {
        addNotification({ type: detected.type, title: detected.title, message: detected.message })
        notifiedKeys.current.add(detected.key)
      }
    } else if (!detected && (alert?.type === "daily-soft" || alert?.type === "daily-hard")) {
      setAlert(null)
    }
  }, [trades]) // eslint-disable-line react-hooks/exhaustive-deps

  // Revenge/overtrading alerts fire only when the trade entry modal opens
  useEffect(() => {
    if (!tradeModalOpen) return
    const detected = detectModalAlert(trades) ?? detectPnlAlert(trades)
    if (detected && !dismissedKeys.current.has(detected.key)) {
      setAlert(detected)
      if (!notifiedKeys.current.has(detected.key)) {
        addNotification({ type: detected.type, title: detected.title, message: detected.message })
        notifiedKeys.current.add(detected.key)
      }
    } else if (!detected) {
      setAlert(null)
    }
  }, [tradeModalOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!alert) return null

  const isDanger = alert.severity === "danger"
  const color = isDanger ? "var(--red)" : "var(--yellow)"
  const bg = isDanger ? "rgba(255,61,90,0.10)" : "rgba(255,208,96,0.08)"
  const borderColor = isDanger ? "rgba(255,61,90,0.35)" : "rgba(255,208,96,0.35)"
  const shadow = isDanger ? "rgba(255,61,90,0.18)" : "rgba(255,208,96,0.12)"

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "calc(20px + env(safe-area-inset-top))",
        paddingLeft: 16,
        paddingRight: 16,
        background: "rgba(6,11,20,0.55)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          dismissedKeys.current.add(alert.key)
          setAlert(null)
        }
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          borderRadius: 16,
          background: bg,
          border: `1px solid ${borderColor}`,
          padding: "20px",
          boxShadow: `0 8px 32px ${shadow}, 0 0 0 1px ${borderColor}`,
        }}
      >
        {/* Title row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: `${color}18`,
              border: `1px solid ${color}35`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <p className="mono" style={{ fontSize: 13, fontWeight: 700, color, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            {alert.title}
          </p>
        </div>

        <p style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.7, marginBottom: 16 }}>
          {alert.message}
        </p>

        <button
          onClick={() => {
            dismissedKeys.current.add(alert.key)
            setAlert(null)
          }}
          className="mono"
          style={{
            width: "100%",
            height: 42,
            borderRadius: 10,
            background: `${color}14`,
            border: `1px solid ${color}40`,
            color,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            cursor: "pointer",
            transition: "background 0.15s ease",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = `${color}22`)}
          onMouseLeave={e => (e.currentTarget.style.background = `${color}14`)}
        >
          Acknowledged
        </button>
      </div>
    </div>
  )
}
