# Phase 6 Context: AI Coach Enhancement — 3-API Infrastructure & Memory

## Phase Summary

Upgrade the AI coach from a single-API (Gemini-only) system to a purpose-built 3-API infrastructure. Add 5 persistent per-user memory layers to enable the coach to recall past patterns, violations, milestones, and streaks across sessions.

## Locked Decisions

### API Routing Split (D-01)

**Priority order: Claude → Gemini (search only) → Yahoo Finance**

Claude generates ALL user-facing responses. Gemini is a search-only intermediary (never returns text to the user). Yahoo Finance provides tick data/prices for all modes.

| Mode | Claude | Gemini | Yahoo Finance |
|------|--------|--------|---------------|
| Chat | ✅ Final response | — | ✅ Market snapshot in context |
| Analyze | ✅ Final response | — | ✅ Market snapshot in context |
| Market Pulse | ✅ Final response | ✅ Web search → feeds Claude | ✅ Live prices |
| Strategy Review | ✅ Final response | ✅ Web search → feeds Claude | ✅ Market snapshot in context |

**Execution pattern for modes with Gemini:**
1. Yahoo Finance: fetch live market snapshot (always first, synchronous)
2. Gemini: fire Google Search query, collect web research summary (under 150 words)
3. Claude: receives Yahoo Finance data + Gemini web findings + user context → generates final response

**Graceful degradation:** if Gemini call fails or returns empty, Claude proceeds with Yahoo Finance + trade context only. Never block on Gemini failure.

**Gemini query strings:**
- Market Pulse: `"Futures market news and key events today for ES NQ YM traders — under 150 words, key facts only"`
- Strategy Review: `"Current best practices and pitfalls for SMC/ICT S/R confluence futures trading 2025 — under 150 words, actionable insights only"`

Claude model: `claude-sonnet-4-6`
Gemini model: `gemini-2.5-flash` (search tool only, never user-facing)

### Claude API Key (D-02)
- Stored in Supabase `user_metadata` as `claude_api_key` (same pattern as existing `gemini_api_key`)
- Input field added in Account tab alongside Gemini key field
- Server-side only — never returned to client
- Both keys required: Claude for analyze/chat, Gemini for market-pulse/strategy-review
- If Claude key missing: return 403 with "No Claude API key configured. Add one in Account Settings."
- If Gemini key missing: return 403 with "No Gemini API key configured. Add one in Account Settings." (existing behavior)

### API Architecture (D-03)
- Single `/api/coach` route handles all modes — adds `model_provider` to route logic only
- No new route files; routing via `if (mode === "analyze" || mode === "chat")` inside existing route
- Claude model: `claude-sonnet-4-6` (latest Sonnet)
- Gemini model: `gemini-2.5-flash` (unchanged)

### Yahoo Finance Integration (D-04)
- `fetchFuturesSnapshot(watchlistSymbols)` already implemented — no changes needed to marketData.ts
- Fed into BOTH Claude system context AND Gemini system context (already done for Gemini)
- Claude system context receives same `MARKET SNAPSHOT` section as Gemini currently does

### Memory Features (D-05)
All 5 memory features are stored in Supabase `user_metadata` (fire-and-forget, same pattern as `pattern_summary`). No new DB tables. All scoped per authenticated user.

**1. Session Index (MEM-01)**
- What: Rolling index of last 50 session titles + timestamps + modes
- Storage: `user_metadata.session_index` — JSON array `[{title, timestamp, mode, momentumLabel}]`
- Updated: After every coaching session that produces a title
- Used in: System context — "Past session titles (newest first): ..." — gives AI awareness of conversation history arc
- NOT a recall-by-tag system; titles are context hints, not query keys

**2. Behavior Ledger (MEM-02)**
- What: Running tally of rule violation counts by category
- Categories: `lunchChop` (trading during 11:30–13:30), `overtrading` (>3 trades/session), `revengeTrade`, `noSetup`, `skippedBreak`, `positionSizing`, `dailyLimitBreached`
- Storage: `user_metadata.behavior_ledger` — JSON `{lunchChop: 3, overtrading: 7, ...}`
- Updated: After each Analyze run — Claude extracts violations from trade notes/sessions and increments counts
- Extraction: Claude returns `VIOLATIONS: category1, category2` marker at end of Analyze response; route parses and increments
- Used in: Every Analyze system context — "Behavior ledger (all-time violations): ..."

