"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import type { AppNotification } from "./types"

const STORAGE_KEY = "edge_notif_log"

interface NotificationContextValue {
  notifications: AppNotification[]
  addNotification: (n: Omit<AppNotification, "id" | "timestamp" | "read">) => void
  markAllRead: () => void
  unreadCount: number
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

function loadFromStorage(): AppNotification[] {
  if (typeof window === "undefined") return []
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as AppNotification[]
  } catch {
    return []
  }
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])

  useEffect(() => {
    setNotifications(loadFromStorage())
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(notifications))
  }, [notifications])

  const addNotification = useCallback((n: Omit<AppNotification, "id" | "timestamp" | "read">) => {
    setNotifications(prev => {
      if (prev.length > 0 && prev[0].title === n.title && prev[0].message === n.message) {
        return prev
      }
      const entry: AppNotification = {
        id: Math.random().toString(36).slice(2, 9),
        timestamp: new Date().toISOString(),
        read: false,
        ...n,
      }
      return [entry, ...prev].slice(0, 100)
    })
  }, [])

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, markAllRead, unreadCount }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error("useNotifications must be used inside NotificationProvider")
  return ctx
}
