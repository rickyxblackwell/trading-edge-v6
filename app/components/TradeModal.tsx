"use client"

import { useEffect } from "react"
import { useTrades } from "../lib/TradesContext"
import { TradeForm } from "./TradeForm"

export default function TradeModal({ open, onClose }: {
  open: boolean
  onClose: () => void
}) {
  const { addTrade } = useTrades()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center"
      style={{ background: "rgba(6,11,20,0.75)", backdropFilter: "blur(6px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="glass w-full lg:max-w-lg"
        style={{
          maxHeight: "82dvh",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          borderRadius: "20px 20px 0 0",
          padding: "1.25rem 1.25rem calc(1.25rem + env(safe-area-inset-bottom))",
          animation: "slideUp 0.28s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        {/* Drag handle — mobile affordance */}
        <div className="flex justify-center mb-4 lg:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: "var(--border)" }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 rounded-full" style={{
              background: "linear-gradient(to bottom, var(--accent), var(--warm))",
              boxShadow: "0 0 8px var(--accent)",
            }} />
            <p className="mono text-sm font-semibold" style={{ color: "var(--text)" }}>Log Trade</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl transition-colors"
            style={{ border: "1px solid var(--border)", color: "var(--text3)" }}
            aria-label="Close"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <TradeForm
          onSubmit={trade => { addTrade(trade); onClose() }}
        />
      </div>
    </div>
  )
}
