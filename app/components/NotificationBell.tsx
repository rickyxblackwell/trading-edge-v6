"use client"

import { useEffect, useRef, useState } from "react"
import { Bell } from "lucide-react"
import { useNotifications } from "../lib/NotificationContext"
import type { AppNotification, NotificationType } from "../lib/types"

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const d = Math.floor(hours / 24)
  if (d === 1) return "Yesterday"
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  if (d < 365) return `${Math.floor(d / 30)}mo ago`
  return `${Math.floor(d / 365)}y ago`
}

function isDanger(type: NotificationType) {
  return type === "revenge" || type === "daily-hard" || type === "key-error"
}

function typeColor(type: NotificationType) {
  return isDanger(type) ? "var(--red)" : "var(--yellow)"
}

function typeBg(type: NotificationType) {
  return isDanger(type) ? "var(--red-subtle)" : "var(--yellow-subtle)"
}

function TypeIcon({ type }: { type: NotificationType }) {
  if (type === "rate-limit") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    )
  }
  if (type === "key-error") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="7.5" cy="15.5" r="5.5" />
        <path d="M21 2l-9.6 9.6" />
        <path d="M15.5 7.5l3 3L22 7l-3-3" />
      </svg>
    )
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function NotificationRow({ n, onTap }: { n: AppNotification; onTap: (id: string) => void }) {
  const color = typeColor(n.type)
  const bg = typeBg(n.type)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onTap(n.id)}
      onKeyDown={e => e.key === "Enter" && onTap(n.id)}
      style={{
        display: "flex",
        gap: 10,
        padding: "12px 16px",
        borderBottom: "1px solid var(--border)",
        borderLeft: n.read ? "2px solid transparent" : `2px solid ${color}`,
        cursor: "pointer",
        transition: "border-left-color 0.2s ease",
      }}
    >
      <div style={{ flexShrink: 0, display: "flex", alignItems: "flex-start", paddingTop: 1 }}>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color,
          }}
        >
          <TypeIcon type={n.type} />
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          {!n.read && (
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
          )}
          <span
            className="mono"
            style={{ fontSize: 12, fontWeight: 600, color, letterSpacing: "0.02em" }}
          >
            {n.title}
          </span>
        </div>
        <p
          style={{
            fontSize: 12,
            color: "var(--text2)",
            lineHeight: 1.6,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            margin: 0,
          }}
        >
          {n.message}
        </p>
        <span className="mono" style={{ fontSize: 11, color: "var(--text3)", marginTop: 4, display: "block" }}>
          {relativeTime(n.timestamp)}
        </span>
      </div>
    </div>
  )
}

export default function NotificationBell({ hidden }: { hidden?: boolean }) {
  const { notifications, markAllRead, unreadCount } = useNotifications()
  const [open, setOpen] = useState(false)
  const [ringing, setRinging] = useState(false)
  const prevCountRef = useRef(unreadCount)

  useEffect(() => {
    if (unreadCount > prevCountRef.current) {
      setRinging(true)
      const t = setTimeout(() => setRinging(false), 700)
      prevCountRef.current = unreadCount
      return () => clearTimeout(t)
    }
    prevCountRef.current = unreadCount
  }, [unreadCount])

  function handleOpen() {
    setOpen(true)
    markAllRead()
  }

  function handleClearAll() {
    if (typeof window !== "undefined") sessionStorage.removeItem("edge_notif_log")
    window.location.reload()
  }

  if (hidden) return null

  return (
    <>
      <style>{`
        @keyframes bell-ring {
          0%,100% { transform: rotate(0deg); }
          20%     { transform: rotate(-15deg); }
          40%     { transform: rotate(15deg); }
          60%     { transform: rotate(-10deg); }
          80%     { transform: rotate(10deg); }
        }
        .bell-ring { animation: bell-ring 0.6s ease; }
        @media (prefers-reduced-motion: reduce) {
          .bell-ring { animation: none; }
        }
      `}</style>

      <button
        aria-label="Open notifications"
        onClick={handleOpen}
        style={{
          position: "fixed",
          top: "calc(12px + env(safe-area-inset-top))",
          right: 16,
          zIndex: 195,
          width: 44,
          height: 44,
          borderRadius: 12,
          background: "var(--glass-md)",
          border: "1px solid var(--border)",
          backdropFilter: "blur(12px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <div className={ringing ? "bell-ring" : ""} style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
          <Bell size={20} color={unreadCount > 0 ? "var(--accent)" : "var(--text2)"} />
          {unreadCount > 0 && (
            <div
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--red)",
              }}
            />
          )}
        </div>
      </button>

      {open && (
        <>
          <div
            aria-hidden="true"
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 196,
              background: "rgba(6,11,20,0.5)",
              backdropFilter: "blur(3px)",
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Notifications"
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 197,
              height: "62dvh",
              borderRadius: "20px 20px 0 0",
              background: "var(--bg2)",
              border: "1px solid var(--border)",
              borderBottom: "none",
              backdropFilter: "blur(12px)",
              display: "flex",
              flexDirection: "column",
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
          >
            <div
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                background: "var(--border)",
                margin: "12px auto 0",
                flexShrink: 0,
              }}
            />

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px 10px",
                flexShrink: 0,
                borderBottom: "1px solid var(--border)",
              }}
            >
              <span
                className="mono"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                Notifications
              </span>
              {notifications.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--text3)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px 0",
                    letterSpacing: "0.04em",
                  }}
                >
                  Clear all
                </button>
              )}
            </div>

            <div style={{ flex: 1, overflowY: "auto" }}>
              {notifications.length === 0 ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    fontSize: 12,
                    color: "var(--text3)",
                  }}
                >
                  No notifications yet
                </div>
              ) : (
                notifications.map(n => (
                  <NotificationRow key={n.id} n={n} onTap={() => {}} />
                ))
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
