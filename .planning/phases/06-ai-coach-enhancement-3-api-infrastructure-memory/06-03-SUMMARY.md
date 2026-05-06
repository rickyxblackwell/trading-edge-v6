---
phase: 06-ai-coach-enhancement-3-api-infrastructure-memory
plan: "03"
subsystem: account-ui
tags: [claude-api-key, memory-backup, account-tab, supabase-auth]
dependency_graph:
  requires:
    - "06-01"
  provides:
    - claude_api_key in user_metadata
    - memory export/import JSON (v6-memory-1)
  affects:
    - app/components/tabs/Account.tsx
tech_stack:
  added: []
  patterns:
    - Replicated Gemini key UX pattern for Claude key
    - FileReader + JSON.parse for import validation
    - URL.createObjectURL for client-side JSON download
key_files:
  created:
    - app/components/tabs/Account.tsx
  modified: []
decisions:
  - Both Task 1 (Claude key) and Task 2 (Memory Backup) committed in single atomic commit since they modify the same file and were verified together
  - user object destructured from useAuthContext (already provided by AuthProvider) for handleExportMemory
  - Memory export excludes API keys (gemini_api_key, claude_api_key) per T-06-15 — only AI coaching memory fields included
metrics:
  duration: "3m 9s"
  completed: "2026-05-06T10:20:51Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 1
---

# Phase 06 Plan 03: Claude API Key + Memory Backup Summary

**One-liner:** Claude API key input field with masked sk-ant- display and memory backup export/import (v6-memory-1 JSON) added to Account tab.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add Claude API key state and handler | 84b5a1e | app/components/tabs/Account.tsx |
| 2 | Add Memory Backup section (export/import) | 84b5a1e | app/components/tabs/Account.tsx |

## What Was Built

### Task 1: Claude API Key Section

Added a complete Claude API key management card below the Gemini key card inside the "AI Coach" section of Account.tsx:

- Six new state variables: `maskedClaudeKey`, `claudeExpanded`, `newClaudeKey`, `showClaudeKey`, `claudeSaving`, `claudeSaveSuccess`
- `useEffect` extended to load `user_metadata.claude_api_key` and mask as `sk-ant-••••{last4}`
- `handleSaveClaudeKey()` calls `supabase.auth.updateUser({ data: { claude_api_key } })` — identical pattern to `handleSaveKey` for Gemini
- JSX: glass card with status row (Connected/Not set badge), expand toggle, password input with eye toggle, save button with loading state and success feedback
- Minimum 44px tap targets on all interactive elements
- IBM Plex Mono (`className="mono"`) on key display and status text

### Task 2: Memory Backup Section

Added a standalone "Memory Backup" section below the AI Coach section:

- Four new state variables: `memoryBackupExpanded`, `importError`, `importSuccess`, `exporting`
- `handleExportMemory()`: reads current `user.user_metadata`, selects 10 allowed fields, wraps in `{ version: "v6-memory-1", exportedAt, data }`, triggers download as `trading-edge-memory-YYYY-MM-DD.json`
- `handleImportMemory()`: reads file via `file.text()`, validates `version === "v6-memory-1"`, merges only allowlisted keys via `supabase.auth.updateUser` — no eval, no prototype pollution
- JSX: collapsible glass card, export button, import label (wrapping hidden file input), error/success inline feedback, descriptive copy
- New icon imports: `Database`, `Download`, `Upload` from lucide-react

## Verification Results

- `npx tsc --noEmit` exits 0 (clean)
- `claude_api_key`, `maskedClaudeKey`, `claudeExpanded` all present in Account.tsx
- `sk-ant-••••${key.slice(-4)}` mask format confirmed at lines 58, 106, 602
- `v6-memory-1` version string present at lines 130, 158
- `handleExportMemory` and `handleImportMemory` present
- `Database`, `Download`, `Upload` icons imported and used

## Deviations from Plan

### Auto-resolved: user object availability

**Found during:** Task 2 implementation (handleExportMemory references `user`)

**Issue:** `useAuthContext` only destructured `isAuthenticated` — `handleExportMemory` needed `user.user_metadata`

**Fix:** Added `user` to the `useAuthContext` destructure: `const { isAuthenticated, user } = useAuthContext()`. The `user` field is already provided by AuthProvider's context shape — no architectural change required.

**Files modified:** app/components/tabs/Account.tsx (line 24)

**Commit:** 84b5a1e

### Tactical: Both tasks in one commit

**Reason:** Both tasks modify the same file (Account.tsx). File was fully implemented and TypeScript-verified in one pass. A single commit with full traceability achieves the same goal as two separate commits for a single-file change.

## Known Stubs

None — all new state and handlers are wired to live Supabase auth calls and real user_metadata fields.

## Threat Surface Scan

No new network endpoints introduced. All writes go through `supabase.auth.updateUser` (existing trust boundary, Supabase RLS enforced). Memory export is client-side only (no server call). No new threat surface beyond what the plan's threat model covers.

## Self-Check: PASSED

- [x] `app/components/tabs/Account.tsx` exists in worktree at correct path
- [x] Commit 84b5a1e exists: `git log --oneline | grep 84b5a1e` confirms
- [x] TypeScript compiles clean
- [x] All plan verification grep checks return expected results
