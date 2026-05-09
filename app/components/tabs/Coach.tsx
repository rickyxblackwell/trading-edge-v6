"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useTrades } from "../../lib/TradesContext"
import { useAuthContext } from "@/app/components/AuthProvider"
import { useNotifications } from "../../lib/NotificationContext"
import type { ChatMessage, CoachingEntry } from "../../lib/types"
import { genId } from "../../lib/genId"

function buildCoachingContextSelection(
  history: CoachingEntry[]
): Array<{title: string; timestamp: string; mode: string; content: string}> {
  if (history.length === 0) return []
  const toEntry = (e: CoachingEntry) => ({
    title: e.title || "",
    timestamp: e.timestamp,
    mode: e.mode,
    content: (e.fullContent || "").slice(0, 300),
  })
  if (history.length <= 20) return history.map(toEntry)
  const first = [history[0]]
  const recent = history.slice(-20)
  const middle = history.slice(1, -20)
  const step = Math.max(1, Math.ceil(middle.length / 15))
  const sampled = middle.filter((_, i) => i % step === 0).slice(0, 15)
  return [...first, ...sampled, ...recent].map(toEntry)
}

const STRATEGY_KEY = "edge_v5_strategy_text"

// Detect watchlist intent from user's message — don't rely on AI command formatting
function parseWatchlistIntent(text: string): { add: string[]; remove: string[] } {
  const lower = text.toLowerCase()
  const isAdd = /\b(add|track|watch|monitor)\b/.test(lower)
  const isRemove = /\b(remove|unwatch|stop\s+watching|stop\s+tracking|delete)\b/.test(lower)
  if (!isAdd && !isRemove) return { add: [], remove: [] }

  const STOP = new Set(["I", "A", "MY", "ADD", "THE", "TO", "FROM", "AND", "IN", "ON", "FOR", "IS", "IT", "AT", "ME", "WATCH", "TRACK"])
  const tickers = (text.match(/\b[A-Z]{1,6}(?:=F)?\b/g) ?? []).filter(t => !STOP.has(t))
  return isRemove ? { add: [], remove: tickers } : { add: tickers, remove: [] }
}

function genSessionId() {
  if (typeof window === "undefined") return "ssr"
  let sid = sessionStorage.getItem("edge_session_id")
  if (!sid) { sid = genId(); sessionStorage.setItem("edge_session_id", sid) }
  return sid
}

/* ─── Mode definitions ───────────────────────────────────────── */
const MODES = [
  {
    id: "analyze" as const,
    label: "Analyze Journal",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /><path d="M2 20h20" /></svg>,
  },
  {
    id: "market-pulse" as const,
    label: "Market Pulse",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2 12 6 12 8 5 11 19 14 9 16 14 18 12 22 12" /></svg>,
  },
  {
    id: "strategy-review" as const,
    label: "Strategy Review",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
  },
]

const MODE_LABELS: Record<string, string> = {
  analyze: "Journal Analysis",
  "market-pulse": "Market Pulse",
  "strategy-review": "Strategy Review",
  chat: "Chat",
}

const MOMENTUM_MAP: Record<string, { label: string; color: string; bg: string }> = {
  positive: { label: "↑ Positive", color: "var(--green)",  bg: "rgba(0,229,160,0.1)"   },
  neutral:  { label: "→ Neutral",  color: "var(--yellow)", bg: "rgba(255,208,96,0.1)"  },
  negative: { label: "↓ Negative", color: "var(--red)",    bg: "rgba(255,61,90,0.1)"   },
  info:     { label: "Info",       color: "var(--accent)", bg: "rgba(56,189,248,0.1)"  },
}

/* ─── Helpers ────────────────────────────────────────────────── */
function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return "Today"
  if (d === 1) return "Yesterday"
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  if (d < 365) return `${Math.floor(d / 30)}mo ago`
  return `${Math.floor(d / 365)}y ago`
}

/* ─── Markdown renderer for assistant messages ───────────────── */
const mdComponents: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  p: ({ children }) => <p style={{ marginBottom: "0.5em", lineHeight: 1.65 }}>{children}</p>,
  h1: ({ children }) => <p style={{ fontWeight: 700, color: "var(--text)", marginBottom: "0.4em", marginTop: "0.9em", fontSize: "0.88em", letterSpacing: "0.06em", textTransform: "uppercase" }}>{children}</p>,
  h2: ({ children }) => <p style={{ fontWeight: 600, color: "var(--text)", marginBottom: "0.35em", marginTop: "0.8em", fontSize: "0.85em", letterSpacing: "0.05em", textTransform: "uppercase" }}>{children}</p>,
  h3: ({ children }) => <p style={{ fontWeight: 600, color: "var(--text)", marginBottom: "0.25em", marginTop: "0.6em", fontSize: "0.85em" }}>{children}</p>,
  ul: ({ children }) => <ul style={{ paddingLeft: "1.1em", marginBottom: "0.5em", listStyleType: "disc" }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ paddingLeft: "1.1em", marginBottom: "0.5em", listStyleType: "decimal" }}>{children}</ol>,
  li: ({ children }) => <li style={{ marginBottom: "0.2em", lineHeight: 1.6 }}>{children}</li>,
  strong: ({ children }) => <strong style={{ color: "var(--text)", fontWeight: 600 }}>{children}</strong>,
  em: ({ children }) => <em style={{ color: "var(--text2)" }}>{children}</em>,
  code: ({ children }) => <code className="mono" style={{ background: "rgba(56,189,248,0.1)", color: "var(--accent)", padding: "0.1em 0.35em", borderRadius: 4, fontSize: "0.88em" }}>{children}</code>,
  hr: () => <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "0.75em 0" }} />,
  blockquote: ({ children }) => <blockquote style={{ borderLeft: "2px solid var(--border-accent)", paddingLeft: "0.75em", margin: "0.5em 0", color: "var(--text2)" }}>{children}</blockquote>,
}

