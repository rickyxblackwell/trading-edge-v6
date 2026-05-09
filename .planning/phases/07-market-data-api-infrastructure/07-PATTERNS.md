# Phase 7: Market Data API Infrastructure - Pattern Map

**Mapped:** 2026-05-06
**Files analyzed:** 3 (1 primary + 2 supporting)
**Analogs found:** 3 / 3

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/api/coach/route.ts` | API route (service) | request-response + event-driven (agentic loop) | `app/api/coach/route.ts` (existing) | self — in-place refactor |
| `app/components/tabs/Account.tsx` | component | request-response | `app/components/tabs/Account.tsx` (existing) | self — in-place extension |
| `app/lib/marketData.ts` | utility / service | request-response | `app/lib/marketData.ts` (existing) | self — wrap existing function |

---

## Pattern Assignments

### `app/api/coach/route.ts` (API route, agentic loop)

**Analog:** Same file — Phase 7 refactors this file in-place.

---

#### Imports pattern (lines 1-9 of current file):

```typescript
import { NextRequest, NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@/lib/supabase/server"
import { fetchFuturesSnapshot } from "@/app/lib/marketData"
import type { BehaviorLedger, MilestoneLog, Streaks, SessionIndexEntry, WeeklySummary, MonthlySummary } from "@/app/lib/types"
```

Phase 7 adds to this block:
```typescript
import { unstable_cache } from "next/cache"
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"
```

---

#### API key read pattern (lines 254-257 — existing `claude_api_key` and `gemini_api_key` pattern):

```typescript
const geminiApiKey = user.user_metadata?.gemini_api_key as string | undefined
const claudeApiKey = user.user_metadata?.claude_api_key as string | undefined
```

Phase 7 adds two new reads immediately after these using the same pattern:
```typescript
const avApiKey = user.user_metadata?.av_api_key as string | undefined
const polygonApiKey = user.user_metadata?.polygon_api_key as string | undefined
```

Both AV and Polygon keys follow the exact same `user.user_metadata?.XXX_api_key` shape. Read from the authenticated user session. Never sent to the client in any response.

---

#### Auth guard pattern (lines 247-251):

```typescript
const supabase = await createClient()
const { data: { user }, error: authError } = await supabase.auth.getUser()

if (authError || !user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
```

This pattern is unchanged. The `createClient()` import is from `@/lib/supabase/server` (SSR/cookie-bound, anon key). The new admin client (`createSupabaseAdmin`) is separate — module-level singleton, service role key.

---

#### Supabase admin client pattern — NEW (from RESEARCH.md Pattern 5):

Create at module level (outside POST handler), separate from `@/lib/supabase/server`:

```typescript
const supabaseAdmin = createSupabaseAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)
```

Used inside POST handler after computing memory updates:
```typescript
const { error: writeError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
  user_metadata: {
    ...user.user_metadata,
    session_index: updatedSessionIndex,
    behavior_ledger: updatedBehaviorLedger,
    streaks: updatedStreaks,
    milestone_log: updatedMilestoneLog,
    weekly_summaries: updatedWeeklySummaries,
    monthly_summaries: updatedMonthlySummaries,
  }
})
if (writeError) {
  return NextResponse.json({ error: "Memory write failed" }, { status: 500 })
}
```

Critical: this replaces the current pattern where the client receives memory updates and writes them. The server writes first; client receives updates as UI confirmation only.

---

#### Rate limit guard pattern (lines 296-300):

```typescript
const sid = (sessionId as string) || "default"
const last = lastCallTime.get(sid) || 0
if (Date.now() - last < RATE_LIMIT_MS) {
  return NextResponse.json({ error: "Rate limited — wait 15 seconds" }, { status: 429 })
}
lastCallTime.set(sid, Date.now())
```

This session-level rate limit remains unchanged. Data API rate limits (Polygon 5/min, AV 25/day) are handled silently inside tool executors — never surfaced to the user. AI provider rate limits (Claude/Gemini 429) become visible notifications via `error` field in the response (see Coach.tsx pattern below).

---

#### Error handling pattern (lines 618-630):

```typescript
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  const isClaudeMode = typeof body?.mode === "string" && (body.mode === "analyze" || body.mode === "chat")
  console.error(`[coach] ${isClaudeMode ? "Claude" : "Gemini"} error:`, message)
  if (message.includes("API_KEY") || message.includes("401") || message.includes("403") || message.includes("authentication")) {
    const provider = isClaudeMode ? "Claude" : "Gemini"
    return NextResponse.json({ error: `Invalid ${provider} API key` }, { status: 401 })
  }
  if (message.includes("429") || message.includes("RESOURCE_EXHAUSTED") || message.includes("quota")) {
    return NextResponse.json({ error: "Quota exceeded — check your API plan limits" }, { status: 429 })
  }
  return NextResponse.json({ error: "Coach unavailable — try again" }, { status: 500 })
}
```

Phase 7 extends this with provider-specific 429 messages that Coach.tsx will show as notification boxes:
- Claude 429 → `{ error: "Claude is at capacity — your request is queued and will resume shortly." }`
- Gemini 429 → `{ error: "Gemini search is rate-limited — queued for retry. Coach will respond once search completes." }`
- Invalid API key → `{ error: "Invalid [Provider] API key — check Account settings.", type: "key_error" }`
- Data API errors (AV/FRED/Polygon) → silent in error field; Claude gets a note in its context but user sees nothing

---

#### Graceful degradation pattern (lines 469-484 — existing Gemini fetch):

```typescript
let webResearch = ""
if (useGeminiSearch && geminiApiKey) {
  try {
    // ... call Gemini
    webResearch = geminiRes.text?.trim() ?? ""
  } catch {
    webResearch = ""   // Fail silently — Claude proceeds without it
  }
}
```

Phase 7 follows the same try/catch → empty string pattern for every tool executor. If a data API call fails after one retry, Claude receives a note in its context (e.g., `[Yahoo Finance unavailable]`) and proceeds. The user never sees a data API error unless it's an invalid key.

---

#### Existing Yahoo Finance fetch (lines 325-329) — to be removed and replaced:

```typescript
// CURRENT (Phase 6) — unconditional pre-fetch on every request:
const watchlistSymbols = Array.isArray(watchlist) ? (watchlist as string[]) : []
const marketSnapshot = await fetchFuturesSnapshot(watchlistSymbols)
const marketSection = marketSnapshot ? `\n${marketSnapshot}\n` : ""
```

Phase 7 removes these lines. `fetchFuturesSnapshot` is instead wrapped as a Claude tool definition and only called when Claude emits a `fetchYahooFinanceSnapshot` tool_use block.

---

#### Gemini hardcoded query removal (lines 302 and 469-484):

```typescript
// CURRENT (Phase 6) — remove these:
const useGeminiSearch = mode === "market-pulse" || mode === "strategy-review"
// ...
const geminiQuery = mode === "market-pulse"
  ? "Futures market news..."
  : "Current best practices..."
