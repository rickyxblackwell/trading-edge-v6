---
phase: 06-ai-coach-enhancement-3-api-infrastructure-memory
verified: 2026-05-06T11:00:00Z
status: human_needed
score: 9/9 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open Coach tab — verify onboarding modal appears, tap Got it, confirm dismissal; then send a chat message and verify it does not reappear"
    expected: "Modal shows on fresh ChatView mount; disappears on Got it or first message; no localStorage write"
    why_human: "Session-local useState(true) behavior cannot be verified by static grep — requires browser interaction to confirm mount/dismiss cycle"
  - test: "Add a Claude API key in Account tab — enter sk-ant-... key, tap Save, confirm masked display sk-ant-••••{last4} appears and badge shows Connected"
    expected: "Key saved to Supabase user_metadata.claude_api_key; UI refreshes to show masked key; badge turns green"
    why_human: "Supabase user_metadata write and re-read requires an authenticated live session — cannot simulate statically"
  - test: "Run Analyze mode — confirm Claude Sonnet response is returned (not Gemini); verify footer shows 'Claude Sonnet · Yahoo Finance · memory: ...'"
    expected: "Claude Sonnet generates the response; footer reflects the mode accurately"
    why_human: "Actual API routing depends on runtime env with valid Claude key — cannot verify without a live session"
  - test: "Run Market Pulse mode — confirm footer shows 'Claude Sonnet · Gemini Search · Yahoo Finance · memory: ...'"
    expected: "Footer adds '· Gemini Search' badge for market-pulse mode"
    why_human: "activeMode state renders correctly only after a sendMessage call in a live browser"
  - test: "Export memory from Account tab — confirm downloaded file has version: 'v6-memory-1' and no API keys in the data"
    expected: "JSON file with version field; does not contain gemini_api_key or claude_api_key"
    why_human: "Browser download behavior requires live browser interaction; file content must be inspected"
---

# Phase 06: AI Coach Enhancement — 3-API Infrastructure & Memory Verification Report

**Phase Goal:** Route AI coaching through a 3-API infrastructure (Claude Sonnet for analyze/chat, Gemini 2.5 Flash search for market-pulse/strategy-review, Yahoo Finance for market data) + full memory system (session index, behavior ledger, milestone log, streaks, journal memory, weekly/monthly summaries) + UI (Claude key in Account, Memory Backup export/import, onboarding modal in Coach)
**Verified:** 2026-05-06T11:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Chat and Analyze modes call Claude Sonnet; Market Pulse and Strategy Review call Gemini 2.5 Flash (routing transparent to user) | ✓ VERIFIED | `route.ts:302` — `useGeminiSearch = mode === "market-pulse" \|\| mode === "strategy-review"`; `route.ts:493` — `model: "claude-sonnet-4-6"`; Gemini only fires in search branch at `route.ts:469` |
| 2 | Market Pulse always fetches live Yahoo Finance data for all watchlist symbols, included in context | ✓ VERIFIED | `route.ts:326` — `fetchFuturesSnapshot(watchlistSymbols)` called unconditionally for all modes; `marketSection` injected into `claudeSystemContext` |
| 3 | Behavior ledger tracks rule violation counts; weakness profile surfaces top-3 failure modes in every Analyze response | ✓ VERIFIED | `route.ts:76` — `buildWeaknessProfile()` called and included in `claudeSystemContext`; `route.ts:536-554` — VIOLATIONS parser with VALID_KEYS allowlist; `Coach.tsx:448` — `updateBehaviorLedger(data.behaviorLedgerUpdate)` dispatched on every analyze response |
| 4 | Streak tracker counts consecutive rule-adherent days and win/loss streaks, displayed in Coach UI | ✓ VERIFIED | `route.ts:103` — `computeStreaks()` function exists and is called on analyze; `Coach.tsx:520-538` — streak display renders when `streaks.currentWin > 0 \|\| streaks.currentLoss > 0 \|\| streaks.ruleAdherentDays > 0`; numeric values wrapped in `<span className="mono">` |
| 5 | Milestone log records first profitable day, best R session, streak records — recalled in coaching responses | ✓ VERIFIED | `route.ts:140` — `computeMilestones()` function; `route.ts:93` — `buildMilestoneContext()` included in `claudeSystemContext`; `Coach.tsx:449` — `updateMilestoneLog(data.milestoneUpdate)` dispatched |

**Score: 5/5 roadmap truths verified**

