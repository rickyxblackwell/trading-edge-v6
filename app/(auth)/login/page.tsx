"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, AlertCircle, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export default function LoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (authError) {
        setError("Invalid email or password. Please try again.")
        setLoading(false)
      } else {
        router.push("/")
        router.refresh()
      }
    } catch {
      setError("Connection failed. Check your internet and try again.")
      setLoading(false)
    }
  }

  const isDisabled = !email.trim() || !password.trim()

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "env(safe-area-inset-top) 16px env(safe-area-inset-bottom) 16px",
        position: "relative",
        zIndex: 10,
      }}
    >
      <div
        className="glass-md"
        style={{
          width: "calc(100% - 32px)",
          maxWidth: "400px",
          borderRadius: "20px",
          padding: "32px",
          animation: "slideUp 0.35s ease forwards",
        }}
      >
        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "6px",
              height: "20px",
              borderRadius: "3px",
              background: "var(--accent)",
              boxShadow: "0 0 8px var(--accent), 0 0 20px rgba(56,189,248,0.4)",
              flexShrink: 0,
            }}
          />
          <span
            className="mono"
            style={{
              fontSize: "13px",
              fontWeight: 600,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--text)",
            }}
          >
            TRADING EDGE
          </span>
        </div>

        {/* Heading */}
        <h1
          style={{
            fontFamily: "var(--font-inter), system-ui, sans-serif",
            fontSize: "20px",
            fontWeight: 600,
            color: "var(--text)",
            lineHeight: 1.2,
            marginTop: "24px",
            marginBottom: "0",
          }}
        >
          Sign in to your account
        </h1>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ marginTop: "24px" }}>
          {/* Email */}
          <div style={{ marginBottom: "16px" }}>
            <label
              htmlFor="email"
              style={{
                display: "block",
                fontSize: "10px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--text2)",
                marginBottom: "6px",
              }}
            >
              EMAIL
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                height: "48px",
                width: "100%",
                borderRadius: "12px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--border)",
                padding: "0 16px",
                fontFamily: "var(--font-inter), system-ui, sans-serif",
                fontSize: "14px",
                fontWeight: 400,
                color: "var(--text)",
                transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: "0" }}>
            <label
              htmlFor="password"
              style={{
                display: "block",
                fontSize: "10px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--text2)",
                marginBottom: "6px",
              }}
            >
              PASSWORD
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  height: "48px",
                  width: "100%",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.04)",
                  border: error ? "1px solid rgba(248,113,113,0.5)" : "1px solid var(--border)",
                  padding: "0 48px 0 16px",
                  fontFamily: "var(--font-inter), system-ui, sans-serif",
                  fontSize: "14px",
                  fontWeight: 400,
                  color: "var(--text)",
                  transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                  boxSizing: "border-box",
                  boxShadow: error ? "0 0 0 2px rgba(248,113,113,0.08)" : undefined,
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                style={{
                  position: "absolute",
                  right: "8px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text2)",
                  padding: 0,
                  transition: "color 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text2)")}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Error message */}
            {error && (
              <p
                className="mono fade-up"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginTop: "8px",
                  fontSize: "12px",
                  color: "var(--red)",
                  borderLeft: "2px solid var(--red)",
                  paddingLeft: "8px",
                }}
              >
                <AlertCircle size={12} style={{ flexShrink: 0 }} />
                {error}
              </p>
            )}
          </div>

          {/* Sign in button */}
          <button
            type="submit"
            disabled={loading || isDisabled}
            className="btn-accent"
            style={{
              height: "48px",
              width: "100%",
              borderRadius: "12px",
              color: "var(--bg)",
              fontFamily: "var(--font-inter), system-ui, sans-serif",
              fontSize: "15px",
              fontWeight: 600,
              letterSpacing: "0.01em",
              border: "none",
              cursor: loading || isDisabled ? "not-allowed" : "pointer",
              marginTop: "24px",
              opacity: isDisabled ? 0.5 : loading ? 0.7 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              transition: "opacity 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease",
            }}
          >
            {loading ? (
              <Loader2
                size={16}
                style={{ animation: "spin 0.8s linear infinite" }}
              />
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        {/* Footer */}
        <div
          style={{
            marginTop: "16px",
            textAlign: "center",
            display: "flex",
            gap: "4px",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-inter), system-ui, sans-serif",
              fontSize: "13px",
              color: "var(--text2)",
            }}
          >
            No account?
          </span>
          <Link
            href="/signup"
            style={{
              fontFamily: "var(--font-inter), system-ui, sans-serif",
              fontSize: "13px",
              color: "var(--accent)",
              textDecoration: "none",
              transition: "text-decoration 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
          >
            Create one →
          </Link>
        </div>

        <div style={{ marginTop: "12px", textAlign: "center" }}>
          <Link
            href="/"
            style={{
              fontFamily: "var(--font-inter), system-ui, sans-serif",
              fontSize: "12px",
              color: "var(--text3)",
              textDecoration: "none",
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text2)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text3)")}
          >
            Continue without signing in →
          </Link>
          <p style={{ fontFamily: "var(--font-inter), system-ui, sans-serif", fontSize: "11px", color: "var(--text3)", marginTop: "4px", lineHeight: 1.5 }}>
            Data won&apos;t be saved to the cloud without an account.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="slideUp"] {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
        @media (max-width: 640px) {
          .auth-card {
            padding: 24px !important;
          }
        }
      `}</style>
    </div>
  )
}
