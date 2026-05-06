---
phase: 01-auth-and-security
plan: 02
status: complete
---

## Plan 02: AuthProvider + Root Layout

### What Was Built

**`app/components/AuthProvider.tsx`** (new)
- `"use client"` context provider
- Exports `AuthContext` with `{ user: User | null, isAuthenticated: boolean, isLoading: boolean }`
- `AuthProvider` accepts `initialUser` prop to seed state from server render (prevents SSR flash)
- `onAuthStateChange` listener keeps client state in sync; `SIGNED_OUT` event pushes to `/login`
- `useAuthContext()` hook for consumers

**`app/layout.tsx`** (modified)
- Made `RootLayout` async
- Calls `await createClient()` then `supabase.auth.getUser()` server-side
- Provider order: `<AuthProvider initialUser={user}><TradesProvider>` — auth wraps trades

### Import Paths
- `import { useAuthContext } from "@/app/components/AuthProvider"`

### TypeScript
`npx tsc --noEmit` — zero errors

### Key Decisions
- Used `getUser()` (not `getSession()`) per RESEARCH.md — validates JWT with Supabase servers
- `initialUser` passed from server to prevent client-side auth flash on first render