```

Phase 7 removes `useGeminiSearch` flag and all hardcoded query strings. Gemini becomes a `searchGemini` tool definition. Claude generates adaptive queries based on the user's message. Available in all 4 modes.

---

#### Agentic loop pattern — NEW (from RESEARCH.md Patterns 2/3):

Replace the current `anthropic.messages.create()` single-call with the beta MCP connector call. The manual loop is the fallback if `toolRunner` does not accept `mcp_servers`:

```typescript
// Primary: beta.messages.create with manual loop
const messages: Anthropic.Beta.BetaMessageParam[] = [
  { role: "user", content: userPrompt }
]

let response = await anthropic.beta.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 1024,
  system: finalSystemContext,
  messages,
  tools: localTools,       // fetchYahooFinanceSnapshot, fetchFREDSeries, fetchPolygonFutures, searchGemini
  mcp_servers: avApiKey
    ? [{ type: "url", url: `https://mcp.alphavantage.co/mcp?apikey=${avApiKey}`, name: "alphavantage" }]
    : [],
  betas: ["mcp-client-2025-11-20"],
})

let loopCount = 0
while (response.stop_reason === "tool_use" && loopCount < 10) {
  loopCount++
  const toolUseBlocks = response.content.filter(
    (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use"
  )
  const toolResults = await Promise.all(toolUseBlocks.map(executeToolCall))

  messages.push({ role: "assistant", content: response.content })
  messages.push({
    role: "user",
    content: toolResults.map(r => ({
      type: "tool_result" as const,
      tool_use_id: r.toolUseId,
      content: r.result,
    }))
  })

  response = await anthropic.beta.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: finalSystemContext,
    messages,
    tools: localTools,
    mcp_servers: avApiKey ? [...] : [],
    betas: ["mcp-client-2025-11-20"],
  })
}

