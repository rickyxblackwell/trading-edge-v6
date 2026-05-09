"use client"

import { useState } from "react"

/* ─── TF Ladder data ─────────────────────────────────────── */
const TF_LADDER = [
  {
    tf: "1D", label: "Daily", color: "var(--accent)",
    title: "Macro Context",
    bullets: [
      "Market structure — HH/HL vs LH/LL",
      "Major S/R zones & weekly levels",
      "Dominant trend direction & HTF bias",
      "HTF liquidity pools above/below",
    ],
  },
  {
    tf: "4H", label: "4-Hour", color: "var(--purple)",
    title: "Swing Context",
    bullets: [
      "Swing highs/lows & retracement zones",
      "FVGs, imbalances, POI",
      "Premium / discount zones",
      "Identify next liquidity draw",
    ],
  },
  {
    tf: "1H", label: "1-Hour", color: "var(--yellow)",
    title: "Entry Context",
    bullets: [
      "S/R flips & reaction zones",
      "Break of structure confirmation",
      "Trend lines + channel",
      "Entry zone narrowed to ±10–20 pts",
    ],
  },
  {
    tf: "15M", label: "15-Min", color: "var(--green)",
    title: "Setup Confirmation",
    bullets: [
      "Micro structure & BOS/CHoCH",
      "Retest of broken S/R",
      "Volume spike areas",
      "Set TP1 (internal liq.) level",
    ],
  },
  {
    tf: "5M", label: "5-Min", color: "#ff7040",
    title: "Trigger Zone",
    bullets: [
      "Entry pattern forming",
      "Wicks into zone, pinbar, engulf",
      "Volume confirmation",
      "Final go/no-go decision + precise SL level",
    ],
  },
  {
    tf: "1M", label: "1-Min", color: "var(--text2)",
    title: "Execution",
    bullets: [
      "Trigger candle / momentum shift",
      "Limit or market entry",
      "Execute. Manage. Move on.",
    ],
  },
]

