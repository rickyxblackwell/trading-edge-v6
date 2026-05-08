"use client"

import { useState } from "react"
import type { Trade } from "../lib/types"

/* ─── Shared helpers ────────────────────────────────────────── */
export function genId() { return crypto.randomUUID() }

export const INSTRUMENTS = ["NQ", "MNQ", "ES", "MES", "RTY", "YM", "CL", "GC"]
export const SESSIONS = ["Asia", "London", "NY AM", "NY PM", "Afternoon"]
export const CONFLUENCES = [
  "HTF alignment", "Kill zone", "POI tap", "FVG fill", "OB entry",
  "Liquidity sweep", "Break of structure", "VWAP reclaim", "News catalyst",
]

export function outcomeColor(o: string) {
  if (o === "win") return "var(--green)"
  if (o === "loss") return "var(--red)"
  return "var(--yellow)"
}

const inputCls = "w-full rounded-lg px-3 py-2 text-sm mono outline-none transition-colors duration-150"
const inputStyle = { background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", color: "var(--text)" }

function makeEmpty() {
  return {
    date: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}` })(),
    time: new Date().toTimeString().slice(0, 5),
    instrument: "NQ" as string,
    direction: "long" as "long" | "short",
    session: "NY AM" as string,
    contracts: "" as string | number,
    pnl: "" as string | number,
    rmult: "" as string | number,
    outcome: "win" as "win" | "loss" | "breakeven",
    confluences: [] as string[],
    notes: "",
  }
}

/* ─── Field wrapper — defined outside TradeForm to keep stable identity across renders ─── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="label-upper mb-1.5">{label}</p>{children}</div>
}

/* ─── Trade entry form (shared) ─────────────────────────────── */
export function TradeForm({ onSubmit, onCancel }: {
  onSubmit: (t: Trade) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState(makeEmpty)
  const [pnlError, setPnlError] = useState<string | null>(null)
  const [rmultError, setRmultError] = useState<string | null>(null)
  const set = (k: keyof ReturnType<typeof makeEmpty>, v: unknown) =>
    setForm(p => ({ ...p, [k]: v }))

  const toggleConf = (c: string) => setForm(p => ({
    ...p,
    confluences: p.confluences.includes(c)
      ? p.confluences.filter(x => x !== c)
      : [...p.confluences, c],
  }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const pnlNum = Number(form.pnl)
    const rmultNum = Number(form.rmult)
    if (isNaN(pnlNum)) { setPnlError("Enter a valid number"); return }
    if (isNaN(rmultNum)) { setRmultError("Enter a valid number"); return }
    onSubmit({
      id: genId(),
      date: form.date, time: form.time,
      instrument: form.instrument,
      direction: form.direction,
      session: form.session,
      contracts: Number(form.contracts),
      pnl: pnlNum,
      rmult: rmultNum,
      outcome: form.outcome,
      confluences: form.confluences,
      notes: form.notes,
    })
    setForm(makeEmpty())
    setPnlError(null)
    setRmultError(null)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <input type="date" value={form.date} onChange={e => set("date", e.target.value)}
            className={inputCls} style={inputStyle} required />
        </Field>
        <Field label="Time">
          <input type="time" value={form.time} onChange={e => set("time", e.target.value)}
            className={inputCls} style={inputStyle} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Instrument">
          <select value={form.instrument} onChange={e => set("instrument", e.target.value)}
            className={inputCls} style={inputStyle}>
            {INSTRUMENTS.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </Field>
        <Field label="Session">
          <select value={form.session} onChange={e => set("session", e.target.value)}
            className={inputCls} style={inputStyle}>
            {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Direction">
        <div className="flex gap-2">
          {(["long", "short"] as const).map(d => (
            <button key={d} type="button" onClick={() => set("direction", d)}
              className="flex-1 py-2 rounded-lg mono text-sm font-semibold transition-colors duration-150"
              style={{
                color: form.direction === d ? "var(--bg)" : "var(--text2)",
                background: form.direction === d
                  ? (d === "long" ? "var(--green)" : "var(--red)")
                  : "rgba(255,255,255,0.04)",
                border: `1px solid ${form.direction === d ? "transparent" : "var(--border)"}`,
              }}>
              {d === "long" ? "▲ LONG" : "▼ SHORT"}
            </button>
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Contracts">
          <input type="text" inputMode="numeric" placeholder="1" value={form.contracts}
            onChange={e => set("contracts", e.target.value)} className={inputCls} style={inputStyle} />
        </Field>
        <Field label="P&amp;L ($)">
          <input type="text" inputMode="decimal" placeholder="±0.00" value={form.pnl}
            onChange={e => { set("pnl", e.target.value); setPnlError(null) }} className={inputCls} style={inputStyle} required />
          {pnlError && (
            <p className="mono text-xs mt-1" style={{ color: "var(--red)" }}>{pnlError}</p>
          )}
        </Field>
        <Field label="R-Mult">
          <input type="text" inputMode="decimal" placeholder="±0.0" value={form.rmult}
            onChange={e => { set("rmult", e.target.value); setRmultError(null) }} className={inputCls} style={inputStyle} />
          {rmultError && (
            <p className="mono text-xs mt-1" style={{ color: "var(--red)" }}>{rmultError}</p>
          )}
        </Field>
      </div>
      <Field label="Outcome">
        <div className="flex gap-2">
          {(["win", "loss", "breakeven"] as const).map(o => (
            <button key={o} type="button" onClick={() => set("outcome", o)}
              className="flex-1 py-2 rounded-lg mono text-xs font-semibold capitalize transition-colors duration-150"
              style={{
                color: form.outcome === o ? "var(--bg)" : "var(--text2)",
                background: form.outcome === o ? outcomeColor(o) : "rgba(255,255,255,0.04)",
                border: `1px solid ${form.outcome === o ? "transparent" : "var(--border)"}`,
              }}>
              {o}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Confluences">
        <div className="flex flex-wrap gap-1.5">
          {CONFLUENCES.map(c => (
            <button key={c} type="button" onClick={() => toggleConf(c)}
              className="mono text-xs px-2.5 py-1 rounded-full transition-colors duration-150"
              style={{
                color: form.confluences.includes(c) ? "var(--accent)" : "var(--text2)",
                background: form.confluences.includes(c) ? "var(--accent3)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${form.confluences.includes(c) ? "var(--border-accent)" : "var(--border)"}`,
              }}>
              {c}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Notes">
        <textarea rows={3}
          placeholder="What happened? Execution quality, emotional state, market context…"
          value={form.notes} onChange={e => set("notes", e.target.value)}
          className={inputCls + " resize-none"} style={{ ...inputStyle, lineHeight: "1.5" }} />
      </Field>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl mono text-sm transition-colors duration-150"
          style={{ border: "1px solid var(--border)", color: "var(--text2)" }}>
          Cancel
        </button>
        <button type="submit"
          className="btn-accent flex-1 py-2.5 rounded-xl mono text-sm font-semibold"
          style={{ color: "var(--bg)" }}>
          LOG TRADE
        </button>
      </div>
    </form>
  )
}
