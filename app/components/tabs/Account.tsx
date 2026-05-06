"use client"

import { useState, useEffect } from "react"
import {
  ChevronRight,
  Mail,
  KeyRound,
  PencilLine,
  LogOut,
  AlertTriangle,
  CheckCircle,
  Eye,
  EyeOff,
  Loader2,
  Database,
  Download,
  Upload,
} from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useAuthContext } from "@/app/components/AuthProvider"

export default function AccountTab() {
  const { isAuthenticated, user } = useAuthContext()
  const [email, setEmail] = useState("")
  const [emailVerified, setEmailVerified] = useState(false)
  const [maskedKey, setMaskedKey] = useState<string | null>(null)

  const [expanded, setExpanded] = useState(false)
  const [newKey, setNewKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const [maskedClaudeKey, setMaskedClaudeKey] = useState<string | null>(null)
  const [claudeExpanded, setClaudeExpanded] = useState(false)
  const [newClaudeKey, setNewClaudeKey] = useState("")
  const [showClaudeKey, setShowClaudeKey] = useState(false)
  const [claudeSaving, setClaudeSaving] = useState(false)
  const [claudeSaveSuccess, setClaudeSaveSuccess] = useState(false)

  const [memoryBackupExpanded, setMemoryBackupExpanded] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState(false)
  const [exporting, setExporting] = useState(false)

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? "")
      setEmailVerified(!!user?.email_confirmed_at)
      const key = user?.user_metadata?.gemini_api_key as string | undefined
      setMaskedKey(key ? `AIza••••${key.slice(-4)}` : null)
      const claudeKey = user?.user_metadata?.claude_api_key as string | undefined
      setMaskedClaudeKey(claudeKey ? `sk-ant-••••${claudeKey.slice(-4)}` : null)
    })
  }, [])

  useEffect(() => {
    if (showLogoutConfirm) {
      const timer = setTimeout(() => setShowLogoutConfirm(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [showLogoutConfirm])

  async function handleSaveKey() {
    if (!newKey.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({
      data: { gemini_api_key: newKey.trim() },
    })
    if (!error) {
      setSaveSuccess(true)
      setTimeout(() => {
        setSaveSuccess(false)
        setExpanded(false)
        setNewKey("")
        supabase.auth.getUser().then(({ data: { user } }) => {
          const key = user?.user_metadata?.gemini_api_key as string | undefined
          setMaskedKey(key ? `AIza••••${key.slice(-4)}` : null)
        })
      }, 2000)
    }
    setSaving(false)
  }

  async function handleSaveClaudeKey() {
    if (!newClaudeKey.trim()) return
    setClaudeSaving(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({
      data: { claude_api_key: newClaudeKey.trim() },
    })
    if (!error) {
      setClaudeSaveSuccess(true)
      setTimeout(() => {
        setClaudeSaveSuccess(false)
        setClaudeExpanded(false)
        setNewClaudeKey("")
        supabase.auth.getUser().then(({ data: { user } }) => {
          const key = user?.user_metadata?.claude_api_key as string | undefined
          setMaskedClaudeKey(key ? `sk-ant-••••${key.slice(-4)}` : null)
        })
      }, 2000)
    }
    setClaudeSaving(false)
  }

  async function handleExportMemory() {
    if (!user) return
    setExporting(true)
    const meta = user.user_metadata ?? {}
    const exportFields = {
      pattern_summary: meta.pattern_summary ?? null,
      session_index: meta.session_index ?? [],
      behavior_ledger: meta.behavior_ledger ?? null,
      milestone_log: meta.milestone_log ?? null,
      streaks: meta.streaks ?? null,
      journal_memory: meta.journal_memory ?? null,
      weekly_summaries: meta.weekly_summaries ?? [],
      monthly_summaries: meta.monthly_summaries ?? [],
      watchlist: meta.watchlist ?? [],
      strategy_text: meta.strategy_text ?? "",
    }
    const payload = {
      version: "v6-memory-1",
      exportedAt: new Date().toISOString(),
      data: exportFields,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `trading-edge-memory-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setExporting(false)
  }

  async function handleImportMemory(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError(null)
    setImportSuccess(false)
    const text = await file.text()
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      setImportError("Invalid JSON file")
      return
    }
    const p = parsed as Record<string, unknown>
    if (p.version !== "v6-memory-1") {
      setImportError("Unrecognised file version")
      return
    }
    const data = (p.data ?? {}) as Record<string, unknown>
    const allowedKeys = [
      "pattern_summary","session_index","behavior_ledger","milestone_log",
      "streaks","journal_memory","weekly_summaries","monthly_summaries",
      "watchlist","strategy_text",
    ]
    const mergeFields: Record<string, unknown> = {}
    for (const key of allowedKeys) {
      if (key in data) mergeFields[key] = data[key]
    }
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ data: mergeFields })
    if (error) {
      setImportError("Import failed: " + error.message)
    } else {
      setImportSuccess(true)
      setTimeout(() => setImportSuccess(false), 3000)
    }
    e.target.value = ""
  }

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
  }

  if (!isAuthenticated) {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "8px 16px 48px" }}>
        <p className="mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text2)", marginBottom: 24 }}>
          Account
        </p>
        <div className="glass rounded-2xl p-8 flex flex-col items-center justify-center gap-3 text-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <p className="text-sm font-medium mt-2" style={{ color: "var(--text)" }}>You&apos;re not signed in</p>
          <p className="text-xs" style={{ color: "var(--text2)", lineHeight: 1.6 }}>
            Sign in to save your trades to the cloud, access the AI coach, and sync across devices.
          </p>
          <Link href="/login" className="mono font-semibold"
            style={{ display: "block", height: 44, lineHeight: "44px", width: "100%", borderRadius: 12, background: "linear-gradient(to bottom, var(--accent), #0ea5e9)", boxShadow: "0 1px 24px rgba(56,189,248,0.25)", color: "var(--bg)", fontSize: 14, marginTop: 8, textAlign: "center" }}>
            Sign in →
          </Link>
          <Link href="/signup" style={{ fontSize: 13, color: "var(--text2)" }}>
            No account? Create one free
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "8px 16px 48px" }}>
      {/* Page title */}
      <p
        className="mono"
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--text2)",
          marginBottom: 24,
        }}
      >
        Settings
      </p>

      {/* ACCOUNT section */}
      <section style={{ marginBottom: 24 }}>
        <p
          style={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "var(--text2)",
            marginBottom: 8,
            fontFamily: "var(--font-inter, Inter, sans-serif)",
          }}
        >
          Account
        </p>
        <div className="glass" style={{ borderRadius: 16, overflow: "hidden" }}>
          <div
            style={{
              minHeight: 56,
              padding: "0 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center" }}>
              <Mail size={16} style={{ color: "var(--text2)", flexShrink: 0 }} />
              <span
                style={{
                  marginLeft: 10,
                  fontSize: 14,
                  color: "var(--text)",
                  fontFamily: "var(--font-ibm-plex-mono, monospace)",
                }}
              >
                {email || "—"}
              </span>
            </div>
            {emailVerified && (
              <span
                className="mono"
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: "var(--green)",
                  background: "rgba(52,211,153,0.1)",
                  border: "1px solid rgba(52,211,153,0.2)",
                  borderRadius: 4,
                  padding: "2px 6px",
                }}
              >
                VERIFIED
              </span>
            )}
          </div>
        </div>
      </section>

      {/* AI COACH section */}
      <section style={{ marginBottom: 24 }}>
        <p
          style={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "var(--text2)",
            marginBottom: 8,
            fontFamily: "var(--font-inter, Inter, sans-serif)",
          }}
        >
          AI Coach
        </p>
        <div className="glass" style={{ borderRadius: 16, overflow: "hidden" }}>
          {/* Key status row */}
          <div
            style={{
              height: 56,
              padding: "0 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center" }}>
              <KeyRound size={16} style={{ color: "var(--text2)", flexShrink: 0 }} />
              <div style={{ marginLeft: 10 }}>
                <span
                  style={{
                    fontSize: 14,
                    color: "var(--text)",
                    fontFamily: "var(--font-inter, Inter, sans-serif)",
                    display: "block",
                  }}
                >
                  Gemini API Key
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: maskedKey ? "var(--text2)" : "var(--red)",
                    display: "block",
                    marginTop: 2,
                  }}
                >
                  {maskedKey ?? "Not connected"}
                </span>
              </div>
            </div>
            <span
              className="mono"
              style={{
                fontSize: 10,
                color: maskedKey ? "var(--green)" : "var(--red)",
                background: maskedKey ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
                border: maskedKey
                  ? "1px solid rgba(52,211,153,0.2)"
                  : "1px solid rgba(248,113,113,0.2)",
                borderRadius: 999,
                padding: "2px 8px",
              }}
            >
              {maskedKey ? "Connected" : "Not set"}
            </span>
          </div>

          {/* Update key toggle row */}
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              width: "100%",
              height: 44,
              padding: "0 16px",
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "transparent",
              border: "none",
              borderTop: "1px solid var(--border)",
              cursor: "pointer",
              color: "var(--text2)",
              transition: "background 0.15s ease",
              textAlign: "left",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <PencilLine size={14} style={{ color: "var(--text2)" }} />
            <span
              style={{
                fontSize: 13,
                fontFamily: "var(--font-inter, Inter, sans-serif)",
                flex: 1,
              }}
            >
              Update API key
            </span>
            <ChevronRight
              size={14}
              style={{
                color: "var(--text3)",
                transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease",
              }}
            />
          </button>

          {/* Expanded panel */}
          {expanded && (
            <div style={{ borderTop: "1px solid var(--border)", padding: 16 }}>
              <div style={{ position: "relative" }}>
                <input
                  type={showKey ? "text" : "password"}
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="AIza…"
                  style={{
                    width: "100%",
                    height: 48,
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid var(--border)",
                    padding: "0 48px 0 16px",
                    fontFamily: "var(--font-ibm-plex-mono, monospace)",
                    fontSize: 14,
                    color: "var(--text)",
                    boxSizing: "border-box",
                    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 32,
                    height: 32,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text2)",
                    transition: "color 0.15s ease",
                    padding: 0,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text2)")}
                  aria-label={showKey ? "Hide key" : "Show key"}
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {saveSuccess ? (
                <div
                  style={{
                    height: 44,
                    marginTop: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <CheckCircle size={14} style={{ color: "var(--green)" }} />
                  <span className="mono" style={{ fontSize: 13, color: "var(--green)" }}>
                    Key saved
                  </span>
                </div>
              ) : (
                <button
                  onClick={handleSaveKey}
                  disabled={!newKey.trim() || saving}
                  className="btn-accent"
                  style={{
                    width: "100%",
                    height: 44,
                    marginTop: 12,
                    borderRadius: 12,
                    border: "none",
                    cursor: newKey.trim() && !saving ? "pointer" : "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--bg)",
                    opacity: !newKey.trim() || saving ? 0.5 : 1,
                    fontFamily: "var(--font-inter, Inter, sans-serif)",
                  }}
                >
                  {saving ? <Loader2 size={16} className="spin" /> : "Save key"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Claude key glass card */}
        <div className="glass" style={{ borderRadius: 16, overflow: "hidden", marginTop: 12 }}>
          {/* Claude key status row */}
          <div
            style={{
              height: 56,
              padding: "0 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center" }}>
              <KeyRound size={16} style={{ color: "var(--text2)", flexShrink: 0 }} />
              <div style={{ marginLeft: 10 }}>
                <span
                  style={{
                    fontSize: 14,
                    color: "var(--text)",
                    fontFamily: "var(--font-inter, Inter, sans-serif)",
                    display: "block",
                  }}
                >
                  Claude API Key
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: maskedClaudeKey ? "var(--text2)" : "var(--red)",
                    display: "block",
                    marginTop: 2,
                  }}
                >
                  {maskedClaudeKey ?? "Not connected"}
                </span>
              </div>
            </div>
            <span
              className="mono"
              style={{
                fontSize: 10,
                color: maskedClaudeKey ? "var(--green)" : "var(--red)",
                background: maskedClaudeKey ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
                border: maskedClaudeKey
                  ? "1px solid rgba(52,211,153,0.2)"
                  : "1px solid rgba(248,113,113,0.2)",
                borderRadius: 999,
                padding: "2px 8px",
              }}
            >
              {maskedClaudeKey ? "Connected" : "Not set"}
            </span>
          </div>

          {/* Update Claude key toggle row */}
          <button
            onClick={() => setClaudeExpanded((v) => !v)}
            style={{
              width: "100%",
              height: 44,
              padding: "0 16px",
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "transparent",
              border: "none",
              borderTop: "1px solid var(--border)",
              cursor: "pointer",
              color: "var(--text2)",
              transition: "background 0.15s ease",
              textAlign: "left",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <PencilLine size={14} style={{ color: "var(--text2)" }} />
            <span
              style={{
                fontSize: 13,
                fontFamily: "var(--font-inter, Inter, sans-serif)",
                flex: 1,
              }}
            >
              Update API key
            </span>
            <ChevronRight
              size={14}
              style={{
                color: "var(--text3)",
                transform: claudeExpanded ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease",
              }}
            />
          </button>

          {/* Claude key expanded panel */}
          {claudeExpanded && (
            <div style={{ borderTop: "1px solid var(--border)", padding: 16 }}>
              <div style={{ position: "relative" }}>
                <input
                  type={showClaudeKey ? "text" : "password"}
                  value={newClaudeKey}
                  onChange={(e) => setNewClaudeKey(e.target.value)}
                  placeholder="sk-ant-…"
                  style={{
                    width: "100%",
                    height: 48,
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid var(--border)",
                    padding: "0 48px 0 16px",
                    fontFamily: "var(--font-ibm-plex-mono, monospace)",
                    fontSize: 14,
                    color: "var(--text)",
                    boxSizing: "border-box",
                    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowClaudeKey((v) => !v)}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 32,
                    height: 32,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text2)",
                    transition: "color 0.15s ease",
                    padding: 0,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text2)")}
                  aria-label={showClaudeKey ? "Hide key" : "Show key"}
                >
                  {showClaudeKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {claudeSaveSuccess ? (
                <div
                  style={{
                    height: 44,
                    marginTop: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <CheckCircle size={14} style={{ color: "var(--green)" }} />
                  <span className="mono" style={{ fontSize: 13, color: "var(--green)" }}>
                    Key saved
                  </span>
                </div>
              ) : (
                <button
                  onClick={handleSaveClaudeKey}
                  disabled={!newClaudeKey.trim() || claudeSaving}
                  className="btn-accent"
                  style={{
                    width: "100%",
                    height: 44,
                    marginTop: 12,
                    borderRadius: 12,
                    border: "none",
                    cursor: newClaudeKey.trim() && !claudeSaving ? "pointer" : "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--bg)",
                    opacity: !newClaudeKey.trim() || claudeSaving ? 0.5 : 1,
                    fontFamily: "var(--font-inter, Inter, sans-serif)",
                  }}
                >
                  {claudeSaving ? <Loader2 size={16} className="spin" /> : "Save key"}
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* MEMORY BACKUP section */}
      <section style={{ marginBottom: 24 }}>
        <p
          style={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "var(--text2)",
            marginBottom: 8,
            fontFamily: "var(--font-inter, Inter, sans-serif)",
          }}
        >
          Memory Backup
        </p>
        <div className="glass" style={{ borderRadius: 16, overflow: "hidden" }}>
          <button
            onClick={() => setMemoryBackupExpanded((v) => !v)}
            style={{
              width: "100%",
              height: 56,
              padding: "0 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--text)",
              transition: "background 0.15s ease",
              textAlign: "left",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Database size={16} style={{ color: "var(--text2)", flexShrink: 0 }} />
              <div>
                <span style={{ fontSize: 14, color: "var(--text)", fontFamily: "var(--font-inter, Inter, sans-serif)", display: "block" }}>
                  Export / Import Memory
                </span>
                <span style={{ fontSize: 11, color: "var(--text3)", fontFamily: "var(--font-inter, Inter, sans-serif)", display: "block", marginTop: 2 }}>
                  Pattern summary, sessions, streaks, watchlist
                </span>
              </div>
            </div>
            <ChevronRight
              size={14}
              style={{
                color: "var(--text3)",
                transform: memoryBackupExpanded ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease",
                flexShrink: 0,
              }}
            />
          </button>

          {memoryBackupExpanded && (
            <div style={{ borderTop: "1px solid var(--border)", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Export */}
              <button
                onClick={handleExportMemory}
                disabled={exporting}
                style={{
                  height: 44,
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "rgba(255,255,255,0.04)",
                  cursor: exporting ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  fontSize: 14,
                  color: "var(--text)",
                  opacity: exporting ? 0.5 : 1,
                  fontFamily: "var(--font-inter, Inter, sans-serif)",
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={(e) => !exporting && (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
              >
                <Download size={14} style={{ color: "var(--text2)" }} />
                {exporting ? "Exporting…" : "Download memory backup"}
              </button>

              {/* Import */}
              <label
                style={{
                  height: 44,
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "rgba(255,255,255,0.04)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  fontSize: 14,
                  color: "var(--text)",
                  fontFamily: "var(--font-inter, Inter, sans-serif)",
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
              >
                <Upload size={14} style={{ color: "var(--text2)" }} />
                Import memory backup
                <input
                  type="file"
                  accept=".json"
                  style={{ display: "none" }}
                  onChange={handleImportMemory}
                />
              </label>

              {importError && (
                <p className="mono" style={{ fontSize: 12, color: "var(--red)", margin: 0 }}>
                  {importError}
                </p>
              )}
              {importSuccess && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <CheckCircle size={14} style={{ color: "var(--green)" }} />
                  <span className="mono" style={{ fontSize: 12, color: "var(--green)" }}>Memory restored</span>
                </div>
              )}

              <p style={{ fontSize: 11, color: "var(--text3)", margin: 0, fontFamily: "var(--font-inter, Inter, sans-serif)", lineHeight: 1.5 }}>
                Export saves your AI coaching memory as a JSON file. Import restores from a previous export — only fields present in the file are overwritten.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* SESSION section */}
      <section>
        <p
          style={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "var(--text2)",
            marginBottom: 8,
            fontFamily: "var(--font-inter, Inter, sans-serif)",
          }}
        >
          Session
        </p>
        <div className="glass" style={{ borderRadius: 16, overflow: "hidden" }}>
          {showLogoutConfirm ? (
            <div
              style={{
                minHeight: 72,
                padding: "0 16px",
                display: "flex",
                alignItems: "center",
                gap: 12,
                transition: "height 0.2s ease, opacity 0.15s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                <AlertTriangle size={16} style={{ color: "var(--red)", flexShrink: 0 }} />
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--red)",
                    fontFamily: "var(--font-inter, Inter, sans-serif)",
                  }}
                >
                  Are you sure? This ends your session.
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  style={{
                    height: 44,
                    padding: "0 12px",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    background: "transparent",
                    cursor: "pointer",
                    color: "var(--text2)",
                    transition: "background 0.15s ease",
                    fontFamily: "var(--font-ibm-plex-mono, monospace)",
                    fontSize: 12,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  style={{
                    height: 44,
                    padding: "0 12px",
                    border: "1px solid rgba(248,113,113,0.3)",
                    borderRadius: 8,
                    background: "rgba(248,113,113,0.06)",
                    cursor: "pointer",
                    color: "var(--red)",
                    transition: "background 0.15s ease",
                    fontFamily: "var(--font-ibm-plex-mono, monospace)",
                    fontSize: 12,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(248,113,113,0.12)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(248,113,113,0.06)")}
                >
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowLogoutConfirm(true)}
              style={{
                width: "100%",
                height: 56,
                padding: "0 16px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                transition: "background 0.15s ease",
                textAlign: "left",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(248,113,113,0.04)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <LogOut size={16} style={{ color: "var(--red)" }} />
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--red)",
                  fontFamily: "var(--font-inter, Inter, sans-serif)",
                }}
              >
                Sign out
              </span>
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