/* ─── Message bubble ─────────────────────────────────────────── */
function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user"
  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
        style={{ background: isUser ? "var(--accent3)" : "rgba(168,85,247,0.12)", border: `1px solid ${isUser ? "var(--border-accent)" : "rgba(168,85,247,0.3)"}` }}>
        {isUser ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
          </svg>
        )}
      </div>
      <div className={`flex-1 rounded-2xl px-4 py-3 text-sm ${isUser ? "rounded-tr-sm" : "rounded-tl-sm"}`}
        style={{ maxWidth: "85%", background: isUser ? "linear-gradient(135deg, var(--accent3), rgba(56,189,248,0.06))" : "rgba(255,255,255,0.05)", border: `1px solid ${isUser ? "var(--border-accent)" : "var(--border)"}`, color: "var(--text2)", lineHeight: 1.65, wordBreak: "break-word" }}>
        {isUser ? (
          <span style={{ color: "var(--text)", whiteSpace: "pre-wrap" }}>{msg.content}</span>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {msg.content}
          </ReactMarkdown>
        )}
        <div className="mt-1.5 label-upper" style={{ color: "var(--text3)" }}>
          {new Date(msg.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  )
}

/* ─── Thinking bubble ────────────────────────────────────────── */
function ThinkingBubble() {
  return (
    <div className="flex gap-2.5">
      <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.3)" }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
        </svg>
      </div>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm px-4 py-3" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)" }}>
        {[0, 1, 2].map(i => (
          <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--purple)", animation: `bounce-dot 1.4s ease-in-out ${i * 0.22}s infinite` }} />
        ))}
      </div>
    </div>
  )
}

