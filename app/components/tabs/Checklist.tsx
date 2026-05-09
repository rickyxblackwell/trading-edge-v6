"use client"

import { useState } from "react"

/* ─── Data ────────────────────────────────────────────────── */
const GROUPS = [
  {
    id: "preMarket",
    label: "Pre-Market Prep",
    tab: "entry" as const,
    items: [
      { id: "pm1", label: "1D chart reviewed — bias set (Long / Short / Neutral)" },
      { id: "pm2", label: "4H + 1H structure mapped — swing H/L identified" },
      { id: "pm3", label: "Key S/R levels drawn — PDH, PDL, PWH, PWL, psych levels" },
      { id: "pm4", label: "Overnight high/low + pre-market range marked" },
      { id: "pm5", label: "Economic calendar checked — no news mines in session", note: "Forexfactory / CME economic calendar" },
      { id: "pm6", label: "Daily loss limit calculated and noted", note: "1% = $500 · 2% = $1,000" },
      { id: "pm7", label: "Instrument selected — equity index futures only (MES/ES/MNQ/NQ/YM/MYM)" },
    ],
  },
  {
    id: "preEntry",
    label: "Pre-Entry",
    tab: "entry" as const,
    items: [
      { id: "pe1", label: "HTF bias confirmed — setup aligns with 1H+ direction" },
      { id: "pe2", label: "Entry zone identified — S/R flip or FVG confirmed" },
      { id: "pe3", label: "BOS or CHoCH confirmed on execution TF" },
      { id: "pe4", label: "SL level defined and sized (max 0.5–1% risk)" },
      { id: "pe5", label: "TP1 / TP2 defined — internal then external liquidity" },
      { id: "pe6", label: "Min 3 confluences checked below" },
    ],
  },
  {
    id: "tradeManagement",
    label: "Trade Management",
    tab: "exit" as const,
    items: [
      { id: "tm1", label: "Entry executed at planned level — no chasing" },
      { id: "tm2", label: "SL placed immediately after entry" },
      { id: "tm3", label: "Scaled 50% at TP1, SL moved to BE" },
      { id: "tm4", label: "25% at TP2, 25% runner active" },
      { id: "tm5", label: "Not watching tick-by-tick — set and step back" },
    ],
  },
  {
    id: "postTrade",
    label: "Post-Trade Review",
    tab: "exit" as const,
    items: [
      { id: "pt1", label: "Trade logged in Journal tab" },
      { id: "pt2", label: "Screenshot taken of entry and exit" },
      { id: "pt3", label: "What went right / what went wrong noted" },
      { id: "pt4", label: "Daily P&L still within loss limit?" },
      { id: "pt5", label: "Emotional state logged (1–10 clarity)" },
    ],
  },
]

const CONFLUENCES = [
  "C1 HTF Aligned", "C2 S/R Zone", "C3 Trend Line", "C4 BOS/CHoCH",
  "C5 FVG/Imbal.", "C6 VWAP", "C7 Volume", "C8 Session Time",
  "C9 Liq. Sweep", "C10 Entry Pattern",
]

const SESSION_KEY = "edge_v5_checklist"
const CONF_KEY = "edge_v5_confluences"

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}

function save(key: string, val: unknown) {
  try { sessionStorage.setItem(key, JSON.stringify(val)) } catch {}
}

/* ─── Readiness gauge ─────────────────────────────────────── */
const READINESS_GROUP_IDS = ["preMarket", "preEntry"]

