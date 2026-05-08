---
phase: 03-stability-and-pwa
plan: "03"
subsystem: pwa
tags: [pwa, manifest, ios, icons, next.js]
dependency_graph:
  requires: []
  provides: [pwa-manifest, ios-apple-touch-icon, pwa-icons]
  affects: [app/manifest.ts, app/layout.tsx, public/]
tech_stack:
  added: [sharp (icon generation script — dev only)]
  patterns: [Next.js MetadataRoute.Manifest convention, Next.js metadata.icons.apple]
key_files:
  created:
    - app/manifest.ts
    - public/icon-192x192.png
    - public/icon-512x512.png
    - public/apple-icon-180x180.png
  modified:
    - app/layout.tsx
decisions:
  - "Used sharp (already available) for PNG generation — canvas not available in this environment"
  - "Placeholder icons are 1-color dark-navy squares (192x192, 512x512, 180x180); final art deferred to Phase 5"
  - "#060b14 hex values in manifest.ts are the only sanctioned exception to no-hardcoded-hex rule — JSON spec fields cannot reference CSS variables"
  - "PWA-03 (strategyText reactive state) confirmed already complete — no code changes needed"
metrics:
  duration: "<2 minutes"
  completed_date: "2026-05-08"
  tasks_completed: 2
  files_changed: 5
requirements_fulfilled:
  - PWA-01
  - PWA-02
  - PWA-03
---

# Phase 03 Plan 03: PWA Manifest and iOS Icons Summary

**One-liner:** Next.js TypeScript manifest (MetadataRoute.Manifest) + apple-touch-icon metadata + three placeholder dark-navy PNGs for iPhone home screen install.

## What Was Built

### Task 1: app/manifest.ts + app/layout.tsx icons.apple (commit 3021657)

Created `app/manifest.ts` using the Next.js App Router file convention — Next.js auto-serves it at `/manifest.webmanifest`. The manifest includes:
- `name: "Trading Edge"` and `short_name: "Trading Edge"`
- `display: "standalone"` (correct for iOS PWA; fullscreen is not well-supported)
- `background_color: "#060b14"` and `theme_color: "#060b14"` (matches `--bg` design token)
- Two icon entries: 192x192 (standard) and 512x512 with `purpose: "maskable"` for Android

Updated `app/layout.tsx` metadata export to add `icons.apple` pointing to `/apple-icon-180x180.png`. Next.js renders this as `<link rel="apple-touch-icon">` in the HTML head automatically.

### Task 2: Placeholder PWA icon PNGs (commit 0020462)

Generated three valid PNG placeholder icons in `public/` using sharp:
- `public/icon-192x192.png` (192x192, RGB)
- `public/icon-512x512.png` (512x512, RGB)
- `public/apple-icon-180x180.png` (180x180, RGB)

All are dark-navy (`#060b14`) solid-color squares. Final icon art to be swapped in Phase 5 without any code changes.

**PWA-03 verification:** `strategyText` is already a `useState` in TradesContext with `updateStrategyText` callback and a `useEffect` syncing to localStorage. Confirmed complete — no code changes needed.

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS (0 errors) |
| `app/manifest.ts` exists | PASS |
| Manifest has `"Trading Edge"` x2 | PASS |
| Manifest has `"standalone"` | PASS |
| Manifest has `"#060b14"` x2 | PASS |
| Icon file references in manifest | PASS |
| `apple-icon-180x180.png` in layout.tsx | PASS |
| `public/icon-192x192.png` valid PNG | PASS (192x192, 8-bit RGB) |
| `public/icon-512x512.png` valid PNG | PASS (512x512, 8-bit RGB) |
| `public/apple-icon-180x180.png` valid PNG | PASS (180x180, 8-bit RGB) |
| PWA-03: `updateStrategyText` >= 2 occurrences | PASS (3 found) |
| PWA-03: `strategyText.*useState` | PASS (1 found) |

## Deviations from Plan

None — plan executed exactly as written.

The plan anticipated that `canvas` might not be available and provided `sharp` as the primary alternative. Sharp was available and used as designed. No architectural changes were needed.

## Known Stubs

The three PNG icon files are intentional placeholders — solid dark-navy squares with no "TE" text (canvas was unavailable for text rendering). These are tracked for replacement in Phase 5. They are valid PNG files that will prevent browser 404 errors on the manifest icon URLs.

| Stub | File | Reason |
|------|------|--------|
| Solid-color placeholder icon | public/icon-192x192.png | Final art deferred to Phase 5; sharp used instead of canvas (canvas unavailable) |
| Solid-color placeholder icon | public/icon-512x512.png | Final art deferred to Phase 5 |
| Solid-color placeholder icon | public/apple-icon-180x180.png | Final art deferred to Phase 5 |

## Threat Surface Scan

No new security-relevant surface introduced. All changes are:
- Static file convention (app/manifest.ts — served by Next.js, no user input)
- Static metadata export (app/layout.tsx — no dynamic content)
- Static binary assets in public/ (PNG files — no dynamic content)

This matches the plan's threat model exactly (T-03-03-01: accept, T-03-03-02: accept).

## Self-Check: PASSED

- `app/manifest.ts`: FOUND
- `public/icon-192x192.png`: FOUND
- `public/icon-512x512.png`: FOUND
- `public/apple-icon-180x180.png`: FOUND
- Commit 3021657: FOUND
- Commit 0020462: FOUND
- TypeScript: clean (0 errors)
- PWA-03 verified: updateStrategyText count = 3 (>= 2 required)