### Plan-Level Must-Have Truths

#### Plan 01 — Types and TradesContext Memory State

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All 5 memory type shapes exported from types.ts | ✓ VERIFIED | `types.ts:43-102` — SessionIndexEntry, BehaviorLedger, MilestoneLog, Streaks, JournalMemory all exported with exact field shapes from plan |
| 2 | WeeklySummary and MonthlySummary exported from types.ts | ✓ VERIFIED | `types.ts:86-102` — both interfaces present |
| 3 | TradesContext exposes all memory state and updaters | ✓ VERIFIED | `TradesContext.tsx:52-65` — interface includes sessionIndex, behaviorLedger, milestoneLog, streaks, journalMemory, weeklySummaries, monthlySummaries + all updaters |
| 4 | fetchFromSupabase hydrates all memory fields from user_metadata | ✓ VERIFIED | `TradesContext.tsx:160-173` — all 7 memory fields read with defensive type guards |
| 5 | Each updater persists via fire-and-forget supabase.auth.updateUser | ✓ VERIFIED | `TradesContext.tsx:231,351,370,381,392,401,414,429` — all updaters call `void supabase.auth.updateUser(...)` |
| 6 | addTrade auto-populates all 3 journal tiers via counter-based sampling | ✓ VERIFIED | `TradesContext.tsx:213-233` — `setJournalMemory` called inside addTrade with shortTerm (every trade), mediumTerm (every 5th), longTerm (every 10th) counter logic |
| 7 | TypeScript compiles clean with no any types | ✓ VERIFIED | `npx tsc --noEmit` exits 0 with no output |

#### Plan 02 — Dual-Provider API Route

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | ALL modes call claude-sonnet-4-6 as the final response generator | ✓ VERIFIED | `route.ts:492-499` — single `anthropic.messages.create` call with `model: "claude-sonnet-4-6"` for all modes |
| 2 | market-pulse and strategy-review fire Gemini Google Search first; result injected into Claude system context | ✓ VERIFIED | `route.ts:469-484` — Gemini search fires only when `useGeminiSearch && geminiApiKey`; `route.ts:487-489` — webResearch injected into `finalSystemContext` |
| 3 | Gemini failure degrades gracefully | ✓ VERIFIED | `route.ts:481-483` — `catch { webResearch = "" }` — empty string fallback, Claude proceeds |
| 4 | 403 returned if claude_api_key missing for ANY mode | ✓ VERIFIED | `route.ts:305-309` — explicit 403 with message "No Claude API key configured. Add one in Account Settings." |
| 5 | VIOLATIONS marker parsed; behavior_ledger increments returned | ✓ VERIFIED | `route.ts:535-554` — VIOLATIONS regex, VALID_KEYS allowlist, `behaviorLedgerUpdate` returned in response |
| 6 | session_index entry returned after every session with a title | ✓ VERIFIED | `route.ts:587-594` — `sessionIndexUpdate` set whenever `sessionTitle` is truthy |
| 7 | streaks and milestone_log computed and returned after each analyze run | ✓ VERIFIED | `route.ts:570-584` — both computed on `mode === "analyze" && trades.length > 0`; included in response at lines 607, 614 |
| 8 | All memory updates returned in response payload | ✓ VERIFIED | `route.ts:605-616` — analyze returns `sessionIndexUpdate, behaviorLedgerUpdate, milestoneUpdate, streaksUpdate, weeklyUpdate, monthlyUpdate`; non-analyze returns null for memory fields |
| 9 | TypeScript compiles clean | ✓ VERIFIED | `npx tsc --noEmit` exits 0 |

