"use client"

import { AlertTriangle } from "lucide-react"

interface ToastProps {
  message: string | null
}

export function Toast({ message }: ToastProps) {
  if (!message) return null
  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: "fixed",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        maxWidth: "calc(100vw - 32px)",
        padding: "10px 16px",
        borderRadius: 12,
        background: "var(--bg3)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid var(--red)",
        boxShadow: "none",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <AlertTriangle size={14} style={{ color: "var(--red)", flexShrink: 0 }} />
      <span
        style={{
          fontSize: 13,
          color: "var(--text)",
          fontFamily: "var(--font-inter, Inter, sans-serif)",
        }}
      >
        {message}
      </span>
    </div>
  )
}
