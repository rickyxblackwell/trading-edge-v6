---
phase: 3
slug: stability-and-pwa
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-07
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler + manual browser verification |
| **Config file** | tsconfig.json |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit && npm run build` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit && npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|--------|
| 3-01-01 | 01 | 1 | STABLE-01 | N/A | manual | `npx tsc --noEmit` | ⬜ pending |
| 3-02-01 | 02 | 1 | STABLE-02 | N/A | automated | `npx tsc --noEmit` | ⬜ pending |
| 3-02-02 | 02 | 1 | STABLE-03 | N/A | automated | `npx tsc --noEmit` | ⬜ pending |
| 3-02-03 | 02 | 1 | STABLE-04 | N/A | automated | `npx tsc --noEmit` | ⬜ pending |
| 3-03-01 | 03 | 2 | PWA-01 | N/A | manual | `npm run build` | ⬜ pending |
| 3-03-02 | 03 | 2 | PWA-02 | N/A | automated | `npx tsc --noEmit` | ⬜ pending |
| 3-03-03 | 03 | 2 | PWA-03 | N/A | automated | `npx tsc --noEmit` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements. No new test framework installation needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tab render error shows fallback UI, other tabs work | STABLE-01 | Requires triggering a render error in a tab | Throw error in a tab component, verify fallback renders, switch tabs and verify others work |
| iPhone Add to Home Screen shows correct name/icon | PWA-01 | Requires physical iPhone + Safari | Open app in Safari on iPhone, tap Share > Add to Home Screen, verify icon and name |
| App launches in standalone mode from home screen | PWA-01 | Requires physical iPhone | Tap installed icon, verify no browser chrome, verify notch-safe layout |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