**3. Milestone Log (MEM-03)**
- What: Record of significant first-time achievements
- Milestones tracked: `firstProfitableDay`, `firstWinStreak3`, `firstWinStreak5`, `bestRSession` (value), `bestDayPnl` (value), `lowestDrawdown` (value)
- Storage: `user_metadata.milestone_log` — JSON `{firstProfitableDay: "2025-01-15", bestRSession: 4.2, ...}`
- Updated: After each Analyze run — route checks current trade data against stored milestones, updates if new record
- Used in: Analyze system context — "Milestones: First profitable day achieved 2025-01-15, Best R session: 4.2R"

**4. Weakness Profile (MEM-04)**
- What: Top-3 failure modes derived from behavior ledger + trade patterns
- Format: Ordered list of the 3 highest-count behavior ledger categories
- Computed: Derived at query time from `behavior_ledger` (not stored separately)
- Used in: Every Analyze AND Chat system context — "Top weaknesses: 1. Overtrading (7x) 2. Lunch chop violations (3x) 3. ..."

**5. Streak Tracking (MEM-05)**
- What: Win streak, loss streak, rule-adherent day streak
- Storage: `user_metadata.streaks` — JSON `{currentWin: 3, currentLoss: 0, longestWin: 5, longestLoss: 4, ruleAdherentDays: 2, longestRuleAdherent: 8}`
- Updated: After each Analyze run — route calculates from most recent trades
- Displayed: In Coach UI memory section (below watchlist display)
- Used in: Analyze system context — "Current streaks: 3-win streak | Best: 5-win | Rule-adherent days: 2"

### Watchlist (D-06) — Already implemented
- `watchlist` in `user_metadata` via TradesContext — no changes needed
- `parseWatchlistIntent()` in Coach.tsx — no changes needed
- `fetchFuturesSnapshot(watchlistSymbols)` in marketData.ts — no changes needed

### History Filtering (D-07) — Already implemented
- `isWatchlistSession()` filter in Coach.tsx — no changes needed

### VIOLATIONS Marker Parsing (D-08)
- Format at end of Analyze response: `VIOLATIONS: category1, category2` (plain text, no markdown)
- Categories must match known keys in behavior ledger
- Route strips VIOLATIONS line from displayed reply (same pattern as TITLE, MOMENTUM)
- If no violations detected, Claude outputs `VIOLATIONS: none`

### UI Changes (D-09)
- Account tab: Add "Claude API Key" field below existing Gemini key field — same styling
- Coach tab memory section: Add streak display below watchlist line
- No other UI changes; routing is transparent to user

### Supabase Storage Pattern (D-10)
- All new memory fields (`session_index`, `behavior_ledger`, `milestone_log`, `streaks`) stored in `user_metadata` via `supabase.auth.updateUser({ data: {...} })`
- Fire-and-forget (no rollback needed — regenerable data)
- Loaded in TradesContext alongside existing `pattern_summary` and `strategy_text` reads from `user_metadata`
- Exposed via TradesContext: `sessionIndex`, `behaviorLedger`, `milestoneLog`, `streaks` state + updaters

### Tiered Journal Memory (D-11)

Three rolling text buffers storing compact trade entries, sampled at different intervals for short/medium/long-term recall. Stored as a single `JournalMemory` object in `user_metadata.journal_memory`.

**Compact line format per trade:**
`DATE | INSTRUMENT DIRECTION | SESSION | ±$PNL | RR | OUTCOME | C1,C4,C7 | notes (truncated to 40 chars)`
Example: `2025-01-15 | ES LONG | NYSE | +$250 | 2.5R | WIN | C1,C4,C7 | clean setup at PDH`

**Three tiers:**
- `shortTerm`: Every trade logged, last 100 entries (densest — full recent history)
- `mediumTerm`: Every 5th trade, last 100 entries (represents ~500 trades of history)
- `longTerm`: Every 10th trade, last 200 entries (represents ~2000 trades of history)

**Counter design:**
- `mediumCounter` (0–4): increments on each trade; when it reaches 5, add line to mediumTerm and reset to 0
- `longCounter` (0–9): increments on each trade; when it reaches 10, add line to longTerm and reset to 0
- Counters stored as fields of `JournalMemory`, not separately

**Update location:** Inside `addTrade` in TradesContext — functional `setJournalMemory` call appends new line before Supabase insert. Fire-and-forget persist to `user_metadata.journal_memory`.

**Hydration:** Loaded in `fetchFromSupabase` from `user_metadata.journal_memory` alongside other memory fields.

**AI context injection (route.ts):**
- `analyze` mode: inject all 3 tiers into Claude system context
- `chat` mode: inject `shortTerm` only (quick context, token-efficient)
- `market-pulse` / `strategy-review`: no journal (market context, not trade history)
- Sections only included when non-empty