/* ─── Rule sections ──────────────────────────────────────── */
const RULE_SECTIONS = [
  {
    icon: "⚡",
    label: "Entry Criteria — 10 Confluences",
    rules: [
      { color: "var(--accent)", title: "C1 — HTF Trend Aligned", body: "Trade direction must match 1D/4H market structure. Against HTF bias = automatic skip. This is the single most important filter." },
      { color: "var(--accent)", title: "C2 — S/R Zone Hit", body: "Price must be at a meaningful support/resistance zone. PDH, PDL, weekly levels, or structural flip zones. No zone = no trade." },
      { color: "var(--green)", title: "C3 — Trend Line Touch/Break", body: "Trend line confluence adds weight to the zone. Touch of an ascending/descending trend line with rejection = strong signal." },
      { color: "var(--green)", title: "C4 — BOS / CHoCH on 5M+", body: "Break of Structure confirms trend continuation. Change of Character signals potential reversal. Require on 5M or 15M before entry." },
      { color: "var(--yellow)", title: "C5 — FVG / Imbalance Present", body: "Fair Value Gap or open imbalance at or near entry zone. Price drawn to fill imbalance — use as entry trigger or TP target." },
      { color: "var(--yellow)", title: "C6 — VWAP Confluence", body: "VWAP or anchored VWAP level aligns with entry zone. Price above AVWAP = bullish bias. Retest of AVWAP in trend = entry." },
      { color: "var(--purple)", title: "C7 — Volume Confirmation", body: "Volume spike on the break or rejection candle. High volume = institutional participation. Low volume = ignore the move." },
      { color: "var(--purple)", title: "C8 — Session Open / Close", body: "Entry during high-probability session windows (09:30–11:00, 13:30–15:30 ET). Avoid lunch chop 11:30–13:30 ET." },
      { color: "var(--red)", title: "C9 — Liquidity Sweep (SFP)", body: "Stop-hunt or sweep of obvious liquidity level followed by reversal. Smart money trapping retail — trade the rejection." },
      { color: "var(--accent)", title: "C10 — Clean Entry Pattern", body: "Pinbar/wick rejection, engulfing candle after retest, break & retest of micro trend line, or displacement candle with volume. Minimum: 3 of 10. Strong: 5+." },
    ],
  },
  {
    icon: "🛡",
    label: "Risk Management",
    rules: [
      { color: "var(--red)", title: "Position Sizing", body: "Risk $ ÷ (Entry − SL in points × Tick Value) = Contracts. Example: $500 risk ÷ (5 pts × $50/pt MES) = 2 contracts. Never guess size — always calculate." },
      { color: "var(--red)", title: "Stop Loss Rules", body: "0.5% SL: $250 — tight structure, high-confluence. 1.0% SL: $500 — wider zones, maximum allowed. Hard stop is STRUCTURAL — above/below last swing or zone. Never move wider once set." },
      { color: "var(--yellow)", title: "Daily Limits", body: "Soft limit: -$250 (0.5%) — review before continuing. Hard limit: -$500 (1%) — shut down, no exceptions. Profit target: +$500–$1,000 day — consider stopping or reducing to micro once hit." },
      { color: "var(--purple)", title: "Weekly Goal", body: "Target 1–2% gain ($500–$1,000) per week. Compounding beats swinging big. Track drawdown daily — know your distance from breach at all times." },
    ],
  },
  {
    icon: "⚠",
    label: "Kill Switches — Non-Negotiable",
    rules: [
      { color: "var(--red)", title: "Daily Loss Hit (0.5%–1%)", body: "Shut down immediately. No revenge trades. No 'one more.' Close platform, log the day, walk away. Come back tomorrow." },
      { color: "var(--red)", title: "2 Consecutive Losses", body: "Mandatory 30-minute break minimum. Step away from charts. Review what happened before the next trade." },
      { color: "var(--red)", title: "3 Consecutive Losses", body: "Done for the day. Log all three trades with honest notes. Review tomorrow with fresh eyes — not tonight." },
      { color: "var(--red)", title: "Tilt / Revenge Feeling", body: "Close platform immediately. Walk away physically. Non-negotiable. Tilt costs more than any single trade loss." },
      { color: "var(--yellow)", title: "No Setup = No Trade", body: "Boredom, FOMO, and position envy are not reasons to enter. Waiting is a position. The absence of a trade is a trade." },
    ],
  },
  {
    icon: "🎯",
    label: "Sessions & Timing",
    rules: [
      { color: "var(--text2)", title: "Pre-Market Sweep (08:00–09:30 ET)", body: "Liquidity grab setups. Mark overnight H/L and pre-market range every morning. These are institutional reference points." },
      { color: "var(--green)", title: "NYSE Open — Primary (09:30–11:30 ET)", body: "Highest priority window. Strongest volume, clearest structure breaks, most reliable setups. Max effort, best trades happen here." },
      { color: "var(--red)", title: "Lunch Chop (11:30–13:30 ET)", body: "AVOID or significantly reduce size. Volume drops, stops get run, price chops. Most overtrading losses happen here." },
      { color: "var(--yellow)", title: "PM Session (13:30–15:30 ET)", body: "Re-entry & continuation. Acceptable if clear HTF setup exists. Check for news events before entering." },
      { color: "var(--purple)", title: "Power Hour (15:30–16:00 ET)", body: "Final liquidity grabs. Can trade with HTF confirmation only. Be aware of EOD position covering — can create false moves." },
    ],
  },
  {
    icon: "📐",
    label: "Instruments & Edge Enhancers",
    rules: [
      { color: "var(--accent)", title: "Instruments", body: "Equity index futures only: MES, ES, MNQ, NQ, YM, MYM. No cross-instrument trading until NYC session mastery established." },
      { color: "var(--green)", title: "Fibonacci Levels", body: "50% = midpoint retest · 61.8% = golden ratio zone · 78% = deep retracement entry · 127%/161.8% = TP extensions. Mark before session." },
      { color: "var(--yellow)", title: "Economic Calendar Filter", body: "No trades 5 min before or after high-impact news (CPI, FOMC, NFP, etc.). Set alerts the night before. Volatility without structure = gambling." },
      { color: "var(--purple)", title: "Pre-Market Levels", body: "Mark overnight H/L, pre-market H/L, prior day OHLC every morning. Institutional reference points price gravitates toward and reacts from." },
    ],
  },
]

/* ─── Hero badges ────────────────────────────────────────── */
const HERO_BADGES = [
  { label: "Account", val: "$50K", color: "var(--accent)" },
  { label: "Daily Profit target", val: "$500–$1K", color: "var(--green)" },
  { label: "SL Risk", val: "0.5–1%", color: "var(--red)" },
  { label: "Min R:R", val: "2:1 to TP1", color: "var(--green)" },
  { label: "Execution TF", val: "1M / 3M", color: "var(--yellow)" },
  { label: "Min Confluences", val: "3 of 10", color: "var(--accent)" },
  { label: "Target", val: "+1–2%/wk", color: "var(--green)" },
]

/* ─── Rule card ──────────────────────────────────────────── */
function RuleCard({ color, title, body }: { color: string; title: string; body: string }) {
  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid var(--border)",
        borderLeft: `3px solid ${color}`,
      }}
    >
      <p className="label-upper mb-1" style={{ color }}>{title}</p>
      <p className="text-sm" style={{ color: "var(--text2)", lineHeight: "1.6" }}>{body}</p>
    </div>
  )
}