const firstBlock = response.content[0]
rawText = firstBlock.type === "text" ? firstBlock.text : ""
```

Current non-agentic call at lines 492-498 is replaced entirely by this loop.

---

#### unstable_cache wrapper pattern — NEW (from RESEARCH.md Pattern 6):

```typescript
import { unstable_cache } from "next/cache"

// EOD trading-day key — roll back to last weekday if weekend
function getTradingDayKey(): string {
  const now = new Date()
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }))
  let day = et.getDay()  // 0=Sun, 6=Sat
  if (day === 0) et.setDate(et.getDate() - 2)  // Sun → Fri
  if (day === 6) et.setDate(et.getDate() - 1)  // Sat → Fri
  return et.toISOString().split("T")[0]
}

// Cache wrappers — must be defined at module level (not inside POST handler)
const cachedFetchFRED = unstable_cache(
  async (seriesId: string) => fetchFREDSeries(seriesId),
  ["fred"],
  { revalidate: 86400 }
)

const cachedFetchYahooFinance = unstable_cache(
  async (symbols: string[]) => fetchFuturesSnapshot(symbols),
  ["yf-snapshot"],
  { revalidate: 86400 }
)

// AV and Polygon use trading-day key in the cache key array for EOD boundary
// Cache key is constructed per-call — use a factory or pass all params
```

Note from RESEARCH.md Pitfall 6: market data cache keys should NOT include user IDs — data is shared across all users. API keys live in the closure only, not in the cache key.

---

#### Tool definitions for local executors — NEW (from RESEARCH.md Pattern 2):

```typescript
const localTools: Anthropic.Tool[] = [
  {
    name: "fetchYahooFinanceSnapshot",
    description: "Fetch live futures price snapshot (ES, NQ, YM, and user watchlist). Use when user asks about current prices or market conditions.",
    input_schema: {
      type: "object" as const,
      properties: {
        symbols: {
          type: "array",
          items: { type: "string" },
          description: "Futures symbols to fetch (e.g. ['ES', 'NQ']). Empty array returns core futures."
        }
      },
      required: []
    }
  },
  {
    name: "fetchFREDSeries",
    description: "Fetch a FRED economic series (latest 5 observations). Use for macro context: DFF (Fed funds rate), CPIAUCSL (CPI), PAYEMS (payrolls), UNRATE (unemployment), GDP, T10Y2Y (yield curve), VIXCLS (VIX).",
    input_schema: {
      type: "object" as const,
      properties: {
        series_id: {
          type: "string",
          enum: ["DFF", "CPIAUCSL", "PAYEMS", "UNRATE", "GDP", "T10Y2Y", "VIXCLS"],
          description: "FRED series ID"
        }
      },
      required: ["series_id"]
    }
  },
  {
    name: "fetchPolygonFutures",
    description: "Fetch CME futures historical bars + open interest for a specific contract. Only use when user asks about a specific futures instrument by name.",
    input_schema: {
      type: "object" as const,
      properties: {
        symbol: {
          type: "string",
          enum: ["ES", "NQ", "YM", "MES", "MNQ", "MYM"],
          description: "CME futures root symbol"
        }
      },
      required: ["symbol"]
    }
  },
  {
    name: "searchGemini",
    description: "Perform a web search using Gemini for current market news, strategy research, or economic events. Generate an appropriate search query based on the user's question.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query to execute"
        }
      },
      required: ["query"]
    }
  }
]
```

---

#### `executeToolCall` dispatch function — NEW:

```typescript
async function executeToolCall(
  block: Anthropic.Beta.BetaToolUseBlock,
  deps: { avApiKey?: string; polygonApiKey?: string; fredApiKey: string; geminiApiKey?: string; watchlist: string[] }
): Promise<{ toolUseId: string; result: string }> {
  const { name, id, input } = block
  const inp = input as Record<string, unknown>
  try {
    switch (name) {
      case "fetchYahooFinanceSnapshot": {
        const symbols = Array.isArray(inp.symbols) ? inp.symbols as string[] : deps.watchlist
        const result = await cachedFetchYahooFinance(symbols)
        return { toolUseId: id, result: result || "[Yahoo Finance: no data]" }
      }
      case "fetchFREDSeries": {
        const seriesId = inp.series_id as string
        const result = await cachedFetchFRED(seriesId)
        return { toolUseId: id, result }
      }
      case "fetchPolygonFutures": {
        const symbol = inp.symbol as string
        if (!deps.polygonApiKey) return { toolUseId: id, result: "[Polygon: no API key configured]" }
        const result = await fetchPolygonFutures(symbol, deps.polygonApiKey)
        return { toolUseId: id, result }
      }
      case "searchGemini": {
        const query = inp.query as string
        if (!deps.geminiApiKey) return { toolUseId: id, result: "[Gemini search: no API key configured]" }
        const result = await fetchGeminiSearch(query, deps.geminiApiKey)
        return { toolUseId: id, result }
      }
      default:
        return { toolUseId: id, result: `[Unknown tool: ${name}]` }
    }
  } catch {
    return { toolUseId: id, result: `[${name}: fetch failed]` }
  }
}
```

---

#### Response shape (lines 605-616 — unchanged structure):

```typescript
// analyze mode
return NextResponse.json({
  reply, coaching, newPatternSummary, sessionTitle, watchlistAdd, watchlistRemove,
  sessionIndexUpdate, behaviorLedgerUpdate, milestoneUpdate, streaksUpdate,
  weeklyUpdate, monthlyUpdate,
})