function Gauge({ checked, onReset }: { checked: Set<string>; onReset: () => void }) {
  const r = 44
  const circ = 2 * Math.PI * r
  const readinessItems = GROUPS.filter(g => READINESS_GROUP_IDS.includes(g.id)).flatMap(g => g.items)
  const done = readinessItems.filter(i => checked.has(i.id)).length
  const total = readinessItems.length
  const score = total > 0 ? (done / total) * 100 : 0
  const filled = (score / 100) * circ
  const color = score >= 75 ? "var(--green)" : score >= 50 ? "var(--yellow)" : "var(--red)"
  const label = score >= 75 ? "TRADE READY" : score >= 50 ? "CAUTION" : "NOT READY"

  return (
    <div className="glass rounded-2xl p-4 flex flex-col items-center gap-2">
      <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <span className="label-upper">Readiness</span>
        <button
          onClick={onReset}
          className="mono text-xs px-2.5 py-1 rounded-lg"
          style={{ border: "1px solid var(--border)", color: "var(--text3)" }}
        >
          Reset All
        </button>
      </div>
      <div className="relative" style={{ width: 110, height: 110 }}>
        <svg width="110" height="110" viewBox="0 0 110 110" style={{ position: "absolute", top: 0, left: 0 }}>
          <circle cx="55" cy="55" r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
          <circle cx="55" cy="55" r={r} fill="none" stroke="var(--yellow)" strokeWidth="2"
            strokeDasharray={`2 ${circ}`} strokeDashoffset={-(circ * 0.5 - 1)} opacity="0.5" />
          <circle cx="55" cy="55" r={r} fill="none" stroke="var(--accent)" strokeWidth="2"
            strokeDasharray={`2 ${circ}`} strokeDashoffset={-(circ * 0.75 - 1)} opacity="0.5" />
        </svg>
        <svg width="110" height="110" viewBox="0 0 110 110" style={{ position: "absolute", top: 0, left: 0, transform: "rotate(-90deg)" }}>
          <circle
            cx="55" cy="55" r={r} fill="none"
            stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ - filled}
            style={{ transition: "stroke-dashoffset 0.4s ease, stroke 0.4s ease" }}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span className="mono font-semibold" style={{ fontSize: "1.4rem", color, lineHeight: 1 }}>{Math.round(score)}%</span>
          <span className="label-upper" style={{ marginTop: 2 }}>Ready</span>
        </div>
      </div>
      <span className="mono text-sm font-semibold" style={{ color }}>{label}</span>
      <span className="text-xs" style={{ color: "var(--text2)" }}>
        {done}/{total} pre-trade conditions met
      </span>
    </div>
  )
}

