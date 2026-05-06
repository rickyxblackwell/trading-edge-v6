"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  ChevronLeft,
  Sparkles,
  CheckCircle2,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"

type Step = 1 | 2
type KeyValidity = null | boolean

function getPasswordStrength(pw: string): { label: string; width: string; color: string } {
  if (!pw) return { label: "", width: "0%", color: "var(--red)" }
  if (pw.length < 8) return { label: "Weak", width: "33%", color: "var(--red)" }
  if (pw.length < 12) return { label: "Fair", width: "66%", color: "var(--yellow)" }
  return { label: "Strong", width: "100%", color: "var(--green)" }
}

export default function SignupPage() {
  const router = useRouter()

  const [step, setStep] = useState<Step>(1)
  const [transitioning, setTransitioning] = useState(false)
  const [direction, setDirection] = useState<"forward" | "back">("forward")
  const [contentVisible, setContentVisible] = useState(true)

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [geminiKey, setGeminiKey] = useState("")

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showGeminiKey, setShowGeminiKey] = useState(false)

  const [keyValid, setKeyValid] = useState<KeyValidity>(null)

  const strength = getPasswordStrength(password)
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword

  const step1Disabled = !email.trim() || !password.trim() || !confirmPassword.trim() || passwordsMismatch

  function transitionToStep(nextStep: Step, dir: "forward" | "back") {
    setDirection(dir)
    setTransitioning(true)
    setContentVisible(false)
    setTimeout(() => {
      setStep(nextStep)
      setError(null)
      setTransitioning(false)
      setContentVisible(true)
    }, 180)
  }

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) {
        if (signUpError.message.toLowerCase().includes("already registered")) {
          setError("An account with this email already exists. Sign in instead?")
        } else {
          setError(signUpError.message)
        }
        setLoading(false)
      } else {
        setLoading(false)
        transitionToStep(2, "forward")
      }
    } catch {
      setError("Connection failed. Check your internet and try again.")
      setLoading(false)
    }
  }

  async function handleStep2(skipKey = false) {
    if (!skipKey && (!geminiKey.trim() || !geminiKey.startsWith("AIza"))) {
      setKeyValid(false)
      return
    }
    setLoading(true)
    try {
      const supabase = createClient()
      if (!skipKey && geminiKey.trim()) {
        await supabase.auth.updateUser({ data: { gemini_api_key: geminiKey.trim() } })
      }
      router.push("/")
      router.refresh()
    } catch {
      setLoading(false)
    }
  }

  function handleKeyBlur() {
    if (!geminiKey.trim()) {
      setKeyValid(null)
      return
    }
    setKeyValid(geminiKey.startsWith("AIza"))
  }

  const contentStyle: React.CSSProperties = {
    transition: "opacity 0.22s ease, transform 0.22s ease",
    opacity: contentVisible ? 1 : 0,
    transform: contentVisible
      ? "translateX(0)"
      : direction === "forward"
      ? "translateX(-12px)"
      : "translateX(12px)",
  }

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
        {/* Back button — Step 2 only */}
        {step === 2 && (
          <button
            type="button"
            onClick={() => transitionToStep(1, "back")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text2)",
              padding: "0 0 12px 0",
              height: "44px",
              fontFamily: "var(--font-inter), system-ui, sans-serif",
              fontSize: "13px",
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text2)")}
          >
            <ChevronLeft size={14} />
            <span>Back</span>
          </button>
        )}

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

        {/* Progress indicator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "4px",
            marginTop: "20px",
          }}
        >
          {/* Dot 1 — always active */}
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "var(--accent)",
              boxShadow: "0 0 6px rgba(56,189,248,0.5)",
              transition: "background 0.3s ease, box-shadow 0.3s ease",
              flexShrink: 0,
            }}
          />
          {/* Connector */}
          <div
            style={{
              width: "32px",
              height: "1px",
              background: step === 2 ? "var(--accent)" : "var(--border)",
              transition: "background 0.3s ease",
              flexShrink: 0,
            }}
          />
          {/* Dot 2 */}
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: step === 2 ? "var(--accent)" : "var(--border)",
              boxShadow: step === 2 ? "0 0 6px rgba(56,189,248,0.5)" : "none",
              border: step === 2 ? "none" : "1px solid var(--border)",
              transition: "background 0.3s ease, box-shadow 0.3s ease",
              flexShrink: 0,
            }}
          />
        </div>

        {/* Step content */}
        <div style={contentStyle}>
          {step === 1 ? (
            <Step1
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              confirmPassword={confirmPassword}
              setConfirmPassword={setConfirmPassword}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              showConfirmPassword={showConfirmPassword}
              setShowConfirmPassword={setShowConfirmPassword}
              strength={strength}
              passwordsMismatch={passwordsMismatch}
              loading={loading}
              error={error}
              step1Disabled={step1Disabled}
              handleStep1={handleStep1}
            />
          ) : (
            <Step2
              geminiKey={geminiKey}
              setGeminiKey={setGeminiKey}
              showGeminiKey={showGeminiKey}
              setShowGeminiKey={setShowGeminiKey}
              keyValid={keyValid}
              handleKeyBlur={handleKeyBlur}
              loading={loading}
              handleStep2={handleStep2}
            />
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { transition: none !important; animation: none !important; }
        }
      `}</style>
    </div>
  )
}

interface Step1Props {
  email: string
  setEmail: (v: string) => void
  password: string
  setPassword: (v: string) => void
  confirmPassword: string
  setConfirmPassword: (v: string) => void
  showPassword: boolean
  setShowPassword: (v: boolean) => void
  showConfirmPassword: boolean
  setShowConfirmPassword: (v: boolean) => void
  strength: { label: string; width: string; color: string }
  passwordsMismatch: boolean
  loading: boolean
  error: string | null
  step1Disabled: boolean
  handleStep1: (e: React.FormEvent) => void
}

function Step1({
  email,
  setEmail,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  showPassword,
  setShowPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  strength,
  passwordsMismatch,
  loading,
  error,
  step1Disabled,
  handleStep1,
}: Step1Props) {
  return (
    <>
      <h1
        style={{
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          fontSize: "20px",
          fontWeight: 600,
          color: "var(--text)",
          lineHeight: 1.2,
          marginTop: "20px",
          marginBottom: "0",
          letterSpacing: "-0.01em",
        }}
      >
        Create your account
      </h1>

      <form onSubmit={handleStep1} style={{ marginTop: "20px" }}>
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
        <div style={{ marginBottom: "16px" }}>
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
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                height: "48px",
                width: "100%",
                borderRadius: "12px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--border)",
                padding: "0 48px 0 16px",
                fontFamily: "var(--font-inter), system-ui, sans-serif",
                fontSize: "14px",
                fontWeight: 400,
                color: "var(--text)",
                transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                boxSizing: "border-box",
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
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

          {/* Password strength bar */}
          {password.length > 0 && (
            <div style={{ marginTop: "8px" }}>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "4px" }}>
                <span
                  className="mono"
                  style={{ fontSize: "10px", color: strength.color }}
                >
                  {strength.label}
                </span>
              </div>
              <div
                style={{
                  width: "100%",
                  height: "3px",
                  borderRadius: "2px",
                  background: "rgba(255,255,255,0.06)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: strength.width,
                    background: strength.color,
                    borderRadius: "2px",
                    transition: "width 0.3s ease, background-color 0.3s ease",
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div style={{ marginBottom: "0" }}>
          <label
            htmlFor="confirmPassword"
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
            CONFIRM PASSWORD
          </label>
          <div style={{ position: "relative" }}>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{
                height: "48px",
                width: "100%",
                borderRadius: "12px",
                background: "rgba(255,255,255,0.04)",
                border: passwordsMismatch
                  ? "1px solid rgba(248,113,113,0.5)"
                  : "1px solid var(--border)",
                padding: "0 48px 0 16px",
                fontFamily: "var(--font-inter), system-ui, sans-serif",
                fontSize: "14px",
                fontWeight: 400,
                color: "var(--text)",
                transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                boxSizing: "border-box",
                boxShadow: passwordsMismatch
                  ? "0 0 0 2px rgba(248,113,113,0.08)"
                  : undefined,
              }}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
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
              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* Password mismatch error */}
          {passwordsMismatch && (
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
              Passwords do not match.
            </p>
          )}

          {/* General error */}
          {error && !passwordsMismatch && (
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

        {/* Continue button */}
        <button
          type="submit"
          disabled={loading || step1Disabled}
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
            cursor: loading || step1Disabled ? "not-allowed" : "pointer",
            marginTop: "24px",
            opacity: step1Disabled ? 0.5 : loading ? 0.7 : 1,
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
            "Continue →"
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
          Already have an account?
        </span>
        <Link
          href="/login"
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
          Sign in →
        </Link>
      </div>
    </>
  )
}

interface Step2Props {
  geminiKey: string
  setGeminiKey: (v: string) => void
  showGeminiKey: boolean
  setShowGeminiKey: (v: boolean) => void
  keyValid: KeyValidity
  handleKeyBlur: () => void
  loading: boolean
  handleStep2: (skipKey?: boolean) => void
}

function Step2({
  geminiKey,
  setGeminiKey,
  showGeminiKey,
  setShowGeminiKey,
  keyValid,
  handleKeyBlur,
  loading,
  handleStep2,
}: Step2Props) {
  const saveDisabled = !geminiKey.trim() || !geminiKey.startsWith("AIza")

  return (
    <>
      <h1
        style={{
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          fontSize: "20px",
          fontWeight: 600,
          color: "var(--text)",
          lineHeight: 1.2,
          marginTop: "20px",
          marginBottom: "16px",
          letterSpacing: "-0.01em",
        }}
      >
        Connect your AI coach
      </h1>

      {/* Description panel */}
      <div
        style={{
          borderRadius: "12px",
          border: "1px solid var(--border-accent)",
          background: "var(--accent3)",
          padding: "16px",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            marginBottom: "8px",
          }}
        >
          <Sparkles size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />
          <span
            style={{
              fontFamily: "var(--font-inter), system-ui, sans-serif",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--accent)",
            }}
          >
            Gemini API Key
          </span>
        </div>
        <p
          style={{
            fontFamily: "var(--font-inter), system-ui, sans-serif",
            fontSize: "12px",
            fontWeight: 400,
            color: "var(--text2)",
            lineHeight: 1.6,
            margin: "0 0 8px 0",
          }}
        >
          Your key unlocks AI analysis of your real trade data.
          It&apos;s stored securely in your account and never logged on our servers.
        </p>
        <a
          href="https://ai.google.dev"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: "var(--font-inter), system-ui, sans-serif",
            fontSize: "12px",
            color: "var(--accent)",
            textDecoration: "none",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
        >
          Get a free key at ai.google.dev →
        </a>
      </div>

      {/* Gemini key field */}
      <div style={{ marginBottom: "0" }}>
        <label
          htmlFor="geminiKey"
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
          GEMINI API KEY
        </label>
        <div style={{ position: "relative" }}>
          <input
            id="geminiKey"
            name="geminiKey"
            type={showGeminiKey ? "text" : "password"}
            placeholder="AIza…"
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            onBlur={handleKeyBlur}
            style={{
              height: "48px",
              width: "100%",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.04)",
              border:
                keyValid === false
                  ? "1px solid rgba(248,113,113,0.5)"
                  : "1px solid var(--border)",
              padding: "0 48px 0 16px",
              fontFamily: "var(--font-ibm-plex-mono), 'Courier New', monospace",
              fontSize: "14px",
              fontWeight: 400,
              color: "var(--text)",
              transition: "border-color 0.2s ease, box-shadow 0.2s ease",
              boxSizing: "border-box",
              boxShadow:
                keyValid === false
                  ? "0 0 0 2px rgba(248,113,113,0.08)"
                  : undefined,
            }}
          />
          <button
            type="button"
            onClick={() => setShowGeminiKey(!showGeminiKey)}
            aria-label={showGeminiKey ? "Hide key" : "Show key"}
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
            {showGeminiKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {/* Key validation feedback */}
        {keyValid === false && (
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
            API keys start with &apos;AIza&apos;. Double-check your key.
          </p>
        )}
        {keyValid === true && (
          <p
            className="fade-up"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginTop: "8px",
              fontFamily: "var(--font-inter), system-ui, sans-serif",
              fontSize: "12px",
              color: "var(--green)",
            }}
          >
            <CheckCircle2 size={12} style={{ flexShrink: 0 }} />
            Looks good
          </p>
        )}
      </div>

      {/* Save button */}
      <button
        type="button"
        disabled={loading || saveDisabled}
        onClick={() => handleStep2(false)}
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
          cursor: loading || saveDisabled ? "not-allowed" : "pointer",
          marginTop: "24px",
          opacity: saveDisabled ? 0.5 : loading ? 0.7 : 1,
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
          "Save and start coaching"
        )}
      </button>

      {/* Skip link */}
      <button
        type="button"
        onClick={() => handleStep2(true)}
        style={{
          display: "block",
          width: "100%",
          textAlign: "center",
          marginTop: "12px",
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          fontSize: "13px",
          fontWeight: 400,
          color: "var(--text2)",
          cursor: "pointer",
          background: "none",
          border: "none",
          minHeight: "44px",
          padding: "12px 0",
          transition: "color 0.15s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text2)")}
      >
        Skip for now — I&apos;ll add this later
      </button>
    </>
  )
}