// other modes
return NextResponse.json({
  reply, newPatternSummary, sessionTitle, watchlistAdd, watchlistRemove,
  sessionIndexUpdate, behaviorLedgerUpdate: null, milestoneUpdate: null, streaksUpdate: null,
  weeklyUpdate: null, monthlyUpdate: null,
})
```

Phase 7 response shape is identical. Memory fields are now "confirmations" of the server write, not write instructions. Client receives them and updates local state without making its own Supabase call.

---

### `app/components/tabs/Account.tsx` (component, request-response)

**Analog:** Same file — Phase 7 adds two new API key glass cards below the existing Claude key card.

---

#### State variable pattern for existing keys (lines 35-40):

```typescript
const [maskedClaudeKey, setMaskedClaudeKey] = useState<string | null>(null)
const [claudeExpanded, setClaudeExpanded] = useState(false)
const [newClaudeKey, setNewClaudeKey] = useState("")
const [showClaudeKey, setShowClaudeKey] = useState(false)
const [claudeSaving, setClaudeSaving] = useState(false)
const [claudeSaveSuccess, setClaudeSaveSuccess] = useState(false)
```

Replicate this 6-variable pattern verbatim for each new key, substituting the prefix:
- `maskedClaudeKey` → `maskedAvKey`, `maskedPolygonKey`
- `claudeExpanded` → `avExpanded`, `polygonExpanded`
- etc.

---

#### Initial key load pattern (lines 56-59):

```typescript
useEffect(() => {
  const supabase = createClient()
  supabase.auth.getUser().then(({ data: { user } }) => {
    // ...
    const claudeKey = user?.user_metadata?.claude_api_key as string | undefined
    setMaskedClaudeKey(claudeKey ? `sk-ant-••••${claudeKey.slice(-4)}` : null)
  })
}, [])
```

Add inside the same `useEffect`:
```typescript
const avKey = user?.user_metadata?.av_api_key as string | undefined
setMaskedAvKey(avKey ? `••••${avKey.slice(-4)}` : null)
const polygonKey = user?.user_metadata?.polygon_api_key as string | undefined
setMaskedPolygonKey(polygonKey ? `••••${polygonKey.slice(-4)}` : null)
```

---

#### Save handler pattern (lines 91-111 — `handleSaveClaudeKey`):

```typescript
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
```

Replicate verbatim for AV (`av_api_key`) and Polygon (`polygon_api_key`). Only the `data` key name and the masked key format differ.

---

#### Glass card JSX pattern (lines 514-705):

The Claude key card at lines 514-705 is the exact template for new AV and Polygon cards. Structure:
1. Outer `<div className="glass" style={{ borderRadius: 16, overflow: "hidden", marginTop: 12 }}>` wrapper
2. Status row (height 56): `<KeyRound>` icon + key name label + masked key sublabel + Connected/Not set pill badge
3. Toggle row (height 44): `<PencilLine>` icon + "Update API key" text + `<ChevronRight>` with rotate transition
4. Expanded panel: password input with show/hide eye toggle + Save button with `<Loader2>` spinner state + `<CheckCircle>` success state

The pill badge colors are: connected → `var(--green)` + `rgba(52,211,153,0.1)` bg; not set → `var(--red)` + `rgba(248,113,113,0.1)` bg.

The expand/collapse transition uses `transform: rotate(90deg)` on `<ChevronRight>` with `transition: "transform 0.2s ease"`.

Placement: Add AV card and Polygon card inside the same `<section>` as Gemini and Claude keys (the "AI Coach" section), after the existing Claude card.

---

### `app/lib/marketData.ts` (utility, request-response)

**Analog:** Same file — no changes needed. `fetchFuturesSnapshot` is already the correct function signature. Phase 7 calls it from `executeToolCall` inside route.ts instead of calling it directly in the POST handler.

---

#### Current function signature (lines 39-78 — unchanged):

```typescript
export async function fetchFuturesSnapshot(extraSymbols: string[] = []): Promise<string>
```

This function is already server-only, already returns a formatted string (ready for Claude's context), and already handles errors with graceful degradation (`return ""`). No changes are required.

---

#### Wrapping pattern for the tool executor:

```typescript
// In route.ts executeToolCall:
case "fetchYahooFinanceSnapshot": {
  const symbols = Array.isArray(inp.symbols) ? inp.symbols as string[] : deps.watchlist
  const result = await fetchFuturesSnapshot(symbols)  // existing function, no changes
  return { toolUseId: id, result: result || "[Yahoo Finance: no data available]" }
}
```

---

## Shared Patterns

### Authentication (server-side session read)
**Source:** `app/api/coach/route.ts` lines 247-251
**Apply to:** All server-side data access in route.ts
```typescript
const supabase = await createClient()
const { data: { user }, error: authError } = await supabase.auth.getUser()
if (authError || !user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
```

### API Key Read from user_metadata
**Source:** `app/api/coach/route.ts` lines 254-257
**Apply to:** `avApiKey` and `polygonApiKey` reads in route.ts POST handler
```typescript
const avApiKey = user.user_metadata?.av_api_key as string | undefined
const polygonApiKey = user.user_metadata?.polygon_api_key as string | undefined
```
Keys are never returned in any API response. Failure is handled by returning a graceful fallback string from the tool executor.

### Error Classification in catch block
**Source:** `app/api/coach/route.ts` lines 618-630
**Apply to:** The outer try/catch in POST handler and inner tool executor try/catch
```typescript
if (message.includes("429") || ...) → rate limit response
if (message.includes("401") || ...) → invalid key response
default → 500 generic error
```

### Supabase user_metadata write from client component
**Source:** `app/components/tabs/Account.tsx` lines 91-111
**Apply to:** `handleSaveAvKey` and `handleSavePolygonKey` functions
```typescript
const { error } = await supabase.auth.updateUser({
  data: { [key_name]: newKey.trim() },
})
```

### Error notification in Coach.tsx (existing UI pattern)
**Source:** `app/components/tabs/Coach.tsx` lines 554-558
**Apply to:** Rate limit notification box for Claude/Gemini 429 errors (D-07)
```typescript
{error && (
  <div className="rounded-xl px-4 py-3" style={{ background: "rgba(255,61,90,0.08)", border: "1px solid rgba(255,61,90,0.3)" }}>
    <p className="mono text-xs" style={{ color: "var(--red)" }}>{error}</p>
  </div>
)}
```

Phase 7 requirement (D-07): Claude/Gemini rate limit errors need a distinct notification style from generic errors. The visible notification box for AI provider limits should use `var(--yellow)` instead of `var(--red)` with dismissable behavior. The existing red error box is the structural template — same container, different color tokens, add dismiss button.

---

## No Analog Found

All new capabilities in Phase 7 are either in-place modifications of existing files or patterns fully specified in RESEARCH.md. No new files are required (per D-11).

| Capability | Where it lives | Pattern source |
|------------|---------------|----------------|
| AV MCP connector (`mcp_servers` + beta header) | `route.ts` | RESEARCH.md Pattern 1 |
| FRED plain fetch function | `route.ts` | RESEARCH.md Pattern 4 |
| Polygon plain fetch function | `route.ts` | RESEARCH.md Pattern 5 code example |
| `getTradingDayKey()` EOD cache helper | `route.ts` | RESEARCH.md Pattern 6 |
| Supabase admin client (service role) | `route.ts` | RESEARCH.md Pattern 5 |

---

## Metadata

**Analog search scope:** `app/api/coach/`, `app/components/tabs/`, `app/lib/`, `lib/supabase/`
**Files read:** `route.ts`, `Account.tsx`, `marketData.ts`, `Coach.tsx` (partial), `lib/supabase/server.ts`
**Pattern extraction date:** 2026-05-06
