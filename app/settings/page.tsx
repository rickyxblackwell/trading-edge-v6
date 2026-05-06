"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  ChevronLeft,
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
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export default function SettingsPage() {
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [emailVerified, setEmailVerified] = useState(false)
  const [maskedKey, setMaskedKey] = useState<string | null>(null)

  const [expanded, setExpanded] = useState(false)
  const [newKey, setNewKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? "")
      setEmailVerified(!!user?.email_confirmed_at)
      const key = user?.user_metadata?.gemini_api_key as string | undefined
      setMaskedKey(key ? `AIza••••${key.slice(-4)}` : null)
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

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    // AuthProvider onAuthStateChange fires SIGNED_OUT → router.push('/login')
  }

  return (
    <div style={{ minHeight: "100dvh", position: "relative", background: "var(--bg)" }}>
      {/* Ambient orbs */}
      <div className="ambient-bg" aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      {/* Sticky back header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          height: 56,
          paddingTop: "env(safe-area-inset-top)",
          paddingLeft: 16,
          paddingRight: 16,
          background: "rgba(6,11,20,0.9)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <button
          onClick={() => router.back()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            height: 44,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text2)",
            padding: 0,
            transition: "color 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text2)")}
        >
          <ChevronLeft size={18} />
          <span style={{ fontSize: 14, fontFamily: "var(--font-inter, Inter, sans-serif)" }}>
            Back
          </span>
        </button>

        <span
          className="mono"
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--text2)",
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          SETTINGS
        </span>

        {/* Spacer to balance back button */}
        <div style={{ width: 56 }} />
      </header>

      {/* Content */}
      <main
        style={{
          padding: "24px 16px 48px",
          maxWidth: 600,
          margin: "0 auto",
          position: "relative",
          zIndex: 10,
        }}
      >
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
          <div
            className="glass"
            style={{ borderRadius: 16, overflow: "hidden" }}
          >
            {/* Email row */}
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
          <div
            className="glass"
            style={{ borderRadius: 16, overflow: "hidden" }}
          >
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
                  background: maskedKey
                    ? "rgba(52,211,153,0.1)"
                    : "rgba(248,113,113,0.1)",
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
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.03)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
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
              <div
                style={{
                  borderTop: "1px solid var(--border)",
                  padding: 16,
                }}
              >
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
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = "var(--text)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = "var(--text2)")
                    }
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
                    <span
                      className="mono"
                      style={{ fontSize: 13, color: "var(--green)" }}
                    >
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
                    {saving ? (
                      <Loader2 size={16} className="spin" />
                    ) : (
                      "Save key"
                    )}
                  </button>
                )}
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
          <div
            className="glass"
            style={{ borderRadius: 16, overflow: "hidden" }}
          >
            {showLogoutConfirm ? (
              /* Confirmation state */
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
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <AlertTriangle
                    size={16}
                    style={{ color: "var(--red)", flexShrink: 0 }}
                  />
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
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(255,255,255,0.04)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
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
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(248,113,113,0.12)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(248,113,113,0.06)")
                    }
                  >
                    {signingOut ? "Signing out…" : "Sign out"}
                  </button>
                </div>
              </div>
            ) : (
              /* Default logout row */
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
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background =
                    "rgba(248,113,113,0.04)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
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
      </main>

    </div>
  )
}