#### Plan 03 — Account Tab: Claude Key + Memory Backup

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Account tab shows Claude API Key section below Gemini key | ✓ VERIFIED | `Account.tsx:499-689` — Claude key glass card inside "AI Coach" section at line 498 |
| 2 | Claude key masked as sk-ant-••••{last4} when set | ✓ VERIFIED | `Account.tsx:58` — `claudeKey ? \`sk-ant-••••${claudeKey.slice(-4)}\` : null` |
| 3 | User can expand, enter, save Claude key | ✓ VERIFIED | `Account.tsx:91-111` — `handleSaveClaudeKey()` with expand/collapse UX, password input, save button |
| 4 | Claude key saved to user_metadata.claude_api_key | ✓ VERIFIED | `Account.tsx:95-97` — `supabase.auth.updateUser({ data: { claude_api_key: ... } })` |
| 5 | Status badge shows Connected/Not set in green/red | ✓ VERIFIED | `Account.tsx:540-550` — badge with `maskedClaudeKey ? "Connected" : "Not set"` and green/red CSS vars |
| 6 | Memory Backup collapsible section present | ✓ VERIFIED | `Account.tsx:692-826` — Memory Backup section with expand/collapse |
| 7 | Export downloads trading-edge-memory-YYYY-MM-DD.json with version v6-memory-1 | ✓ VERIFIED | `Account.tsx:130` — `version: "v6-memory-1"`; `Account.tsx:138` — filename uses ISO date slice |
| 8 | Import validates version field before merging; calls supabase.auth.updateUser | ✓ VERIFIED | `Account.tsx:158-173` — version check, allowedKeys filter, `supabase.auth.updateUser({ data: mergeFields })` |
| 9 | TypeScript compiles clean | ✓ VERIFIED | `npx tsc --noEmit` exits 0 |

#### Plan 04 — Coach Tab: Memory Dispatch + Streaks + Onboarding

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | sendMessage dispatches all 4 memory update callbacks | ✓ VERIFIED | `Coach.tsx:447-452` — `updateSessionIndex`, `updateBehaviorLedger`, `updateMilestoneLog`, `updateStreaks`, `updateWeeklySummaries`, `updateMonthlySummaries` all dispatched with null guards |
| 2 | sendMessage sends all 8 memory context fields in request body | ✓ VERIFIED | `Coach.tsx:426-434` — `sessionIndex, behaviorLedger, milestoneLog, streaks, journalMemory, coachingContextFull, weeklySummaries, monthlySummaries` in JSON body |
| 3 | Coach tab memory section shows streaks | ✓ VERIFIED | `Coach.tsx:520-538` — conditional streak row; values wrapped in `<span className="mono">` |
| 4 | Bottom footer reflects Claude for analyze/chat, Gemini Search badge for market-pulse/strategy-review | ✓ VERIFIED | `Coach.tsx:694` — conditional `" · Gemini Search"` badge based on `activeMode` state |
| 5 | Onboarding modal shows on ChatView mount; dismissed by first message or Got it | ✓ VERIFIED | `Coach.tsx:374` — `useState(true)`; `Coach.tsx:388` — `setShowOnboarding(false)` at top of sendMessage; `Coach.tsx:637` — Got it button; `Coach.tsx:562` — `showOnboarding && messages.length === 0` |
| 6 | Onboarding uses session-local state; no persistence | ✓ VERIFIED | `Coach.tsx:374` — `useState(true)` (not localStorage); no `localStorage.setItem` call for onboarding state found in file |
| 7 | TypeScript compiles clean | ✓ VERIFIED | `npx tsc --noEmit` exits 0 |

