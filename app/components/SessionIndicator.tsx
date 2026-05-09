"use client"

import { useEffect, useState } from "react"

interface Session {
  label: string
  color: string
  glow: string
}

function getETDecimalHour(): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date())
  const h = parseInt(parts.find(p => p.type === "hour")?.value ?? "0") % 24
  const m = parseInt(parts.find(p => p.type === "minute")?.value ?? "0")
  return h + m / 60
}

function getSession(): Session {
  const t = getETDecimalHour()

  // Overlaps — checked before single-session windows
  if (t >= 9.5  && t < 11.5)  return { label: "LON · NY",   color: "var(--green)",   glow: "rgba(0,229,160,0.35)"  }
  if (t >= 3.0  && t < 4.0)   return { label: "ASIA · LON", color: "var(--yellow)",  glow: "rgba(255,208,96,0.30)" }

  // Single sessions
  if (t >= 11.5 && t < 13.0)  return { label: "LUNCH CHOP", color: "var(--red)",     glow: "rgba(255,61,90,0.25)"  }
  if (t >= 13.0 && t < 16.25) return { label: "NY PM",      color: "var(--accent)",  glow: "rgba(56,189,248,0.25)" }
  if (t >= 4.0  && t < 8.5)   return { label: "LONDON",     color: "var(--purple)",  glow: "rgba(168,85,247,0.25)" }
  if (t >= 8.5  && t < 9.5)   return { label: "PRE-MARKET", color: "var(--yellow)",  glow: "rgba(255,208,96,0.25)" }
  if (t >= 16.25 && t < 18.0) return { label: "CLOSE",      color: "var(--text2)",   glow: ""                      }
  if (t >= 20.0 || t < 3.0)   return { label: "ASIAN",      color: "var(--purple)",  glow: "rgba(168,85,247,0.20)" }
  return                              { label: "OVERNIGHT",  color: "var(--text3)",   glow: ""                      }
}

export default function SessionIndicator({ hidden }: { hidden?: boolean }) {
  const [session, setSession] = useState<Session>(() => getSession())

  useEffect(() => {
    const interval = setInterval(() => setSession(getSession()), 60_000)
    return () => clearInterval(interval)
  }, [])

  if (hidden) return null

  return (
    <div
      className="lg:hidden"
      style={{
        position: "fixed",
        top: "calc(12px + env(safe-area-inset-top))",
        left: 16,
        zIndex: 195,
        height: 44,
        display: "flex",
        alignItems: "center",
        paddingLeft: 12,
        paddingRight: 12,
        borderRadius: 12,
        background: "var(--glass-md)",
        border: "1px solid var(--border)",
        backdropFilter: "blur(12px)",
        gap: 7,
        boxShadow: session.glow ? `0 0 14px ${session.glow}` : "none",
        pointerEvents: "none",
        transition: "box-shadow 0.4s ease",
      }}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: session.color,
          boxShadow: session.glow ? `0 0 6px ${session.glow}` : "none",
          flexShrink: 0,
        }}
      />
      <span
        className="mono"
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.1em",
          color: session.color,
          whiteSpace: "nowrap",
        }}
      >
        {session.label}
      </span>
    </div>
  )
}
