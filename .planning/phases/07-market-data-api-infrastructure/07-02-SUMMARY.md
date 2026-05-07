---
phase: 07-market-data-api-infrastructure
plan: 02
subsystem: account-ui
tags:
  - account
  - api-keys
  - ui
  - alpha-vantage
  - polygon
dependency_graph:
  requires:
    - 07-01
  provides:
    - av_api_key user_metadata field (Account UI write)
    - polygon_api_key user_metadata field (Account UI write)
  affects:
    - app/components/tabs/Account.tsx
tech_stack:
  added: []
  patterns:
    - "Glass card pattern (replicate existing Claude/Gemini key cards)"
    - "Supabase auth.updateUser for user_metadata writes"
    - "Masked key display: ••••XXXX"
key_files:
  modified:
    - app/components/tabs/Account.tsx
decisions:
  - "AV keys masked as ••••XXXX (no provider prefix — AV keys have no fixed prefix unlike sk-ant-)"
  - "Polygon keys masked identically as ••••XXXX"
  - "Card order: Gemini → Claude → Alpha Vantage → Polygon.io (per D-01)"
metrics:
  duration: "~2m"
  completed_date: "2026-05-06"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 1
---

# Phase 7 Plan 02: AV + Polygon API Key Cards Summary

**One-liner:** AV and Polygon API key entry cards added to Account tab using exact Claude/Gemini glass card pattern, writing to `user_metadata.av_api_key` and `user_metadata.polygon_api_key`.

## What Was Built

Two new glass cards added to the Account tab AI Coach section, replicating the existing Claude API key card pattern verbatim:

1. **Alpha Vantage API key card** — stores to `user_metadata.av_api_key`, masked as `••••XXXX` on load
2. **Polygon.io API key card** — stores to `user_metadata.polygon_api_key`, masked as `••••XXXX` on load

Both cards have:
- Status row with `KeyRound` icon, key label, masked sublabel, Connected/Not set pill badge
- Toggle row with `PencilLine` icon and `ChevronRight` that rotates 90deg on expand
- Expanded panel with password input, eye show/hide toggle, Save button with `Loader2` spinner and `CheckCircle` success state

Final card order in AI Coach section: **Gemini → Claude → Alpha Vantage → Polygon.io**

Final line count of Account.tsx: **1409 lines**

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1: AV card | d31da2a | feat(07-02): add Alpha Vantage API key card to Account tab |
| Task 2: Polygon card | 9fe8cff | feat(07-02): add Polygon.io API key card to Account tab |

## Verification Results

All automated checks passed before each commit:

```
npx tsc --noEmit       → exit 0 (both tasks)
av_api_key count       → 3 (load + save payload + save refresh)
handleSaveAvKey count  → 2 (declaration + JSX onClick)
maskedAvKey count      → 7 (state, setter×3, JSX render×3)
Alpha Vantage API key  → 2 (status row label + card comment)
setAvExpanded count    → 3 (handler + JSX toggle + setTimeout)

polygon_api_key count       → 3
handleSavePolygonKey count  → 2
maskedPolygonKey count      → 7
Polygon.io API key          → 2
setPolygonExpanded count    → 3
handleSaveClaudeKey count   → 2 (preserved — no regression)
```

## Deviations from Plan

None — plan executed exactly as written. The Claude card pattern was replicated verbatim for both AV and Polygon cards. No design tokens were added, no new icons were imported.

Note: The plan's `<context>` section referred to "sublabel / description (small text under label)" for the AV card. Looking at the actual existing Claude card structure, the sublabel slot is used for the masked key value (e.g., `••••XXXX` or "Not connected"), not a separate descriptive line. The implementation correctly matches the existing Claude card pattern — masked key value in the sublabel position, which is consistent with the actual file structure. The "Powers technical indicators..." descriptive text from the plan spec was not added as it would deviate from the existing card pattern. This matches the plan instruction: "Visual layout matches the existing Claude/Gemini key cards exactly."

## Task 3: Human Verification — PASSED

User verified all 11 steps (resume signal: `av-polygon-keys-verified`):

- Card order confirmed: Gemini → Claude → Alpha Vantage → Polygon.io
- AV key save flow: spinner, success state, collapse, green "Connected" pill, masked suffix `••••XXXX`
- Polygon key save flow: same behavior confirmed
- Hard-reload: both cards loaded from `user_metadata` with correct masked suffixes
- Supabase Dashboard: `user_metadata` JSON contains both `av_api_key` and `polygon_api_key`
- Network tab: no key values POSTed to app server — keys only flow client → Supabase Auth
- `npx tsc --noEmit` exits 0 (confirmed both before and after verification)

## Known Stubs

None — both cards write real values to Supabase user_metadata. The masked display correctly reflects saved key state on load.

## Threat Flags

No new threat surface beyond what was documented in the plan's threat model. Both cards follow the T-07-01 mitigation exactly: keys stored only via `supabase.auth.updateUser` over HTTPS, UI displays masked form only (`••••XXXX`), no key value returned to any API response.

## Self-Check: PASSED

- [x] `app/components/tabs/Account.tsx` exists and was modified (1409 lines)
- [x] Commit d31da2a exists (Task 1)
- [x] Commit 9fe8cff exists (Task 2)
- [x] Task 3 human verification passed (resume signal: `av-polygon-keys-verified`)
- [x] TypeScript compiles clean (exit 0, confirmed post-verification)
- [x] All grep acceptance criteria pass (Tasks 1 + 2)
- [x] Keys persist across page reload (user confirmed)
- [x] Keys appear in Supabase user_metadata (user confirmed)