/* ─── Check group ─────────────────────────────────────────── */
function CheckGroup({
  group, checked, onToggle, open, onToggleOpen,
}: {
  group: typeof GROUPS[0]
  checked: Set<string>
  onToggle: (id: string) => void
  open: boolean
  onToggleOpen: () => void
}) {
  const done = group.items.filter(i => checked.has(i.id)).length
  return (
    <div className="glass rounded-xl overflow-hidden">
      <button
        onClick={onToggleOpen}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{group.label}</span>
        <div className="flex items-center gap-2">
          <span className="mono text-xs" style={{ color: done === group.items.length ? "var(--green)" : "var(--text3)" }}>
            <span style={{ color: done > 0 ? "var(--accent)" : "var(--text3)" }}>{done}</span>/{group.items.length}
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round"
            style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease", flexShrink: 0 }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>
      {open && (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          {group.items.map((item) => (
            <button
              key={item.id}
              onClick={() => onToggle(item.id)}
              className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors duration-150"
              style={{
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                background: checked.has(item.id) ? "rgba(0,229,160,0.04)" : "transparent",
              }}
            >
              <span
                className="flex-shrink-0 flex items-center justify-center rounded"
                style={{
                  width: 18, height: 18, marginTop: 1,
                  background: checked.has(item.id) ? "var(--green)" : "transparent",
                  border: `1px solid ${checked.has(item.id) ? "var(--green)" : "var(--border)"}`,
                  boxShadow: checked.has(item.id) ? "0 0 8px rgba(0,229,160,0.4)" : "none",
                  transition: "all 0.15s",
                }}
              >
                {checked.has(item.id) && (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <polyline points="2,6 5,9 10,3" stroke="var(--bg)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <div>
                <p className="text-sm" style={{ color: checked.has(item.id) ? "var(--text2)" : "var(--text)", lineHeight: 1.5 }}>
                  {item.label}
                </p>
                {"note" in item && item.note && (
                  <p className="mono text-xs mt-0.5" style={{ color: "var(--text3)" }}>{item.note}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Confluence counter ──────────────────────────────────── */
function ConfluenceCounter({ confs, onToggle, onReset }: {
  confs: Set<number>
  onToggle: (i: number) => void
  onReset: () => void
}) {
  const count = confs.size
  const verdictColor = count >= 5 ? "var(--green)" : count >= 3 ? "var(--yellow)" : "var(--red)"
  const verdictText = count >= 5 ? "TRADE READY" : count >= 3 ? "CAUTION" : "DO NOT ENTER"
  const verdictBg = count >= 5 ? "rgba(0,229,160,0.08)" : count >= 3 ? "rgba(255,208,96,0.08)" : "rgba(255,61,90,0.08)"
  const verdictBorder = count >= 5 ? "rgba(0,229,160,0.4)" : count >= 3 ? "rgba(255,208,96,0.4)" : "rgba(255,61,90,0.4)"

  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="label-upper">Confluence Counter</p>
        <button onClick={onReset} className="mono text-xs px-2 py-1 rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text3)" }}>
          Reset
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {CONFLUENCES.map((label, i) => {
          const sel = confs.has(i)
          return (
            <button
              key={i}
              onClick={() => onToggle(i)}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors duration-150"
              style={{
                background: sel ? "rgba(255,107,26,0.08)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${sel ? "var(--border-accent)" : "var(--border)"}`,
              }}
            >
              <span
                className="flex-shrink-0 rounded"
                style={{
                  width: 14, height: 14,
                  background: sel ? "var(--accent)" : "transparent",
                  border: `1px solid ${sel ? "var(--accent)" : "var(--border)"}`,
                  transition: "all 0.15s",
                }}
              />
              <span className="mono text-xs" style={{ color: sel ? "var(--accent)" : "var(--text2)" }}>{label}</span>
            </button>
          )
        })}
      </div>

      <div
        className="rounded-xl p-3 text-center"
        style={{
          background: verdictBg,
          border: `1px solid ${verdictBorder}`,
          boxShadow: count >= 5 ? "0 0 16px rgba(0,229,160,0.15)" : "none",
          transition: "all 0.3s",
        }}
      >
        <p className="mono text-2xl font-semibold" style={{ color: verdictColor }}>{count}/10</p>
        <p className="label-upper mt-0.5" style={{ color: verdictColor }}>{verdictText}</p>
        <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${(count / 10) * 100}%`,
              background: verdictColor,
              transition: "width 0.3s ease, background 0.3s ease",
            }}
          />
        </div>
      </div>
    </div>
  )
}

/* ─── Main component ──────────────────────────────────────── */
export default function ChecklistTab() {
  const [checked, setChecked] = useState<Set<string>>(() => new Set(load<string[]>(SESSION_KEY, [])))
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(["preMarket", "tradeManagement"]))
  const [confs, setConfs] = useState<Set<number>>(() => new Set(load<number[]>(CONF_KEY, [])))
  const [view, setView] = useState<"entry" | "exit">("entry")

  const toggle = (id: string) => setChecked(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    save(SESSION_KEY, [...next])
    return next
  })

  const toggleGroup = (id: string) => setOpenGroups(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const toggleConf = (i: number) => setConfs(prev => {
    const next = new Set(prev)
    next.has(i) ? next.delete(i) : next.add(i)
    save(CONF_KEY, [...next])
    return next
  })

  const resetAll = () => {
    setChecked(new Set())
    save(SESSION_KEY, [])
  }

  const entryGroups = GROUPS.filter(g => g.tab === "entry")
  const exitGroups = GROUPS.filter(g => g.tab === "exit")

  return (
    <div className="px-4 pb-4 space-y-3">
      {/* Tab switcher */}
      <div className="flex justify-center px-1">
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
              transform: view === "entry" ? "translateX(0%)" : "translateX(100%)",
              transition: "transform 0.2s ease",
            }}
          />
          <button
            onClick={() => setView("entry")}
            className="relative z-10 flex flex-1 items-center justify-center mono text-xs py-1.5 px-6 min-w-[80px]"
            style={{ color: view === "entry" ? "var(--accent)" : "var(--text3)", transition: "color 0.2s ease" }}
          >
            Entry
          </button>
          <button
            onClick={() => setView("exit")}
            className="relative z-10 flex flex-1 items-center justify-center mono text-xs py-1.5 px-6 min-w-[80px]"
            style={{ color: view === "exit" ? "var(--accent)" : "var(--text3)", transition: "color 0.2s ease" }}
          >
            Exit
          </button>
        </div>
      </div>

      {view === "entry" ? (
        <>
          <Gauge checked={checked} onReset={resetAll} />
          {entryGroups.map(group => (
            <CheckGroup
              key={group.id}
              group={group}
              checked={checked}
              onToggle={toggle}
              open={openGroups.has(group.id)}
              onToggleOpen={() => toggleGroup(group.id)}
            />
          ))}
          <ConfluenceCounter confs={confs} onToggle={toggleConf} onReset={() => { setConfs(new Set()); save(CONF_KEY, []) }} />
        </>
      ) : (
        <>
          {exitGroups.map(group => (
            <CheckGroup
              key={group.id}
              group={group}
              checked={checked}
              onToggle={toggle}
              open={openGroups.has(group.id)}
              onToggleOpen={() => toggleGroup(group.id)}
            />
          ))}
        </>
      )}
    </div>
  )
}
