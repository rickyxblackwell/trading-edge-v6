---
phase: 07
slug: market-data-api-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-06
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript type-check (`npx tsc --noEmit`) + manual integration tests |
| **Config file** | `tsconfig.json` |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit && npx next build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit && npx next build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | MDATA-01 | T-07-01 | AV API key never returned to client | type-check | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 07-01-02 | 01 | 1 | MDATA-02 | T-07-02 | FRED/Polygon keys server-only | type-check | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 07-02-01 | 02 | 2 | MDATA-03 | — | Cache TTL enforced, no stale data | manual | curl tool endpoint, verify cache headers | ❌ W0 | ⬜ pending |
| 07-03-01 | 03 | 2 | MDATA-04 | — | Tool_use loop terminates on end_turn | manual | Test chat message triggering tool call | ❌ W0 | ⬜ pending |
| 07-04-01 | 04 | 3 | MDATA-05 | — | Polygon 403 degrades gracefully | manual | Test with invalid Polygon key | ❌ W0 | ⬜ pending |
| 07-05-01 | 05 | 3 | MDATA-05 | T-07-03 | Service role key not in client bundle | type-check | `npx next build` (check bundle) | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Polygon API key verification — test `GET /futures/v1/contracts?ticker=ES&apiKey=KEY` before building Polygon tools (confirms tier access)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` and `FRED_API_KEY` present in `.env.local`
- [ ] Alpha Vantage MCP reachable — test `https://mcp.alphavantage.co/mcp?apikey=KEY`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Claude calls AV tool when user asks "What's RSI on ES?" | MDATA-01 | Requires live Claude API call with valid AV key | Send message in Coach tab, inspect network log for tool call |
| EOD cache boundary at 4 PM ET | MDATA-03 | Requires time manipulation or waiting | Check cache key includes date, verify TTL logic in code review |
| Rate limit notification box appears on Claude 429 | MDATA-05 | Requires simulating rate limit | Temporarily set a low rate limit and send rapid messages |
| Supabase memory write occurs server-side (not client) | MDATA-04 | Requires network inspection | Check Supabase logs show server-IP writes, not browser writes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