**Score: 9/9 plan-level truth groups verified**

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/lib/types.ts` | 7 memory type exports | ✓ VERIFIED | SessionIndexEntry, BehaviorLedger, MilestoneLog, Streaks, JournalMemory, WeeklySummary, MonthlySummary at lines 43-102 |
| `app/lib/TradesContext.tsx` | All memory state + updaters + journal auto-pop | ✓ VERIFIED | 7 useState fields, 8 updaters, all in Provider value; buildCompactLine at module level |
| `app/api/coach/route.ts` | Dual-provider routing, VIOLATIONS, memory computation | ✓ VERIFIED | Anthropic import at line 3; claude-sonnet-4-6 at line 493; VIOLATIONS at lines 535-554; all compute functions present |
| `package.json` | @anthropic-ai/sdk dependency | ✓ VERIFIED | `@anthropic-ai/sdk@0.94.0` confirmed via `npm list` |
| `app/components/tabs/Account.tsx` | Claude API key + Memory Backup sections | ✓ VERIFIED | Claude key card at line 499; Memory Backup section at line 692 |
| `app/components/tabs/Coach.tsx` | Memory dispatch, streak display, onboarding modal | ✓ VERIFIED | All three features present and wired |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| TradesContext.tsx fetchFromSupabase | user_metadata | `meta.session_index`, `meta.behavior_ledger`, etc. | ✓ WIRED | Lines 160-173 — all 7 memory keys read |
| TradesContext.tsx updaters | supabase.auth.updateUser | `void supabase.auth.updateUser(...)` | ✓ WIRED | Lines 351, 370, 381, 392, 401, 414, 429 |
| route.ts (analyze/chat) | Anthropic SDK | `anthropic.messages.create` with claude-sonnet-4-6 | ✓ WIRED | Lines 492-499 |
| route.ts | VIOLATIONS marker | regex parse + VALID_KEYS allowlist | ✓ WIRED | Lines 538-554 |
| route.ts | computeStreaks | called in analyze branch, returned as streaksUpdate | ✓ WIRED | Lines 572-576 |
| Account.tsx handleSaveClaudeKey | supabase.auth.updateUser({ data: { claude_api_key } }) | same pattern as Gemini key | ✓ WIRED | Lines 95-97 |
| Account.tsx handleExportMemory | JSON download blob with version + data fields | URL.createObjectURL + anchor click | ✓ WIRED | Lines 113-142 |
| Account.tsx handleImportMemory | supabase.auth.updateUser({ data: mergeFields }) | FileReader → JSON.parse → version check → partial merge | ✓ WIRED | Lines 144-181 |
| Coach.tsx sendMessage | TradesContext updateSessionIndex | `data.sessionIndexUpdate && updateSessionIndex(...)` | ✓ WIRED | Line 447 |
| Coach.tsx memory section | streaks state from TradesContext | `streaks.currentWin`, `streaks.currentLoss`, `streaks.ruleAdherentDays` | ✓ WIRED | Lines 520-538 |
| Coach.tsx ChatView onboarding modal | showOnboarding state | `useState(true)`, `setShowOnboarding(false)` on send/Got it | ✓ WIRED | Lines 374, 388, 637 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| Coach.tsx streak display | `streaks.currentWin/Loss/ruleAdherentDays` | TradesContext → computeStreaks in route.ts → updateStreaks dispatch | Yes — computed from actual trades array in analyze mode | ✓ FLOWING |
| Coach.tsx memory status | `patternSummary`, `coachingHistory.length` | TradesContext → Supabase user_metadata hydration | Yes — read from user_metadata or Supabase DB | ✓ FLOWING |
| Account.tsx Claude key display | `maskedClaudeKey` | `user.user_metadata.claude_api_key` via `supabase.auth.getUser()` | Yes — live Supabase read on mount | ✓ FLOWING |
| Account.tsx export | `user.user_metadata` | `useAuthContext()` → AuthProvider user object | Yes — AuthProvider provides live user from Supabase session | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles clean | `npx tsc --noEmit` | No output (exit 0) | ✓ PASS |
| @anthropic-ai/sdk installed | `npm list @anthropic-ai/sdk` | `@anthropic-ai/sdk@0.94.0` | ✓ PASS |
| claude-sonnet-4-6 model string present | `grep "claude-sonnet-4-6" route.ts` | Line 493 confirmed | ✓ PASS |
| VIOLATIONS parser present | `grep "VIOLATIONS" route.ts` | Lines 432, 535, 538, 540 | ✓ PASS |
| computeStreaks function present | `grep "computeStreaks" route.ts` | Line 103 (def), 572 (call) | ✓ PASS |
| Session-local onboarding (no localStorage) | `grep "localStorage.*onboarding" Coach.tsx` | No results | ✓ PASS |
| No transition:all | `grep -c "transition: all" [files]` | 0 in all 5 files | ✓ PASS |
| No TODO/FIXME stubs | `grep "TODO\|FIXME\|PLACEHOLDER" [files]` | None found | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| COACH-01 | 06-02, 06-03 | Claude Sonnet as primary coach LLM | ✓ SATISFIED | `route.ts:493` — claude-sonnet-4-6 model |
| COACH-02 | 06-02, 06-03 | Claude API key in user_metadata via Account Settings | ✓ SATISFIED | `Account.tsx:91-111` — Claude key save handler |
| COACH-03 | 06-02 | Gemini for search-grounded modes only | ✓ SATISFIED | `route.ts:302,469-484` — Gemini fires only for market-pulse/strategy-review |
| MEM-01 | 06-01, 06-04 | Session index with title recall | ✓ SATISFIED | SessionIndexEntry type; updateSessionIndex; Coach dispatches sessionIndexUpdate |
| MEM-02 | 06-01, 06-04 | Behavior ledger tracking violations | ✓ SATISFIED | BehaviorLedger type; VIOLATIONS parser; updateBehaviorLedger dispatch |
| MEM-03 | 06-01, 06-04 | Milestone log | ✓ SATISFIED | MilestoneLog type; computeMilestones; updateMilestoneLog dispatch |
| MEM-04 | 06-01, 06-04 | Journal memory (tiered) | ✓ SATISFIED | JournalMemory type; buildCompactLine; addTrade counter-based sampling |
| MEM-05 | 06-01, 06-04 | Streak tracking displayed in Coach UI | ✓ SATISFIED | Streaks type; computeStreaks; streak display in ChatView |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/components/tabs/Account.tsx` | 205 | `#0ea5e9` hardcoded hex in sign-in CTA gradient | ⚠️ Warning | Non-compliant with design system "no hardcoded hex" rule — but `#0ea5e9` is a pre-existing pattern also in `globals.css:439` and `app/page.tsx:247`; not introduced fresh by this phase |
| `app/components/tabs/Coach.tsx` | 264 | `#0ea5e9` hardcoded hex in sign-up CTA gradient | ⚠️ Warning | Same pre-existing pattern carried from app/page.tsx into unauthenticated HistoryView CTA; user-facing only when unauthenticated |