/* ─── History entry card ─────────────────────────────────────── */
function HistoryCard({ entry, onArchive }: { entry: CoachingEntry; onArchive: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const isInfo = entry.mode === "market-pulse" || isWatchlistSession(entry)
  const momKey = isInfo ? "info" : (entry.momentum ?? "neutral")
  const mom = MOMENTUM_MAP[momKey] ?? MOMENTUM_MAP.neutral
  const modeLabel = MODE_LABELS[entry.mode] ?? "Session"

  return (
    <div className="glass rounded-xl overflow-hidden" style={{ opacity: entry.archived ? 0.6 : 1 }}>
      {/* Header row — always visible */}
      <button onClick={() => setExpanded(v => !v)} className="w-full flex items-start gap-3 px-4 py-3 text-left">
        {/* Mode color strip */}
        <div className="flex-shrink-0 w-0.5 self-stretch rounded-full mt-0.5"
          style={{ background: entry.mode === "analyze" ? "var(--accent)" : entry.mode === "market-pulse" ? "var(--green)" : entry.mode === "strategy-review" ? "var(--purple)" : "var(--yellow)" }} />

        <div className="flex-1 min-w-0">
          {/* Title */}
          <p className="text-sm font-medium leading-snug mb-1" style={{ color: "var(--text)" }}>
            {entry.title || entry.priority?.slice(0, 60) || "Coaching session"}
          </p>
          {/* Meta */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="label-upper" style={{ color: "var(--text3)" }}>{modeLabel}</span>
            <span className="label-upper" style={{ color: "var(--text3)" }}>·</span>
            <span className="label-upper mono" style={{ color: "var(--text3)" }}>
              {new Date(entry.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </span>
            <span className="label-upper" style={{ color: "var(--text3)" }}>·</span>
            <span className="label-upper" style={{ color: "var(--text3)" }}>{relativeTime(entry.timestamp)}</span>
          </div>
        </div>

        <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
          {entry.momentum && (
            <span className="mono text-xs px-2 py-0.5 rounded-full whitespace-nowrap"
              style={{ color: mom.color, background: mom.bg, border: `1px solid ${mom.color}30` }}>
              {mom.label}
            </span>
          )}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: "1px solid var(--border)" }}>
          {entry.userPrompt && (
            <div className="pt-3">
              <p className="label-upper mb-1.5" style={{ color: "var(--text3)" }}>You asked</p>
              <div
                className="text-sm rounded-xl px-3 py-2.5"
                style={{
                  color: "var(--text)",
                  lineHeight: 1.55,
                  background: "var(--accent3)",
                  border: "1px solid var(--border-accent)",
                  wordBreak: "break-word",
                  whiteSpace: "pre-wrap",
                }}
              >
                {entry.userPrompt}
              </div>
            </div>
          )}
          <div>
            {entry.userPrompt && (
              <p className="label-upper mb-1.5" style={{ color: "var(--text3)" }}>Coach replied</p>
            )}
            <div className={entry.userPrompt ? "text-sm rounded-xl p-3" : "pt-3 text-sm rounded-xl p-3"}
              style={{ color: "var(--text2)", lineHeight: 1.7, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", wordBreak: "break-word" }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                {entry.fullContent || entry.marketSnapshot || entry.priority || "No content available."}
              </ReactMarkdown>
            </div>
          </div>
          <button onClick={onArchive}
            className="mono text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: entry.archived ? "var(--accent)" : "var(--text3)", border: `1px solid ${entry.archived ? "var(--border-accent)" : "var(--border)"}`, background: entry.archived ? "var(--accent3)" : "transparent" }}>
            {entry.archived ? "↩ Unarchive" : "Archive session"}
          </button>
        </div>
      )}
    </div>
  )
}

function isWatchlistSession(entry: CoachingEntry): boolean {
  const t = (entry.title || "").toLowerCase()
  const c = (entry.fullContent || entry.priority || "").toLowerCase()
  return (
    /\bwatchlist\b/.test(t) ||
    (/acknowledged/.test(c) && /watchlist/.test(c))
  )
}

/* ─── Chat/History tab toggle ────────────────────────────────── */
function CoachTabToggle({
  activeView,
  setActiveView,
}: {
  activeView: "chat" | "history"
  setActiveView: (v: "chat" | "history") => void
}) {
  return (
    <div className="flex justify-center mb-3">
      <div
        className="relative flex rounded-xl overflow-hidden"
        style={{ border: "1px solid var(--border)" }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 w-1/2 pointer-events-none"
          style={{
            background: "var(--accent3)",
            border: "1px solid var(--border-accent)",
            borderRadius: "inherit",
            transform: activeView === "chat" ? "translateX(0%)" : "translateX(100%)",
            transition: "transform 0.2s ease",
          }}
        />
        <button
          onClick={() => setActiveView("chat")}
          className="relative z-10 flex flex-1 items-center justify-center mono text-xs py-1.5 px-6 min-w-[80px]"
          style={{ color: activeView === "chat" ? "var(--accent)" : "var(--text3)", transition: "color 0.2s ease" }}
        >
          Chat
        </button>
        <button
          onClick={() => setActiveView("history")}
          className="relative z-10 flex flex-1 items-center justify-center mono text-xs py-1.5 px-6 min-w-[80px]"
          style={{ color: activeView === "history" ? "var(--accent)" : "var(--text3)", transition: "color 0.2s ease" }}
        >
          History
        </button>
      </div>
    </div>
  )
}

/* ─── History tab view ───────────────────────────────────────── */
function HistoryView({ activeView, setActiveView }: { activeView: "chat" | "history"; setActiveView: (v: "chat" | "history") => void }) {
  const { isAuthenticated } = useAuthContext()
  const { coachingHistory, updateCoachingEntry } = useTrades()
  const [showArchived, setShowArchived] = useState(false)

  if (!isAuthenticated) {
    return (
      <div className="flex-1 overflow-y-auto p-4" style={{ overscrollBehavior: "contain" }}>
        <CoachTabToggle activeView={activeView} setActiveView={setActiveView} />
        <div className="glass rounded-2xl p-8 flex flex-col items-center justify-center gap-3 text-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <p className="text-sm font-medium mt-2" style={{ color: "var(--text)" }}>
            Session history requires an account
          </p>
          <p className="text-xs" style={{ color: "var(--text2)", lineHeight: 1.6 }}>
            Your coaching sessions will be saved here once you sign up.
          </p>
          <Link href="/signup"
            className="mono text-sm font-semibold px-4 py-2 rounded-xl mt-4"
            style={{ background: "linear-gradient(to bottom, var(--accent), #0ea5e9)", color: "var(--bg)", display: "block", textAlign: "center", maxWidth: 200, boxShadow: "0 1px 24px rgba(56,189,248,0.25)" }}>
            Create free account →
          </Link>
        </div>
      </div>
    )
  }

  const sorted = [...coachingHistory].reverse()
  const active = sorted.filter(e => !e.archived)
  const archived = sorted.filter(e => e.archived)

  const archiveOlderThan30 = () => {
    const cutoff = Date.now() - 30 * 86400000
    coachingHistory.forEach(e => {
      if (!e.archived && new Date(e.timestamp).getTime() < cutoff) {
        updateCoachingEntry(e.id, { archived: true })
      }
    })
  }

  if (coachingHistory.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-4" style={{ overscrollBehavior: "contain" }}>
        <CoachTabToggle activeView={activeView} setActiveView={setActiveView} />
        <div className="glass rounded-2xl p-8 flex flex-col items-center justify-center gap-3 text-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <p className="label-upper" style={{ color: "var(--text3)" }}>No coaching sessions yet</p>
          <p className="text-xs" style={{ color: "var(--text3)" }}>Use the Chat tab to run your first analysis</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ overscrollBehavior: "contain" }}>
      <CoachTabToggle activeView={activeView} setActiveView={setActiveView} />
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="label-upper">{active.length} sessions</p>
        {active.some(e => Date.now() - new Date(e.timestamp).getTime() > 30 * 86400000) && (
          <button onClick={archiveOlderThan30}
            className="mono text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ border: "1px solid var(--border)", color: "var(--text3)" }}>
            Archive &gt; 30d
          </button>
        )}
      </div>

      {/* Active entries — newest first */}
      {active.length === 0 ? (
        <div className="glass rounded-xl p-4 text-center">
          <p className="label-upper" style={{ color: "var(--text3)" }}>All sessions archived</p>
        </div>
      ) : (
        <div className="space-y-2">
          {active.map(entry => (
            <HistoryCard key={entry.id} entry={entry}
              onArchive={() => updateCoachingEntry(entry.id, { archived: !entry.archived })} />
          ))}
        </div>
      )}

      {/* Archived section */}
      {archived.length > 0 && (
        <div>
          <button onClick={() => setShowArchived(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
            <span className="label-upper" style={{ color: "var(--text3)" }}>
              {archived.length} archived session{archived.length !== 1 ? "s" : ""}
            </span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round"
              style={{ transform: showArchived ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showArchived && (
            <div className="space-y-2 mt-2">
              {archived.map(entry => (
                <HistoryCard key={entry.id} entry={entry}
                  onArchive={() => updateCoachingEntry(entry.id, { archived: !entry.archived })} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Chat tab view ──────────────────────────────────────────── */
function ChatView({ activeView, setActiveView }: { activeView: "chat" | "history"; setActiveView: (v: "chat" | "history") => void }) {
  const {
    trades, coachingHistory, addCoachingEntry, updateCoachingEntry,
    patternSummary, updatePatternSummary,
    watchlist, updateWatchlist,
    sessionIndex, updateSessionIndex,
    behaviorLedger, updateBehaviorLedger,
    milestoneLog, updateMilestoneLog,
    streaks, updateStreaks,
    journalMemory,
    weeklySummaries, updateWeeklySummaries,
    monthlySummaries, updateMonthlySummaries,
  } = useTrades()
  const { addNotification } = useNotifications()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rateLimitNotice, setRateLimitNotice] = useState<{ message: string; provider: "claude" | "gemini" } | null>(null)
  const [keyErrorNotice, setKeyErrorNotice] = useState<{ message: string; provider?: "claude" | "gemini" } | null>(null)
  const [activeMode, setActiveMode] = useState<string>("chat")
  const [showOnboarding, setShowOnboarding] = useState(true)
  const [infoTab, setInfoTab] = useState<"commands" | "memory" | "stack">("commands")
  const textRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Refs for beforeunload — React state updates are async so we mirror sync
  const messagesRef = useRef<ChatMessage[]>([])
  const tradesRef = useRef(trades)
  const lastTitleRef = useRef("")
  const sessionModeRef = useRef<string>("chat")
  const chatSessionIdRef = useRef<string | null>(null)

  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { tradesRef.current = trades }, [trades])

  // Auto-save to localStorage on page/app close — beforeunload is unreliable on iOS Safari
  // so we also listen for pagehide and visibilitychange (hidden), which fire more reliably
  useEffect(() => {
    const flush = () => {
      const msgs = messagesRef.current
      if (msgs.length === 0) return
      const assistantMsgs = msgs.filter(m => m.role === "assistant")
      if (assistantMsgs.length === 0) return

      const title =
        lastTitleRef.current ||
        msgs.find(m => m.role === "user")?.content.slice(0, 60) ||
        "Chat session"

      const lastReply = assistantMsgs[assistantMsgs.length - 1].content
      const firstUserPrompt = msgs.find(m => m.role === "user")?.content ?? ""
      const entry: CoachingEntry = {
        id: genId(),
        timestamp: new Date().toISOString(),
        tradeCount: tradesRef.current.length,
        title,
        fullContent: lastReply,
        userPrompt: firstUserPrompt,
        archived: false,
        mode: (sessionModeRef.current || "chat") as CoachingEntry["mode"],
        marketSnapshot: "",
        patterns: "",
        process: "",
        risk: "",
        priority: lastReply.slice(0, 150),
        momentum: "neutral",
      }

      try {
        const raw = localStorage.getItem("edge_v5_coaching_history")
        const existing: CoachingEntry[] = raw ? JSON.parse(raw) : []
        existing.push(entry)
        if (existing.length > 60) existing.splice(0, existing.length - 60)
        localStorage.setItem("edge_v5_coaching_history", JSON.stringify(existing))
        messagesRef.current = []
      } catch {}
    }

    const onVisibility = () => { if (document.visibilityState === "hidden") flush() }
    window.addEventListener("beforeunload", flush)
    window.addEventListener("pagehide", flush)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.removeEventListener("beforeunload", flush)
      window.removeEventListener("pagehide", flush)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])

  const startNewChat = () => {
    messagesRef.current = []
    lastTitleRef.current = ""
    sessionModeRef.current = "chat"
    chatSessionIdRef.current = null
    setMessages([])
    setShowOnboarding(true)
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  const adjustHeight = () => {
    const t = textRef.current
    if (t) { t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 120) + "px" }
  }

  const sendMessage = async (messageOverride?: string, modeOverride?: string) => {
    setShowOnboarding(false)
    const text = (messageOverride ?? input).trim()
    if (!text || loading) return

    const mode = (modeOverride ?? "chat") as CoachingEntry["mode"]
    setActiveMode(mode)
    sessionModeRef.current = mode

    // Build history from current messages BEFORE adding the new user turn
    const conversationHistory = messages.slice(-18).map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }))

    const userMsg: ChatMessage = { id: genId(), role: "user", content: text, timestamp: new Date().toISOString(), mode }
    setMessages(prev => [...prev, userMsg])
    setInput("")
    if (textRef.current) textRef.current.style.height = "auto"
    setLoading(true)
    setError(null)

    // Apply watchlist changes immediately from user's message — don't wait for AI command
    const clientIntent = parseWatchlistIntent(text)
    if (clientIntent.add.length || clientIntent.remove.length) {
      updateWatchlist(clientIntent.add, clientIntent.remove)
    }
    // Build the effective watchlist for this request (React state won't update until next render)
    const removeSet = new Set(clientIntent.remove)
    const effectiveWatchlist = [
      ...watchlist.filter(s => !removeSet.has(s)),
      ...clientIntent.add.filter(s => !watchlist.includes(s)),
    ]

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          mode,
          trades: trades.slice(0, 20),
          history: coachingHistory.slice(-5),
          patternSummary,
          strategyText: (typeof window !== "undefined" ? localStorage.getItem(STRATEGY_KEY) : null) ?? "",
          sessionId: genSessionId(),
          watchlist: effectiveWatchlist,
          sessionIndex,
          behaviorLedger,
          milestoneLog,
          streaks,
          journalMemory,
          coachingContextFull: buildCoachingContextSelection(coachingHistory),
          weeklySummaries,
          monthlySummaries,
          conversationHistory,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        const errMsg = typeof data?.error === "string" ? data.error : "Coach unavailable — try again."
        const errType = data?.type as ("rate_limit" | "key_error" | undefined)
        const errProvider = data?.provider as ("claude" | "gemini" | undefined)
        if (errType === "rate_limit" && (errProvider === "claude" || errProvider === "gemini")) {
          setRateLimitNotice({ message: errMsg, provider: errProvider })
          setError(null)
          addNotification({ type: "rate-limit", title: "Rate Limit", message: errMsg })
        } else if (errType === "key_error") {
          setKeyErrorNotice({ message: errMsg, provider: errProvider })
          setError(null)
          addNotification({ type: "key-error", title: "API Key Error", message: errMsg })
        } else {
          setError(errMsg)
          setRateLimitNotice(null)
          setKeyErrorNotice(null)
        }
        return
      }

      setError(null)
      setRateLimitNotice(null)
      setKeyErrorNotice(null)

      const assistantMsg: ChatMessage = { id: genId(), role: "assistant", content: data.reply, timestamp: new Date().toISOString(), mode }
      setMessages(prev => [...prev, assistantMsg])

      // Track session title for Save & New Chat (use most recent title from AI)
      if (data.sessionTitle) lastTitleRef.current = data.sessionTitle

      // Update rolling pattern summary
      if (data.newPatternSummary) updatePatternSummary(data.newPatternSummary)

      // Dispatch memory updates returned by route
      if (data.sessionIndexUpdate) updateSessionIndex(data.sessionIndexUpdate)
      if (data.behaviorLedgerUpdate) updateBehaviorLedger(data.behaviorLedgerUpdate)
      if (data.milestoneUpdate) updateMilestoneLog(data.milestoneUpdate)
      if (data.streaksUpdate) updateStreaks(data.streaksUpdate)
      if (data.weeklyUpdate?.length) updateWeeklySummaries(data.weeklyUpdate)
      if (data.monthlyUpdate?.length) updateMonthlySummaries(data.monthlyUpdate)

      // Apply watchlist mutations from AI response
      if (data.watchlistAdd?.length || data.watchlistRemove?.length) {
        updateWatchlist(data.watchlistAdd || [], data.watchlistRemove || [])
      }

      // Auto-save all modes — chat upserts to avoid duplicate entries per turn
      const title = data.sessionTitle || lastTitleRef.current || text.slice(0, 60) || "Coaching session"
      const isWatchlist = clientIntent.add.length > 0 || clientIntent.remove.length > 0
      const momentum = isWatchlist
        ? "info"
        : ((data.momentum as string | undefined) || (data.coaching as { momentum?: string } | undefined)?.momentum || "neutral")
      if (mode === "chat" && chatSessionIdRef.current) {
        updateCoachingEntry(chatSessionIdRef.current, {
          title,
          fullContent: data.reply,
          priority: (data.reply as string).slice(0, 150),
          momentum,
        })
      } else {
        const id = genId()
        if (mode === "chat") chatSessionIdRef.current = id
        addCoachingEntry({
          id,
          timestamp: new Date().toISOString(),
          tradeCount: tradesRef.current.length,
          title,
          fullContent: data.reply,
          userPrompt: text,
          archived: false,
          mode: mode as CoachingEntry["mode"],
          marketSnapshot: "",
          patterns: "",
          process: "",
          risk: "",
          priority: (data.reply as string).slice(0, 150),
          momentum,
        })
      }

    } catch {
      setError("Coach unavailable — try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleModeClick = (modeId: string) => {
    if (modeId === "chat") { textRef.current?.focus(); return }
    const prompts: Record<string, string> = {
      analyze: "Analyze my recent trades and give me specific, actionable coaching feedback based on my strategy.",
      "market-pulse": "What's the current market sentiment for equity index futures (NQ/ES)? Give me context for trading today.",
      "strategy-review": "Review my trading strategy against current market best practices. Search for relevant insights and critique my SMC/ICT approach honestly.",
    }
    sendMessage(prompts[modeId], modeId)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <>
    {/* Key-error banner — fixed overlay, above modals */}
    {keyErrorNotice && (
      <div
        role="alert"
        aria-live="assertive"
        style={{
          position: "fixed",
          top: "calc(env(safe-area-inset-top) + 12px)",
          left: 12,
          right: 12,
          zIndex: 500,
          background: "var(--red-subtle)",
          border: "1px solid var(--red-border)",
          borderRadius: 14,
          padding: "14px 16px",
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          backdropFilter: "blur(12px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ flex: 1 }}>
          <p className="text-xs font-semibold" style={{ color: "var(--red)", marginBottom: 2 }}>{keyErrorNotice.message}</p>
          <p className="text-xs" style={{ color: "var(--text2)" }}>Update your API keys in the Account tab to continue.</p>
        </div>
        <button
          type="button"
          onClick={() => setKeyErrorNotice(null)}
          aria-label="Dismiss"
          style={{ flexShrink: 0, background: "var(--red-subtle)", color: "var(--red)", border: "1px solid var(--red-border)", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "background 0.2s ease" }}
        >
          Dismiss
        </button>
      </div>
    )}

    {/* Rate-limit banner — fixed overlay, above modals */}
    {rateLimitNotice && (
      <div
        role="status"
        aria-live="polite"
        style={{
          position: "fixed",
          top: "calc(env(safe-area-inset-top) + 12px)",
          left: 12,
          right: 12,
          zIndex: 500,
          background: "var(--yellow-subtle)",
          border: "1px solid var(--yellow-border)",
          borderRadius: 14,
          padding: "14px 16px",
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          backdropFilter: "blur(12px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ flex: 1 }}>
          <p className="text-xs font-semibold" style={{ color: "var(--yellow)", marginBottom: 2 }}>{rateLimitNotice.message}</p>
          <p className="text-xs" style={{ color: "var(--text2)" }}>Provider: {rateLimitNotice.provider === "claude" ? "Claude" : "Gemini"}</p>
        </div>
        <button
          type="button"
          onClick={() => setRateLimitNotice(null)}
          aria-label="Dismiss"
          style={{ flexShrink: 0, background: "var(--yellow-border)", color: "var(--yellow)", border: "1px solid var(--yellow-border)", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "background 0.2s ease" }}
        >
          Dismiss
        </button>
      </div>
    )}

    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto" style={{ overscrollBehavior: "contain" }}>
        <div className="p-4 space-y-4 pb-2" style={{ marginTop: 48 }}>
          <CoachTabToggle activeView={activeView} setActiveView={setActiveView} />

          {/* New Chat button */}
          <div className="flex items-center justify-end flex-wrap gap-1">
            {messages.length > 0 && !loading && (
              <button
                onClick={startNewChat}
                className="mono text-xs px-3 py-1.5 rounded-lg"
                style={{
                  color: "var(--text3)",
                  border: "1px solid var(--border)",
                  background: "transparent",
                  transition: "color 0.15s ease, border-color 0.15s ease",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = "var(--accent)"
                  e.currentTarget.style.borderColor = "var(--border-accent)"
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = "var(--text3)"
                  e.currentTarget.style.borderColor = "var(--border)"
                }}
              >
                New Chat
              </button>
            )}
          </div>

          {/* Streak row — win streak and rule-adherent days only */}
          {(streaks.currentWin > 0 || streaks.ruleAdherentDays > 0) && (
            <div className="flex items-center gap-3 flex-wrap">
              {streaks.currentWin > 0 && (
                <span className="label-upper" style={{ color: "var(--green)" }}>
                  <span className="mono">{streaks.currentWin}</span>-win streak
                </span>
              )}
              {streaks.ruleAdherentDays > 0 && (
                <span className="label-upper" style={{ color: "var(--text2)" }}>
                  Rule-adherent: <span className="mono">{streaks.ruleAdherentDays}</span>d
                </span>
              )}
            </div>
          )}

          {/* Mode chips */}
          <div className="grid grid-cols-3 gap-2">
            {MODES.map(mode => (
              <button key={mode.id} onClick={() => handleModeClick(mode.id)} disabled={loading}
                className="flex flex-col items-center gap-1 mono px-2 py-2.5 rounded-xl transition-all duration-150 disabled:opacity-40"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", color: "var(--text2)", fontSize: 10, lineHeight: 1.3 }}
                onMouseEnter={e => { const el = e.currentTarget; el.style.background = "var(--accent3)"; el.style.borderColor = "var(--border-accent)"; el.style.color = "var(--accent)" }}
                onMouseLeave={e => { const el = e.currentTarget; el.style.background = "rgba(255,255,255,0.04)"; el.style.borderColor = "var(--border)"; el.style.color = "var(--text2)" }}>
                {mode.icon}
                {mode.label}
              </button>
            ))}
          </div>

          {/* Generic error — inline, no type field */}
          {error && (
            <div className="rounded-xl px-4 py-3" style={{ background: "var(--red-subtle)", border: "1px solid var(--red-border)" }}>
              <p className="mono text-xs" style={{ color: "var(--red)" }}>{error}</p>
            </div>
          )}

          {/* Info box — session-local, 3 tabs */}
          {showOnboarding && messages.length === 0 && (
            <div className="glass rounded-2xl overflow-hidden" style={{ width: "100%" }}>

              {/* Hero */}
              <div className="flex flex-col items-center text-center px-6 pt-6 pb-5">
                <div style={{
                  width: 56, height: 56, borderRadius: 18,
                  background: "rgba(168,85,247,0.12)",
                  border: "1px solid rgba(168,85,247,0.28)",
                  boxShadow: "0 0 24px rgba(168,85,247,0.18)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 14,
                }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
                    <path d="M20 3v4M22 5h-4M4 17v2M5 18H3" />
                  </svg>
                </div>
                <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 6, lineHeight: 1.3 }}>
                  Your AI Trading Coach
                </p>
                <p style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.65, maxWidth: 260 }}>
                  Tap a mode above or start typing to begin
                </p>
              </div>

              {/* Pill tab bar */}
              <div className="flex gap-1.5 px-4 pb-3">
                {(["commands", "memory", "stack"] as const).map(tab => {
                  const labels  = { commands: "Commands", memory: "Memory", stack: "AI Stack" }
                  const colors  = { commands: "var(--accent)", memory: "var(--purple)", stack: "var(--green)" }
                  const bgs     = { commands: "rgba(56,189,248,0.10)", memory: "rgba(168,85,247,0.10)", stack: "rgba(0,229,160,0.10)" }
                  const borders = { commands: "rgba(56,189,248,0.28)", memory: "rgba(168,85,247,0.28)", stack: "rgba(0,229,160,0.28)" }
                  const active  = infoTab === tab
                  return (
                    <button key={tab} onClick={() => setInfoTab(tab)}
                      className="flex-1 mono text-xs py-2 rounded-xl transition-all"
                      style={{
                        color:      active ? colors[tab]  : "var(--text3)",
                        background: active ? bgs[tab]     : "rgba(255,255,255,0.03)",
                        border:     `1px solid ${active ? borders[tab] : "var(--border)"}`,
                        fontWeight: active ? 600 : 400,
                      }}>
                      {labels[tab]}
                    </button>
                  )
                })}
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: "var(--border)", marginBottom: 16 }} />

              {/* Tab content */}
              <div className="px-4 pb-1">

                {infoTab === "commands" && (
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "7px 10px", alignItems: "center" }}>
                    {[
                      ["Analyze Journal",  "Deep review of trades vs. your strategy rules"],
                      ["Market Pulse",     "Live macro + instrument data for your watchlist"],
                      ["Strategy Review",  "Critiques your SMC/ICT approach with live research"],
                      ["watch TICKER",     "Add an instrument to your watchlist"],
                      ["unwatch TICKER",   "Remove an instrument from your watchlist"],
                      ["ask anything",     "Trade recaps, R-mult, pattern checks, rule questions"],
                    ].map(([cmd, desc]) => (
                      <div key={cmd} style={{ display: "contents" }}>
                        <span className="mono text-xs px-2 py-0.5 rounded-md"
                          style={{ background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.20)", color: "var(--accent)", justifySelf: "start" }}>
                          {cmd}
                        </span>
                        <span style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.55 }}>{desc}</span>
                      </div>
                    ))}
                  </div>
                )}

                {infoTab === "memory" && (
                  <div className="space-y-2">
                    {[
                      {
                        label: "Always On",
                        color: "var(--purple)",
                        bg: "rgba(168,85,247,0.07)",
                        border: "rgba(168,85,247,0.22)",
                        items: [
                          "Pattern summary — updated every Analyze run",
                          "Past session titles injected into every request",
                          "Weakness profile — built from your trade history",
                          "Streaks · milestones · weekly & monthly summaries",
                        ],
                      },
                      {
                        label: "This Session",
                        color: "var(--accent)",
                        bg: "rgba(56,189,248,0.07)",
                        border: "rgba(56,189,248,0.22)",
                        items: [
                          "Full conversation thread kept in context",
                          "Coach remembers everything said this session",
                        ],
                      },
                      {
                        label: "On-Demand",
                        color: "var(--green)",
                        bg: "rgba(0,229,160,0.07)",
                        border: "rgba(0,229,160,0.22)",
                        items: [
                          "Market data fetched when your question warrants it",
                          "News, macro, futures — coach decides what to pull",
                        ],
                      },
                    ].map(tier => (
                      <div key={tier.label} className="rounded-xl p-3"
                        style={{ background: tier.bg, border: `1px solid ${tier.border}`, borderLeft: `3px solid ${tier.color}` }}>
                        <p className="label-upper mb-1.5" style={{ color: tier.color }}>{tier.label}</p>
                        {tier.items.map(item => (
                          <p key={item} style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.7 }}>· {item}</p>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                {infoTab === "stack" && (
                  <div className="space-y-2">
                    {[
                      { name: "Claude Sonnet", role: "Coaching & reasoning — all 4 modes",              color: "var(--purple)", dot: "rgba(168,85,247,0.9)" },
                      { name: "Gemini Flash",  role: "Tool call · web search for news & strategy",    color: "var(--accent)", dot: "rgba(56,189,248,0.9)"  },
                      { name: "Yahoo Finance", role: "Tool call · futures price snapshot (~15 min)",   color: "var(--green)",  dot: "rgba(0,229,160,0.9)"   },
                      { name: "Alpha Vantage", role: "Tool call · RSI · MACD · news sentiment",        color: "var(--yellow)", dot: "rgba(255,208,96,0.9)"  },
                      { name: "Polygon.io",    role: "Tool call · CME futures OHLCV bars",             color: "var(--text2)",  dot: "rgba(122,135,168,0.7)" },
                      { name: "FRED API",      role: "Tool call · Fed funds · CPI · GDP · yields",    color: "var(--text2)",  dot: "rgba(122,135,168,0.7)" },
                    ].map(({ name, role, color, dot }) => (
                      <div key={name} className="flex items-start gap-3 rounded-xl p-2.5"
                        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0, marginTop: 3, boxShadow: `0 0 6px ${dot}` }} />
                        <div>
                          <p className="mono" style={{ fontSize: 12, fontWeight: 600, color, marginBottom: 2 }}>{name}</p>
                          <p style={{ fontSize: 11, color: "var(--text3)", lineHeight: 1.5 }}>{role}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>

              {/* Dismiss */}
              <div className="p-4">
                <button
                  onClick={() => setShowOnboarding(false)}
                  style={{
                    width: "100%", height: 44, borderRadius: 12,
                    background: "var(--accent3)",
                    border: "1px solid var(--border-accent)",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 600, color: "var(--accent)",
                    letterSpacing: "0.02em",
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(56,189,248,0.14)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "var(--accent3)")}
                >
                  Got it →
                </button>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="space-y-4">
            {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
            {loading && <ThinkingBubble />}
            <div ref={bottomRef} />
          </div>
        </div>
      </div>

      {/* Input — pinned to bottom of flex column */}
      <div className="flex-shrink-0 px-3 pb-4 pt-2">
        <div className="flex items-end gap-2.5 rounded-3xl px-4 py-3" style={{ background: "var(--bg3)", border: "1px solid var(--border-accent)", boxShadow: "0 0 0 1px rgba(56,189,248,0.08), 0 0 18px rgba(56,189,248,0.12)" }}>
          <textarea
            ref={textRef}
            value={input}
            onChange={e => { setInput(e.target.value); adjustHeight() }}
            onKeyDown={handleKeyDown}
            placeholder={loading ? "Coach is thinking…" : "ask me anything..."}
            disabled={loading}
            rows={1}
            className="flex-1 resize-none outline-none text-sm mono bg-transparent coach-input"
            style={{ color: "var(--text)", lineHeight: 1.5, maxHeight: 120, minHeight: 24 }}
          />
          <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 disabled:opacity-30"
            style={{ background: input.trim() && !loading ? "var(--accent)" : "var(--bg2)", border: `1px solid ${input.trim() && !loading ? "var(--accent)" : "var(--border)"}` }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={input.trim() && !loading ? "var(--bg)" : "var(--text3)"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
    </>
  )
}

/* ─── Preview for unauthenticated users ──────────────────────── */
function PreviewCoachView({ activeView, setActiveView }: { activeView: "chat" | "history"; setActiveView: (v: "chat" | "history") => void }) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 flex flex-col" style={{ position: "relative" }}>
        {/* Tab toggle */}
        <div className="px-4 pt-4">
          <CoachTabToggle activeView={activeView} setActiveView={setActiveView} />
        </div>
        {/* Mode chips — disabled, visible above the overlay */}
        <div className="px-4 pt-1 pb-3 flex flex-wrap gap-2 justify-center" style={{ flexShrink: 0 }}>
          {MODES.map(mode => (
            <div key={mode.id}
              className="flex items-center gap-1.5 mono text-xs px-3 py-2 rounded-xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", color: "var(--text2)", opacity: 0.35, cursor: "not-allowed", pointerEvents: "none" }}>
              {mode.icon}
              {mode.label}
            </div>
          ))}
        </div>

        {/* Opaque overlay — fills remaining chat area */}
        <div className="flex-1 flex items-center justify-center px-5"
          style={{ background: "rgba(6,11,20,0.92)" }}>
          <div className="glass rounded-2xl text-center"
            style={{ padding: "28px 24px", width: "100%", maxWidth: 320, border: "1px solid var(--border)" }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", lineHeight: 1.3 }}>
              Sign in to access your AI coach
            </p>
            <p style={{ fontSize: 12, color: "var(--text3)", marginTop: 8, lineHeight: 1.6 }}>
              Sessions, patterns &amp; memory persist across devices
            </p>
          </div>
        </div>
      </div>

      {/* Disabled input area */}
      <div className="flex-shrink-0 px-3 pb-4 pt-2" style={{ opacity: 0.4, pointerEvents: "none" }}>
        <div className="flex items-end gap-2.5 rounded-3xl px-4 py-3" style={{ background: "var(--bg3)", border: "1px solid var(--border)" }}>
          <textarea
            disabled
            placeholder="Sign in to start coaching your trades…"
            rows={1}
            className="flex-1 resize-none outline-none text-sm mono bg-transparent"
            style={{ color: "var(--text)", lineHeight: 1.5, maxHeight: 120, minHeight: 24 }}
          />
          <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "var(--bg2)", border: "1px solid var(--border)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Main component ─────────────────────────────────────────── */
export default function CoachTab() {
  const { isAuthenticated } = useAuthContext()
  const [activeView, setActiveView] = useState<"chat" | "history">("chat")

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {activeView === "chat"
        ? (!isAuthenticated
            ? <PreviewCoachView activeView={activeView} setActiveView={setActiveView} />
            : <ChatView activeView={activeView} setActiveView={setActiveView} />)
        : <HistoryView activeView={activeView} setActiveView={setActiveView} />}
    </div>
  )
}
