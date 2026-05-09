---
title: CONVENTIONS.md
focus: quality
generated: 2026-05-05
---

# Conventions

## TypeScript

- **Strict mode** — `tsconfig.json` has `strict: true`
- **Interfaces over types** for object shapes (`Trade`, `CoachingEntry`, `TradesContextValue`)
- **Type exports** from `app/lib/types.ts` — single source of truth, no inline type definitions in components
- **No `any`** — errors caught via `err instanceof Error` pattern
- **Union types** for constrained strings: `"long" | "short"`, `"win" | "loss" | "breakeven"`, `TabId`
- `useCallback` on all context mutation functions to prevent referential churn

## React

- `"use client"` on every component that uses hooks or browser APIs — all 5 tab components are client
- **Context pattern:** Context created at module level → Provider exports `TradesProvider` → hook `useTrades()` throws if used outside provider
- **Hydration guard:** `hydrated` boolean state prevents writing to localStorage before mount — avoids SSR mismatch
- No `useMemo` observed — optimization left to future phases
- No `React.memo` — not yet needed

## File Naming

- Tab components: `PascalCase.tsx` matching tab ID (e.g. `Strategy.tsx`, `Coach.tsx`)
- Utilities/context: `PascalCase.tsx` or `camelCase.ts`
- Route handlers: Next.js convention `route.ts`
- CSS: single `globals.css` at `app/` root — no CSS modules

## CSS / Styling

- **Tailwind CSS v4** — utility classes for layout, spacing, responsiveness
- **CSS custom properties** for all colors and design tokens — no hardcoded hex values in TSX
- **No `transition: all`** — only targeted properties (`transform 0.18s ease, box-shadow 0.18s ease`)
- **IBM Plex Mono** on every numeric/data value — applied via `font-family: 'IBM Plex Mono'` or `.mono` class
- **Glass panels** via `backdrop-filter: blur(12px)` + rgba tint + 1px solid border
- `env(safe-area-inset-*)` used for mobile safe area padding
- `100dvh` for full-viewport height (not `100vh`)
- Minimum 44px tap targets on interactive elements

## Design Token Usage

All colors via CSS custom properties:
```
var(--bg) var(--bg2) var(--bg3)          — backgrounds
var(--glass) var(--glass-md)             — glass tints
var(--border) var(--border-accent)       — borders
var(--accent) var(--accent2) var(--accent3) — brand colors
var(--green) var(--red) var(--yellow) var(--purple) — semantic colors
var(--text) var(--text2) var(--text3)    — text hierarchy
```

## Comments Policy

No explanatory comments — code is self-documenting via naming. Comments only for non-obvious WHY (workarounds, invariants, constraints). Inline SVG icons are defined directly in JSX without comments.

## Exports

- Default exports for page-level components (`export default function App()`)
- Named exports for context providers and hooks (`export function TradesProvider`, `export function useTrades`)
- Type exports from `types.ts` without default
