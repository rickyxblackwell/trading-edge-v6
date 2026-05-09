# Technology Stack

**Analysis Date:** 2026-05-05

## Languages

**Primary:**
- TypeScript 5.x - All app code (`app/**/*.ts`, `app/**/*.tsx`)

**Secondary:**
- CSS (custom properties / Tailwind v4) - `app/globals.css`

## Runtime

**Environment:**
- Node.js (LTS) — Next.js server runtime

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- Next.js 16.2.4 - App Router, React Server Components, API routes
- React 19.2.4 - UI rendering
- React DOM 19.2.4 - DOM binding

**Build/Dev:**
- Next.js built-in Turbopack/Webpack - bundler (default Next.js 16 setup)
- PostCSS 8.x with `@tailwindcss/postcss` plugin - CSS processing (`postcss.config.mjs`)
- `postcss-100vh-fix` 1.0.2 - iOS 100vh bug workaround (`postcss.config.mjs`)
- ESLint 9.x with `eslint-config-next` 16.2.4 - linting (`eslint` script)

**CSS:**
- Tailwind CSS 4.x - utility classes, configured via PostCSS plugin (not tailwind.config.js — v4 uses CSS-first config)
- `tw-animate-css` 1.4.0 - animation utilities
- `tailwind-merge` 3.5.0 - conditional class merging without conflicts

## Key Dependencies

**Critical:**
- `@google/genai` 1.52.0 - Gemini 2.5 Flash SDK, used in `app/api/coach/route.ts`
- `@supabase/supabase-js` 2.49.4 - Supabase client (installed, not yet wired — future persistence phase)
- `recharts` 2.15.3 - equity curve chart and P&L visualizations in `app/components/tabs/Stats.tsx`
- `zod` 4.4.3 - schema validation (installed; usage extent TBD)

**UI:**
- `lucide-react` 1.14.0 - icon set
- `@base-ui/react` 1.4.1 - headless UI primitives
- `glasscn-ui` 0.7.1 - glass-morphism component variants
- `shadcn` 4.6.0 - component CLI/library
- `class-variance-authority` 0.7.1 - variant-based class composition
- `clsx` 2.1.1 - conditional class joining

**Integrations:**
- `@21st-sdk/agent` 0.0.18 - 21st.dev agent SDK (magic MCP integration)

## Configuration

**TypeScript:**
- Config: `tsconfig.json`
- Strict mode: enabled (`"strict": true`)
- Target: ES2017
- Module resolution: `bundler` (Next.js 16 style)
- Path alias: `@/*` → `./*` (repo root)
- No emit: `"noEmit": true` — type-check only via `npx tsc --noEmit`

**Next.js:**
- Config: `next.config.ts` — minimal, no custom options set

**PostCSS:**
- Config: `postcss.config.mjs`
- Plugins: `@tailwindcss/postcss`, `postcss-100vh-fix`

**Environment:**
- `.env.local` — contains `GEMINI_API_KEY` (user-supplied at runtime via UI, not server env) and future Supabase keys
- Note: Gemini API key is passed client→server in POST body, not stored as server env var

## Platform Requirements

**Development:**
- Node.js LTS
- `npm run dev` — starts Next.js dev server

**Production:**
- `npm run build` + `npm run start`
- Target deployment: Vercel (standard Next.js 16 App Router)
- PWA target: iPhone 17 Pro (393×852pt), iOS Safari

---

*Stack analysis: 2026-05-05*
