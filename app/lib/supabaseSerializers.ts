import type { Trade, CoachingEntry } from "./types"

// Trade has no camelCase fields → row shape adds user_id, otherwise identical.
export function tradeToRow(t: Trade, userId: string) {
  return {
    id: t.id,
    user_id: userId,
    date: t.date,
    time: t.time,
    instrument: t.instrument,
    direction: t.direction,
    session: t.session,
    contracts: t.contracts,
    pnl: t.pnl,
    rmult: t.rmult,
    outcome: t.outcome,
    confluences: t.confluences,
    notes: t.notes,
  }
}

export function rowToTrade(row: Record<string, unknown>): Trade {
  return {
    id: row.id as string,
    date: row.date as string,
    time: row.time as string,
    instrument: row.instrument as string,
    direction: row.direction as "long" | "short",
    session: row.session as string,
    contracts: row.contracts as number,
    pnl: row.pnl as number,
    rmult: row.rmult as number,
    outcome: row.outcome as "win" | "loss" | "breakeven",
    confluences: row.confluences as string[],
    notes: row.notes as string,
  }
}

// CoachingEntry has tradeCount/fullContent/marketSnapshot — explicit remap required.
export function coachingEntryToRow(e: CoachingEntry, userId: string) {
  return {
    id: e.id,
    user_id: userId,
    timestamp: e.timestamp,
    trade_count: e.tradeCount,
    title: e.title,
    full_content: e.fullContent,
    archived: e.archived,
    mode: e.mode,
    market_snapshot: e.marketSnapshot,
    patterns: e.patterns,
    process: e.process,
    risk: e.risk,
    priority: e.priority,
    momentum: e.momentum,
  }
}

export function rowToCoachingEntry(row: Record<string, unknown>): CoachingEntry {
  return {
    id: row.id as string,
    timestamp: row.timestamp as string,
    tradeCount: row.trade_count as number,
    title: row.title as string,
    fullContent: row.full_content as string,
    archived: row.archived as boolean,
    mode: row.mode as CoachingEntry["mode"],
    marketSnapshot: row.market_snapshot as string,
    patterns: row.patterns as string,
    process: row.process as string,
    risk: row.risk as string,
    priority: row.priority as string,
    momentum: row.momentum as string,
  }
}