/* ─── Collapsible rule section ───────────────────────────── */
function RuleSection({ section, defaultOpen }: { section: typeof RULE_SECTIONS[0]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-3 p-4 text-left">
        <span className="text-base">{section.icon}</span>
        <span className="flex-1 text-sm font-medium" style={{ color: "var(--text)" }}>{section.label}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease", flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="pt-3 space-y-2">
            {section.rules.map(rule => (
              <RuleCard key={rule.title} color={rule.color} title={rule.title} body={rule.body} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Main component ─────────────────────────────────────── */
export default function StrategyTab() {
  return (
    <div className="p-4 space-y-3">

      {/* Hero */}
      <div
        className="glass-accent rounded-2xl p-4 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, rgba(255,107,26,0.08) 0%, rgba(168,85,247,0.05) 100%)" }}
      >
        <h2 className="mono text-lg font-semibold mb-1" style={{ color: "var(--text)" }}>SMC Confluence System</h2>
        <p className="text-sm mb-3" style={{ color: "var(--text2)", lineHeight: 1.6 }}>
          Disciplined intraday futures trading — top-down structure, institutional liquidity targeting, and strict capital preservation on a $50K prop account.
        </p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {HERO_BADGES.map(b => (
            <div key={b.label} className="mono text-xs px-2 py-1 rounded" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)" }}>
              <span style={{ color: "var(--text3)" }}>{b.label} </span>
              <span style={{ color: b.color, fontWeight: 600 }}>{b.val}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, padding: '6px 12px', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, display: 'inline-block' }}>
          <span style={{ color: 'var(--text2)', fontSize: 11 }}>💬 Your trading rules are automatically read by the AI Coach — edit them in the Coach tab</span>
        </div>
      </div>

      {/* TF Ladder */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="label-upper">Top-Down Analysis</p>
        </div>
        <div>
          {TF_LADDER.map((tf, i) => (
            <div
              key={tf.tf}
              className="flex items-stretch"
              style={{ borderBottom: i < TF_LADDER.length - 1 ? "1px solid var(--border)" : "none" }}
            >
              <div
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: 52,
                  background: tf.color + "18",
                  borderRight: "1px solid var(--border)",
                }}
              >
                <span className="mono text-sm font-semibold" style={{ color: tf.color }}>{tf.tf}</span>
              </div>
              <div className="px-3 py-2.5 flex-1">
                <p className="label-upper mb-1">{tf.title}</p>
                <ul className="space-y-0.5">
                  {tf.bullets.map(b => (
                    <li key={b} className="text-xs" style={{ color: "var(--text2)", lineHeight: 1.7 }}>· {b}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Liquidity Targeting */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="label-upper">Liquidity Targeting</p>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex flex-col gap-2" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

            {/* External Liquidity */}
            <div
              className="rounded-xl p-3"
              style={{
                background: "rgba(0,229,160,0.04)",
                border: "1px solid var(--border)",
                borderLeft: "3px solid var(--green)",
              }}
            >
              <p className="label-upper mb-2" style={{ color: "var(--green)" }}>External Liquidity — TP2 / Runner</p>
              <ul className="space-y-1">
                {[
                  "Previous day's high / low",
                  "Weekly high / low",
                  "HTF swing high / low",
                  "Equal highs / lows (buy-side / sell-side liq.)",
                  "Psychological round numbers (5000, 4500, etc.)",
                  "Monthly open / quarterly level",
                ].map(item => (
                  <li key={item} className="text-xs" style={{ color: "var(--text2)", lineHeight: 1.7 }}>· {item}</li>
                ))}
              </ul>
            </div>

            {/* Internal Liquidity */}
            <div
              className="rounded-xl p-3"
              style={{
                background: "rgba(255,208,96,0.04)",
                border: "1px solid var(--border)",
                borderLeft: "3px solid var(--yellow)",
              }}
            >
              <p className="label-upper mb-2" style={{ color: "var(--yellow)" }}>Internal Liquidity — TP1 / Scale</p>
              <ul className="space-y-1">
                {[
                  "Fair Value Gaps (FVG) on 5M/15M",
                  "Imbalance zones mid-range",
                  "Recent swing high/low within range",
                  "VWAP / anchored VWAP",
                  "Volume profile POC",
                  "Previous day's close",
                ].map(item => (
                  <li key={item} className="text-xs" style={{ color: "var(--text2)", lineHeight: 1.7 }}>· {item}</li>
                ))}
              </ul>
            </div>

          </div>

          {/* Scale-Out Protocol */}
          <div
            className="rounded-xl p-3"
            style={{
              background: "rgba(0,229,160,0.04)",
              border: "1px solid var(--border)",
              borderLeft: "3px solid var(--green)",
            }}
          >
            <p className="label-upper mb-1" style={{ color: "var(--green)" }}>Scale-Out Protocol</p>
            <p className="text-sm" style={{ color: "var(--text2)", lineHeight: "1.6" }}>
              TP1 (50%) = First internal liquidity. Move SL to breakeven. TP2 (25%) = Next internal or external. Trail remaining. Runner (25%) = Let breathe to external liquidity or trail 3–5 pt stop. Minimum 2:1 R:R to TP1 required.
            </p>
          </div>
        </div>
      </div>

      {/* Rule sections */}
      {RULE_SECTIONS.map((section, i) => (
        <RuleSection key={section.label} section={section} defaultOpen={i === 0} />
      ))}

    </div>
  )
}