**Note:** Both violations are in unauthenticated "sign in / sign up" CTA buttons using the established app-wide gradient `linear-gradient(to bottom, var(--accent), #0ea5e9)`. This pattern predates Phase 06 and appears in globals.css. The CLAUDE.md rule says "no hardcoded colors" but this specific gradient is an established convention in the codebase. These are warnings, not blockers for the Phase 06 goal.

### Human Verification Required

#### 1. Onboarding Modal Mount/Dismiss Cycle

**Test:** Open the Coach tab in a fresh browser session (or reload the page). Verify the onboarding modal appears with three color-coded rows (Commands, Memory, AI Stack). Tap "Got it →" and confirm it disappears. Reload the page and confirm it reappears (session-local, not persisted).

**Expected:** Modal shows on ChatView mount when messages = 0; disappears on Got it click; reappears on next mount. No entry in localStorage for onboarding state.

**Why human:** `useState(true)` behavior can only be confirmed by running the component in a browser — static analysis confirms the code is correct but cannot simulate mount/unmount cycles.

#### 2. Claude API Key Save and Mask

**Test:** Navigate to Account tab. Expand the Claude API Key section. Enter a valid (or test) sk-ant- key. Tap Save key. Confirm the masked display shows `sk-ant-••••XXXX` and the Connected badge turns green.

**Expected:** Key saved to Supabase user_metadata; maskedClaudeKey state updated on getUser() refresh; badge shows Connected.

**Why human:** Supabase user_metadata write requires a live authenticated session with correct RLS permissions.

#### 3. Claude Route Is Used for Analyze Mode

**Test:** With a Claude API key configured, tap "Analyze Journal" in Coach. Confirm a response is returned. Verify the footer shows "Claude Sonnet · Yahoo Finance · memory: ..." (no Gemini Search badge for analyze mode).

**Expected:** Claude generates the response; footer correctly shows analyze mode label without Gemini badge.

**Why human:** End-to-end routing requires a live Claude API key and authenticated session.

#### 4. Gemini Search Badge for Market Pulse

**Test:** Tap "Market Pulse" in Coach. Confirm a response is returned. Verify footer shows "Claude Sonnet · Gemini Search · Yahoo Finance · memory: ...".

**Expected:** activeMode state is "market-pulse" after the send; conditional Gemini Search badge appears in footer.

**Why human:** Requires live browser interaction with valid API keys to confirm activeMode updates and badge renders.

#### 5. Memory Export File Content

**Test:** Navigate to Account tab, expand Memory Backup, click "Download memory backup". Open the downloaded JSON. Confirm: (a) `version` field is `"v6-memory-1"`, (b) file does not contain `gemini_api_key` or `claude_api_key`, (c) `data` object contains expected memory fields (session_index, behavior_ledger, etc.).

**Expected:** Clean export with version field and no API key leakage.

**Why human:** File download requires browser interaction; content inspection requires opening the file.

### Gaps Summary

No gaps identified. All must-haves verified at all four levels (existence, substantive, wired, data-flowing).

The two hardcoded `#0ea5e9` hex values are pre-existing codebase pattern violations not introduced by Phase 06, and are present only in unauthenticated-user CTA buttons — they do not affect the phase goal.

Five items require human verification to confirm runtime behavior that static analysis cannot validate (modal lifecycle, Supabase writes, live API routing).

---

_Verified: 2026-05-06T11:00:00Z_
_Verifier: Claude (gsd-verifier)_