**Token budget estimate:**
- Short (100 lines × ~100 chars): ~10KB — acceptable for analyze
- Medium (100 lines × ~100 chars): ~10KB — acceptable for analyze
- Long (200 lines × ~100 chars): ~20KB — included only in analyze

**TypeScript type:**
```typescript
export interface JournalMemory {
  shortTerm: string      // newline-separated compact lines, newest first
  mediumTerm: string     // newline-separated compact lines, newest first
  longTerm: string       // newline-separated compact lines, newest first
  mediumCounter: number  // 0–4: trades since last medium sample
  longCounter: number    // 0–9: trades since last long sample
}
```

### Semantic Recall — Temporal-Sampled Full History (D-12)

**What:** Full coaching history sampled into up to ~36 entries spanning the user's entire arc — first-ever session through the most recent 20. No rolling buffer, no cap. Claude can reference the user's first message after a year of use.

**Why not a rolling buffer:** A fixed-size buffer loses sessions older than a few weeks for active users. Semantic recall should cover the full arc.

**Why not pgvector:** No extra infrastructure. `coachingHistory` is already fully loaded from Supabase in TradesContext and available in Coach.tsx. Client-side selection runs in <1ms.

**Selection algorithm** (`buildCoachingContextSelection` — added at module level in Coach.tsx):
- ≤20 sessions: all sent
- >20 sessions: first 1 (anchor) + up to 15 evenly sampled from middle + last 20 (recent)
- = up to 36 entries total, each truncated to 300 chars of content
- Year of use (365 sessions): 1 + 15 + 20 = 36; middle sampled ~every 23rd session

**Body field:** `coachingContextFull` — compact array `{title, timestamp, mode, content}[]` computed in Coach.tsx before each fetch. Sent for analyze, chat, strategy-review. Omitted for market-pulse.

**No new storage.** No user_metadata fields. No new TradesContext state. No updaters. Uses existing `coachingHistory` from Supabase.

**Selection function** (Coach.tsx module level):
```typescript
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
```

**AI context section header:** `COACHING HISTORY (full arc — first session + sampled + recent ${N}):`

### Weekly / Monthly Auto-Summaries (D-13)

**What:** Compact programmatic summaries of trading performance by week and month, auto-generated from the trades array during each Analyze call. No extra AI call — computed deterministically from raw data.

**Weekly summary format:** `{weekOf: "2025-01-13", trades: 8, pnl: 420, winRate: 62, topSession: "NYSE", topViolation: "lunchChop"}`

**Monthly summary format:** `{monthOf: "2025-01", trades: 34, pnl: 1840, winRate: 58, bestWeek: "2025-01-13", worstWeek: "2025-01-27"}`

**Storage:**
- `user_metadata.weekly_summaries`: array of last 52 weekly summaries (one year), keyed by ISO week start date
- `user_metadata.monthly_summaries`: array of last 24 monthly summaries, keyed by `YYYY-MM`
- Summaries are computed + upserted (update existing week if re-running analyze mid-week)

**Computation:** In the route handler after Analyze, call `computeWeeklySummaries(trades)` and `computeMonthlySummaries(trades)`. No AI call — pure trade array aggregation. Returns only changed periods.

**Exposed via TradesContext:** `weeklySummaries: WeeklySummary[]`, `monthlySummaries: MonthlySummary[]`, `updateWeeklySummaries`, `updateMonthlySummaries`

**AI context injection (route.ts, analyze + chat only):**
```
WEEKLY SUMMARIES (last 8 weeks):
2025-01-13: 8 trades | +$420 | 62% WR | top violation: lunchChop
2025-01-06: 6 trades | -$120 | 33% WR | top violation: overtrading
...

MONTHLY SUMMARIES (last 6 months):
2025-01: 34 trades | +$1,840 | 58% WR | best week: Jan 13
2024-12: 28 trades | +$940 | 57% WR | best week: Dec 16
```

**TypeScript types:**
```typescript
export interface WeeklySummary {
  weekOf: string         // ISO date of Monday
  trades: number
  pnl: number
  winRate: number        // 0–100
  topSession: string     // "NYSE" | "PM" etc, most common
  topViolation: string   // most common violation that week, or "none"
}

export interface MonthlySummary {
  monthOf: string        // "YYYY-MM"
  trades: number
  pnl: number
  winRate: number
  bestWeekOf: string     // weekOf with highest pnl
  worstWeekOf: string    // weekOf with lowest pnl
}
```

### Memory Export / Import in Account Tab (D-14)

**What:** Download all user memory as a JSON file (backup/portability) and re-import it. Lives in Account tab alongside the API key section.

**Export fields** (safe to export — NO API keys, NO email, NO auth tokens):
`pattern_summary`, `session_index`, `behavior_ledger`, `milestone_log`, `streaks`, `journal_memory`, `weekly_summaries`, `monthly_summaries`, `watchlist`, `strategy_text`

**Export format:**
```json
{ "version": "v6-memory-1", "exportedAt": "ISO timestamp", "data": { ...above fields } }
```

**Export flow:** Button → `supabase.auth.getUser()` → pick memory fields → `JSON.stringify` → `Blob` download as `trading-edge-memory-YYYY-MM-DD.json`

**Import flow:** File input (accept `.json`) → parse → validate `version === "v6-memory-1"` → `supabase.auth.updateUser({ data: parsedData.data })` → reload page (or re-fetch user) to hydrate state
- Validate: must have `version` field matching expected string; reject unknown versions with a visible error
- Partial import allowed: only overwrite fields present in the JSON; don't wipe fields absent from the file

**UI placement:** New collapsible "Memory Backup" section in Account tab, below the API keys section. Same glass card pattern as the Gemini/Claude key sections.

**Button labels:** "Export Memory" (icon: download) · "Import Memory" (icon: upload)
**States:** idle → exporting (spinner) → success flash / error message; import: idle → file selected → importing → success/error

### Onboarding Modal in Coach Tab (D-15)

**What:** A center-screen modal that explains the AI coach's key features. Appears at the start of every new chat session. Vanishes the moment the user sends their first message (or taps a dismiss button). Does NOT persist — state is local to ChatView, not stored anywhere. Resets each time ChatView mounts.

**Trigger:** `const [showOnboarding, setShowOnboarding] = useState(true)` in ChatView. Set to `false` on first message send or on explicit dismiss. No localStorage, no user_metadata.

**Positioning:** Full-width overlay panel that sits in the center of the ChatView scrollable area, between the header and the input bar. Not a `<dialog>` / portal — rendered inline as a glass card that replaces the empty chat state. Same `content-wrap` flow. On desktop it's constrained to the chat column width.

**Dismiss triggers:**
1. User sends first message → `setShowOnboarding(false)` called in `sendMessage`
2. "Got it →" button tap

**Content to display:**

```
YOUR AI TRADING COACH
Built for your SMC/ICT confluence system · $50k prop account

──────────────────────

MODES
  ⚡ Analyze      Deep-dive your journal — patterns, risk, violations
  📡 Market Pulse Live prices + news for your watchlist (Yahoo Finance + web)
  🧠 Strategy Review  Your strategy vs. current SMC/ICT best practices
  💬 Chat         Ask anything — trades, levels, rules, sizing

──────────────────────

MEMORY
  I build a persistent memory of your patterns, violations, milestones,
  and full coaching history — it deepens every session.

──────────────────────

WATCHLIST
  "add ES NQ GC" → I track those symbols and pull live prices
  "remove NQ"    → off the list
  "what's my watchlist?" → I'll show you

──────────────────────

[Got it →]
```

**Design:**
- Glass card (`var(--glass)` background, `1px solid var(--border)` rim, `backdrop-filter: blur(12px)`)
- IBM Plex Mono for all labels and mode names
- Accent color (`var(--accent)`) for section dividers and the Got it button
- Fade-out animation when dismissed: opacity 0 over 0.2s, then `display: none`
- Respects `prefers-reduced-motion` (skip animation, just hide)
- No hardcoded colors

## Out of Scope

- Vector DB / pgvector embeddings (temporal sampling achieves the recall goal without extra infra)
- AI-generated weekly/monthly summaries (programmatic computation is faster and cheaper)
- New Supabase tables for memory (user_metadata only)
- Offline queue / sync for API calls
- Multi-device conflict resolution for memory data
- Claude API key rotation or multi-key support

## Dependencies

- `@anthropic-ai/sdk` npm package (install in this phase)
- Existing: `@google/genai`, `yahoo-finance2`, Supabase client
- Existing: `user_metadata` storage pattern from Phase 2

## File Impact

- `app/api/coach/route.ts` — add Anthropic SDK, route by mode, parse VIOLATIONS marker, update memory fields
- `app/components/tabs/Account.tsx` — add Claude API key input field
- `app/components/tabs/Coach.tsx` — display streaks in memory section, pass new context fields
- `app/lib/TradesContext.tsx` — add sessionIndex, behaviorLedger, milestoneLog, streaks state + updaters
- `app/lib/types.ts` — add types for memory structures
- `package.json` — add `@anthropic-ai/sdk`
