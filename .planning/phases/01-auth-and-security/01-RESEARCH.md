# Phase 1: Auth & Security - Research

**Researched:** 2026-05-05
**Domain:** Supabase Auth + Next.js 16 App Router SSR session management
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** App is publicly accessible without authentication — Stats, Journal, Strategy, Checklist tabs work with localStorage for unauthenticated users
- **D-02:** Only AI Coach requires an authenticated account — no global auth wall
- **D-03:** Route group `app/(auth)/` with separate `/login` and `/signup` pages
- **D-04:** Full Midnight Market design — no `@supabase/auth-ui-react` components. Build from scratch.
- **D-05:** Signup is 2-step: (1) email/password, (2) Gemini API key (optional/skippable)
- **D-06:** Coach tab shows preview/demo mode for unauthenticated users — sample AI response with "Sign up" CTA. No redirect.
- **D-07:** No redirect when tapping Coach tab while unauthenticated — preview experience is in-tab
- **D-08:** Gemini key stored in **Supabase Auth `user_metadata`** — not localStorage, not request body
- **D-09:** `/api/coach` reads key from Supabase session server-side via `supabase.auth.getUser()`. Key never travels to client.
- **D-10:** `edge_v5_apikey` localStorage key is retired — removed from TradesContext and Coach tab
- **D-11:** Session expiry triggers silent redirect to login via Supabase `onAuthStateChange` listener
- **D-12:** No middleware global redirect — app is publicly accessible. Middleware is not used for page-level auth.
- **D-13:** `/api/coach` has its own independent auth check (reads Supabase session from cookies, returns 401 if absent)
- **D-14:** New route at `app/settings/page.tsx` — not part of 5-tab shell
- **D-15:** Phase 1 settings: Gemini API key entry/update, logout button, account info (email display)
- **D-16:** Export JSON and cache/memory management deferred to Phase 3

### Claude's Discretion

- Exact Supabase client setup pattern (SSR vs client-only) — use Supabase's recommended Next.js App Router approach with `@supabase/ssr`
- Form validation UX on login/signup — standard inline error messages
- Loading states during auth operations — use existing CSS patterns from the design system

### Deferred Ideas (OUT OF SCOPE)

- Export JSON button move to /settings — Phase 3
- Cache/memory management controls — Phase 3
- Password reset email flow — post-Phase-1 patch
- OAuth / social login (Google) — v2 backlog
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can create account with email/password via Supabase Auth | `supabase.auth.signUp()` API verified — see Code Examples section |
| AUTH-02 | User session persists across app restarts | `@supabase/ssr` cookie-based sessions persist across browser restarts — no localStorage dependency |
| AUTH-03 | User can log out from any tab | `supabase.auth.signOut()` called from `AuthProvider`; `onAuthStateChange` triggers UI update globally |
| SEC-01 | Gemini API key stored as server-side env var — never exposed to client | Key stored in `user_metadata` via `updateUser({ data: { gemini_api_key } })`; read server-side via `supabase.auth.getUser()` in route handler only |
| SEC-02 | `/api/coach` returns 401 for unauthenticated requests | Server `createClient()` + `getUser()` guard pattern — returns 401 if `!user` |
</phase_requirements>

---

## Summary

This phase adds Supabase Auth email/password to a Next.js 16 App Router app that currently has no authentication. The critical security change is moving the Gemini API key from client localStorage (currently sent in every `/api/coach` request body) to Supabase `user_metadata`, read exclusively server-side. The app remains publicly accessible — only the Coach tab requires auth.

The `@supabase/ssr` package (not installed yet — must be added) provides `createBrowserClient` for client components and `createServerClient` for server components and route handlers. Session state is managed via HTTP cookies, not localStorage, enabling persistence across browser restarts. An `AuthProvider` client component wraps `TradesProvider` in the root layout, uses `onAuthStateChange` to detect session changes, and exposes `user` and `isAuthenticated` to the component tree.

The most invasive existing-code changes are: (1) removing `apiKey` state from `TradesContext.tsx`, (2) removing the `ApiKeyPanel` inline component from `Coach.tsx` and replacing it with auth-gated behavior, and (3) rewriting `app/api/coach/route.ts` to read the Gemini key from `user.user_metadata.gemini_api_key` server-side instead of accepting it in the request body.

**Primary recommendation:** Install `@supabase/ssr`, create `lib/supabase/client.ts` and `lib/supabase/server.ts` utilities, add `AuthProvider` to layout, then tackle the four integration points (TradesContext, Coach tab, coach route, Settings page) as discrete tasks.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Auth session creation/destruction | API / Supabase Auth | Browser client | Supabase Auth server issues and invalidates tokens |
| Session persistence | Browser cookies (managed by @supabase/ssr) | — | SSR package writes auth token to HTTP cookies automatically |
| Auth state propagation to UI | Frontend client (AuthProvider) | — | React context distributes to all client components |
| Gemini API key storage | Supabase Auth user_metadata | — | Never on client; written via authenticated `updateUser` call |
| Gemini API key retrieval | API / Backend (route handler) | — | `getUser()` called server-side in `/api/coach`; key never sent to browser |
| Coach tab gate (public preview) | Browser / Client | — | `isAuthenticated` boolean from AuthProvider context |
| 401 enforcement on /api/coach | API / Backend | — | `createServerClient` + `getUser()` in route handler |
| Login/signup forms | Browser / Client | — | Client components with `createBrowserClient` |
| Settings page | Browser / Client + API | — | Client reads `user.email`; updates `user_metadata` via `updateUser()` |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.105.3 (already installed) | Supabase client — auth, database, realtime | Official Supabase JS SDK |
| `@supabase/ssr` | 0.10.2 (NOT installed — must add) | SSR-safe cookie session management for Next.js App Router | Required for server components + route handlers to read auth session |

**Version verification:** `npm view @supabase/ssr version` → `0.10.2` [VERIFIED: npm registry]. `npm view @supabase/supabase-js version` → `2.105.3` [VERIFIED: npm registry].

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | ^1.14.0 (already installed) | Icons for auth screens (Eye, EyeOff, ChevronLeft, KeyRound, LogOut, Sparkles, Mail) | Icon source per UI-SPEC.md |
| `next/navigation` | (Next.js built-in) | `useRouter()` for redirects after login/logout | Client components only |
| `cookies()` from `next/headers` | (Next.js built-in) | Cookie store access in server components and route handlers | Server-side client creation |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@supabase/ssr` | `@supabase/auth-helpers-nextjs` | auth-helpers is DEPRECATED — Supabase has moved all development to `@supabase/ssr`. Never use auth-helpers for new projects. |
| `user_metadata` for Gemini key | Dedicated `profiles` table in Postgres | Table approach is more scalable for many custom fields but requires Supabase database setup (Phase 2 concern). `user_metadata` is correct for a single user-supplied secret. |

**Installation:**
```bash
npm install @supabase/ssr
```

---

## Architecture Patterns

### System Architecture Diagram

```
Browser                         Next.js Server                  Supabase Cloud
──────                          ─────────────                   ──────────────
[Login form]
    │ signInWithPassword()
    │────────────────────────────────────────────────────────> [Auth service]
    │                                                               │
    │ <── Set-Cookie: sb-*-auth-token ──────────────────────────────┘
    │
[AuthProvider]
  onAuthStateChange ◄── SIGNED_IN / SIGNED_OUT events
    │
    ▼ updates React context
[Coach.tsx, Settings.tsx, etc.]
    │ isAuthenticated = true/false
    │
    │ POST /api/coach (cookies auto-sent by browser)
    │──────────────────────────────────────>
                                           [route.ts]
                                           createServerClient(cookies())
                                           getUser() ──────────────────> [Auth service]
                                                        <────────────── user + user_metadata
                                           user_metadata.gemini_api_key
                                           GoogleGenAI({ apiKey })
                                           <── JSON response

[Settings page]
    │ updateUser({ data: { gemini_api_key } })
    │────────────────────────────────────────────────────────> [Auth service]
    │                              stores in raw_user_meta_data
    │ <── Updated user object
```

### Recommended File Structure

```
app/
├── (auth)/                      # Route group — no shared layout with main app
│   ├── login/
│   │   └── page.tsx             # Login form — "use client"
│   └── signup/
│       └── page.tsx             # 2-step signup — "use client"
├── settings/
│   └── page.tsx                 # Settings page — "use client"
├── api/
│   └── coach/
│       └── route.ts             # MODIFIED — add auth guard, remove apiKey from body
├── lib/
│   ├── supabase/                # NEW subdirectory
│   │   ├── client.ts            # NEW — createBrowserClient utility
│   │   └── server.ts            # NEW — createServerClient utility (async)
│   ├── TradesContext.tsx        # MODIFIED — remove apiKey state, edge_v5_apikey
│   └── types.ts                 # MODIFIED — add AuthUser type (optional)
├── components/
│   ├── AuthProvider.tsx         # NEW — "use client", wraps app with auth context
│   └── tabs/
│       └── Coach.tsx            # MODIFIED — auth-gated, remove ApiKeyPanel
├── layout.tsx                   # MODIFIED — add AuthProvider wrapping TradesProvider
└── page.tsx                     # MODIFIED — account icon in nav bar
```

**Note on path alias:** `tsconfig.json` maps `@/*` to `./*` (project root). So `lib/supabase/server.ts` is imported as `@/lib/supabase/server` (NOT `@/app/lib/supabase/server`). The top-level `lib/` directory already exists with `lib/utils.ts`.

### Pattern 1: Server Utility — `lib/supabase/server.ts`

**What:** Async factory that creates a `createServerClient` with Next.js cookie store.
**When to use:** Any server component, route handler, or server action that needs Supabase.

```typescript
// lib/supabase/server.ts
// Source: @supabase/ssr Context7 docs [VERIFIED: /supabase/ssr]
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from Server Component — cookies cannot be set.
            // This is safe to ignore if a middleware handles session refresh.
          }
        },
      },
    }
  )
}
```

**Note on env vars:** The Supabase dashboard is transitioning from `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Older projects still use the `ANON_KEY` naming. [ASSUMED] — confirm which format your Supabase project dashboard shows. Either works; pick one and use it consistently across both client.ts and server.ts.

### Pattern 2: Browser Client Utility — `lib/supabase/client.ts`

**What:** Singleton-pattern browser client for use in `"use client"` components.
**When to use:** Login form, signup form, AuthProvider, Settings page.

```typescript
// lib/supabase/client.ts
// Source: @supabase/ssr Context7 docs [VERIFIED: /supabase/ssr]
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
// createBrowserClient already implements singleton pattern internally —
// calling createClient() multiple times returns the same instance.
```

### Pattern 3: AuthProvider Component — `app/components/AuthProvider.tsx`

**What:** Client component that holds auth state and broadcasts changes via React context.
**When to use:** Wraps app shell in `layout.tsx`; consumed wherever `isAuthenticated` or `user` is needed.

```typescript
// app/components/AuthProvider.tsx
// Source: adapted from dev.to verified pattern [CITED: dev.to/jais_mukesh/managing-supabase-auth-state]
"use client"

import { createContext, useContext, useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
})

export function useAuthContext() {
  return useContext(AuthContext)
}

export function AuthProvider({
  children,
  initialUser,
}: {
  children: React.ReactNode
  initialUser: User | null
}) {
  const [user, setUser] = useState<User | null>(initialUser)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    setUser(initialUser)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null)
        if (event === "SIGNED_OUT") {
          router.push("/login")
        }
        // SIGNED_IN and TOKEN_REFRESHED handled automatically by @supabase/ssr cookies
      }
    )

    return () => subscription.unsubscribe()
  }, [initialUser])

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}
```

**Root layout integration** — `layout.tsx` must become an async server component to fetch `initialUser`:

```typescript
// app/layout.tsx — modified
import { createClient } from "@/lib/supabase/server"
import { AuthProvider } from "./components/AuthProvider"
import { TradesProvider } from "./lib/TradesContext"

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <html lang="en" className={cn(inter.variable, ibmPlexMono.variable, "font-sans", geist.variable)}>
      <body className="h-dvh overflow-hidden">
        <AuthProvider initialUser={user}>
          <TradesProvider>
            {children}
          </TradesProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
```

### Pattern 4: Auth Guard in Route Handler

**What:** Read auth session and Gemini key in `/api/coach/route.ts` using server client.
**When to use:** Any API route that requires authentication.

```typescript
// app/api/coach/route.ts — auth guard section (replaces apiKey body param logic)
// Source: @supabase/ssr Context7 verified [VERIFIED: /supabase/ssr]
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  // Auth check — must happen before reading body
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const geminiApiKey = user.user_metadata?.gemini_api_key as string | undefined
  if (!geminiApiKey || geminiApiKey.length < 10) {
    return NextResponse.json(
      { error: "No Gemini API key configured. Add one in Settings." },
      { status: 403 }
    )
  }

  // Rest of existing handler — replace apiKey from body with geminiApiKey
  const body = await req.json()
  const { message, mode, trades, history, patternSummary, strategyText, sessionId } = body
  // ... existing Gemini logic using geminiApiKey instead of apiKey
}
```

**Critical:** `getUser()` contacts the Supabase Auth server to validate the token on every call. This is correct for authorization. `getSession()` reads from cookies without server validation — do NOT use it for authorization decisions. [VERIFIED: /supabase/ssr CookieMethodsServer JSDoc]

### Pattern 5: Email/Password Auth Operations

**What:** Exact API calls for each auth operation using the browser client.

```typescript
// Source: Supabase official docs [CITED: supabase.com/docs/reference/javascript]

const supabase = createClient() // from lib/supabase/client.ts

// SIGNUP
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password',
  options: {
    data: {
      // optional: store initial metadata at signup time
      // gemini_api_key is set in Step 2 via updateUser instead
    }
  }
})
// data.user = created user; data.session = null if email confirmation enabled

// LOGIN
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password',
})
// data.user, data.session populated on success

// LOGOUT
const { error } = await supabase.auth.signOut()
// triggers onAuthStateChange SIGNED_OUT event

// GET CURRENT USER (client-side)
const { data: { user }, error } = await supabase.auth.getUser()

// SESSION LISTENER
const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
  // event: INITIAL_SESSION | SIGNED_IN | SIGNED_OUT | TOKEN_REFRESHED | USER_UPDATED
  // session: Session | null
})
// cleanup: subscription.unsubscribe()
```

### Pattern 6: Storing and Reading Gemini API Key

```typescript
// STORE key in user_metadata (client-side, authenticated user)
// Source: Supabase docs v1 auth-update [CITED: supabase.com/docs/reference/javascript/v1/auth-update]
const { data, error } = await supabase.auth.updateUser({
  data: { gemini_api_key: 'AIza...' }
})
// Stored at: user.user_metadata.gemini_api_key

// READ key on server (route handler)
const { data: { user } } = await supabase.auth.getUser()
const geminiApiKey = user?.user_metadata?.gemini_api_key as string | undefined

// READ key on client (for masked display in Settings)
const { data: { user } } = await supabase.auth.getUser()
const maskedKey = user?.user_metadata?.gemini_api_key
  ? 'AIza••••' + (user.user_metadata.gemini_api_key as string).slice(-4)
  : null
```

**Parameter name:** The `data` key (not `user_metadata`) is what you pass to `updateUser()`. Supabase stores it at `user.user_metadata`. This is the client-settable metadata (stored in `raw_user_meta_data` column in `auth.users`). `app_metadata` is admin-only and cannot be set by users. [VERIFIED via docs pattern + dev.to source]

### Anti-Patterns to Avoid

- **Using `getSession()` for authorization:** Returns unverified cookie data. Always use `getUser()` in route handlers — it validates the token against the Supabase Auth server on each call.
- **Creating server client in a global variable:** `createServerClient` must be created fresh per request (each request has its own cookie store). Never cache it in module scope.
- **Sending Gemini key in request body:** Current Coach.tsx sends `apiKey` in the POST body. This must be removed. The key is now read server-side only.
- **Using `@supabase/auth-helpers-nextjs`:** Deprecated. Use `@supabase/ssr` exclusively.
- **Reading `user_metadata` from the client for sensitive data:** The key can technically be read client-side since it's in the user object. This is acceptable for display purposes (masked) but should never be forwarded to third-party APIs from the client.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cookie-based session persistence | Custom cookie handling | `@supabase/ssr` `createServerClient` + `createBrowserClient` | Handles token refresh, PKCE flow, secure cookie attributes |
| JWT validation on server | Manual JWT decode/verify | `supabase.auth.getUser()` | Validates against Supabase's public keys; handles token expiry |
| Auth state sync across tab/window | Custom BroadcastChannel or polling | `supabase.auth.onAuthStateChange()` | Supabase client handles cross-tab sync internally |
| PKCE code verifier storage | Manual sessionStorage | Built into `@supabase/ssr` `createBrowserClient` | Managed automatically |
| Password strength validation | Custom regex | Simple length check (8+/12+ chars as per UI-SPEC) | UI-SPEC specifies the exact rules |

**Key insight:** Session management in SSR has subtle edge cases around token refresh, cookie paths, and CDN caching. The `@supabase/ssr` package encapsulates years of fixes for these. The only custom code needed is the cookie `getAll`/`setAll` wiring.

---

## Common Pitfalls

### Pitfall 1: `@supabase/ssr` Not Installed

**What goes wrong:** Build fails with "Cannot find module '@supabase/ssr'". The package is in `package.json` for `@supabase/supabase-js` but NOT for `@supabase/ssr`.
**Why it happens:** `@supabase/supabase-js` and `@supabase/ssr` are separate packages. Checking `package.json` confirms `@supabase/ssr` is absent.
**How to avoid:** First task must be `npm install @supabase/ssr`. Verified: NOT in `package.json`, NOT in `node_modules/@supabase/`. [VERIFIED: codebase grep]

### Pitfall 2: `cookies()` API Requires Await in Next.js 16

**What goes wrong:** TypeScript error or runtime warning: `cookies()` returns a Promise in Next.js 15+.
**Why it happens:** Next.js 15 made `cookies()` from `next/headers` async.
**How to avoid:** Always `await cookies()` in `server.ts`. The pattern in Code Examples already does this.

### Pitfall 3: Supabase `getUser()` Called Outside Server Context

**What goes wrong:** `createServerClient` created without cookie store (e.g., in a `"use client"` component) — it can't read the session cookie.
**How to avoid:** `lib/supabase/server.ts` is for server components and route handlers ONLY. Client components use `lib/supabase/client.ts` (`createBrowserClient`).

### Pitfall 4: Session Not Visible to Server After Client-Side Login

**What goes wrong:** User logs in via the browser client (login form), but the server-side route handler still returns 401.
**Why it happens:** The browser client writes the auth cookie to `document.cookie`, which IS sent on subsequent requests. This should work correctly with `@supabase/ssr`. The pitfall is when developers mix the old `createClientComponentClient` (from deprecated auth-helpers) which uses localStorage instead of cookies.
**How to avoid:** Use ONLY `@supabase/ssr` functions — never import from `@supabase/auth-helpers-nextjs`.

### Pitfall 5: Email Confirmation Blocks Immediate Login

**What goes wrong:** Signup returns `{ user, session: null }` — user exists but can't log in because email is unconfirmed.
**Why it happens:** Supabase projects have "Confirm email" enabled by default.
**How to avoid:** For development, disable "Confirm email" in Supabase Dashboard > Authentication > Providers > Email. For production, implement email confirmation flow (deferred to patch). Document this in Wave 0 setup instructions.

### Pitfall 6: `TradesContext` Still Exposes `apiKey` After Removal

**What goes wrong:** TypeScript errors cascade through Coach.tsx and anywhere `apiKey` is read from `useTrades()`.
**Why it happens:** `TradesContext` currently exports `apiKey: string` and `setApiKey`. Coach.tsx reads both. Settings page previously would have read both.
**How to avoid:** Remove `apiKey`, `setApiKey`, `APIKEY_KEY`, and `edge_v5_apikey` localStorage write from TradesContext in one atomic change. Simultaneously update Coach.tsx to use `useAuthContext()` instead. TypeScript strict mode will flag any remaining references. [VERIFIED: TradesContext.tsx lines 8, 47, 55, 93-96; Coach.tsx lines 298, 303, 319, 413, 415, 421, 451, 456, 488, 506]

### Pitfall 7: Route Group `(auth)` Layout Conflicts

**What goes wrong:** Auth pages inherit the root layout and show the 5-tab shell or TradesProvider wrapping.
**Why it happens:** Without its own layout.tsx, `app/(auth)/` uses the root layout.
**How to avoid:** Create `app/(auth)/layout.tsx` as a minimal layout (just html/body + ambient orbs) so login and signup pages are standalone screens without the app shell. The `(auth)` route group does NOT affect URL paths.

### Pitfall 8: Sending Gemini Key in Request Body (Security Regression)

**What goes wrong:** During refactor, developer copies the old request pattern and still sends `apiKey` in the POST body.
**Why it happens:** Coach.tsx currently sends `apiKey` in the JSON body at line 339 of the existing code.
**How to avoid:** Remove `apiKey` from the `JSON.stringify` body in Coach.tsx at the same time as removing it from TradesContext. The route handler no longer reads it from `body`.

---

## Code Examples

### Login Page — Core Form Handler

```typescript
// app/(auth)/login/page.tsx — key handler logic
// Source: supabase.com auth-email guide [CITED: supabase.com/docs/guides/auth/auth-email]
"use client"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    const { error } = await supabase.auth.signInWithPassword({
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    })
    if (error) {
      setError("Invalid email or password. Please try again.")
      setLoading(false)
    } else {
      router.push("/")
      router.refresh() // force server component re-render with new session
    }
  }
}
```

**Note:** `router.refresh()` after successful login forces Next.js to re-run the root layout server component, which calls `supabase.auth.getUser()` again and passes the updated `initialUser` to `AuthProvider`. Without this, the server-rendered user would stay null until next page load.

### Signup — 2-Step with Gemini Key

```typescript
// Step 1: Create account
const { data, error } = await supabase.auth.signUp({ email, password })
if (error) { /* handle */ return }
// data.user is created; data.session may be null if email confirm is on

// Step 2: Store Gemini key (if provided)
// Called after signUp, using same browser client session
const { error: updateError } = await supabase.auth.updateUser({
  data: { gemini_api_key: geminiKey.trim() }
})
// On skip: do nothing — key remains absent from user_metadata
// Navigate to "/" after either path
router.push("/")
router.refresh()
```

### Settings — Update API Key

```typescript
// app/settings/page.tsx — save key handler
const supabase = createClient()
const { error } = await supabase.auth.updateUser({
  data: { gemini_api_key: newKey.trim() }
})
if (!error) {
  // show 2-second success state per UI-SPEC
  setShowSuccess(true)
  setTimeout(() => { setShowSuccess(false); setExpanded(false) }, 2000)
}
```

### Settings — Read Email + Masked Key

```typescript
// Read user on component mount
useEffect(() => {
  const supabase = createClient()
  supabase.auth.getUser().then(({ data: { user } }) => {
    setEmail(user?.email ?? "")
    const key = user?.user_metadata?.gemini_api_key as string | undefined
    setMaskedKey(key ? `AIza••••${key.slice(-4)}` : null)
  })
}, [])
```

### Logout Handler

```typescript
// Called from Settings logout button or any component
const supabase = createClient()
const { error } = await supabase.auth.signOut()
// onAuthStateChange fires SIGNED_OUT → AuthProvider pushes to /login
// No manual router.push() needed if using AuthProvider pattern
```

### TradesContext — Removing apiKey (diff view)

Lines to REMOVE from `app/lib/TradesContext.tsx`:
- Line 8: `const APIKEY_KEY = "edge_v5_apikey"`
- Line 26: `apiKey: string`
- Line 27: `setApiKey: (k: string) => void`
- Line 47: `const [apiKey, setApiKeyState] = useState("")`
- Line 55: `setApiKeyState(readLS<string>(APIKEY_KEY, ""))`
- Lines 93-96: entire `setApiKey` callback
- Line 111: `apiKey, setApiKey` from Provider value
The `ExportPackage` interface and other state remains unchanged.

### Coach.tsx — Auth-Gated Behavior

```typescript
// Replace apiKey-based gating with auth context
import { useAuthContext } from "@/app/components/AuthProvider"

function ChatView() {
  const { isAuthenticated, user } = useAuthContext()
  const { trades, coachingHistory, addCoachingEntry, patternSummary, updatePatternSummary } = useTrades()
  // Remove: apiKey, setApiKey from useTrades() destructuring

  // In sendMessage: remove apiKey check, remove apiKey from fetch body
  const res = await fetch("/api/coach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: text, mode, trades: trades.slice(0, 20),
      history: coachingHistory.slice(-5),
      patternSummary, strategyText: ..., sessionId: genSessionId(),
      // apiKey: REMOVED
    }),
  })
}
```

If `!isAuthenticated`: render `<PreviewCoachView />` instead of `<ChatView />`.

---

## Runtime State Inventory

> Not a rename/refactor phase in the traditional sense, but there are localStorage keys that must be retired.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data (localStorage) | `edge_v5_apikey` — stores Gemini API key in plain text in browser storage | Remove from TradesContext hydration and persistence; do NOT migrate to Supabase in Phase 1 (key will be re-entered via Settings) |
| Stored data (localStorage) | `edge_v5_trades`, `edge_v5_coaching_history`, `edge_v5_pattern_summary`, `edge_v5_strategy_text` | Untouched in Phase 1 — migration is Phase 2 |
| Live service config | None | — |
| OS-registered state | None | — |
| Secrets/env vars | `.env.local` does not exist yet — must be created with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Wave 0 setup task |
| Build artifacts | None | — |

**User impact of `edge_v5_apikey` retirement:** Existing users (dev only at this stage) will need to re-enter their Gemini API key via the `/settings` page after Phase 1 ships. This is acceptable — no migration required.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@supabase/ssr` npm package | Auth SSR pattern | NOT installed | — (latest: 0.10.2) | None — must install |
| Supabase project (URL + anon key) | All auth operations | Unknown — env vars not set | — | None — must configure before execution |
| Node.js | Build | Available | (project already builds) | — |
| npm | Package install | Available | (project has package-lock.json) | — |

**Missing dependencies with no fallback:**
- `@supabase/ssr` package: `npm install @supabase/ssr` — Wave 0 task
- `.env.local` with Supabase credentials: Must be created with real project URL/key — Wave 0 setup task

**Missing dependencies with fallback:**
- None

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None currently installed (no jest/vitest/playwright found) |
| Config file | None — Wave 0 gap |
| Quick run command | `npx tsc --noEmit` (TypeScript type-check, always required per CLAUDE.md) |
| Full suite command | `npx tsc --noEmit` (Phase 1 only — no test framework) |

**Note:** CLAUDE.md mandates `npx tsc --noEmit` must pass before any phase is marked complete. This is the primary validation gate. No automated test framework is installed; per `nyquist_validation: true`, the Wave 0 gap is to establish baseline TypeScript clean compile.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | User creates account with email/password | manual-smoke | `npx tsc --noEmit` (type gate) | — |
| AUTH-02 | Session persists across browser restart | manual-smoke | `npx tsc --noEmit` | — |
| AUTH-03 | Logout works from any tab | manual-smoke | `npx tsc --noEmit` | — |
| SEC-01 | Gemini key absent from client bundle/network | manual-audit | DevTools network tab, `grep -r "gemini_api_key" .next/` | — |
| SEC-02 | `/api/coach` returns 401 without auth | automated-curl | `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/coach -H "Content-Type: application/json" -d '{}'` → must return `401` | ❌ Wave 0 |

**Manual-only justification for AUTH-01–03:** These require an active Supabase project and browser interaction. TypeScript strict compilation provides the automated confidence gate.

### Sampling Rate

- **Per task commit:** `npx tsc --noEmit`
- **Per wave merge:** `npx tsc --noEmit` + curl test for SEC-02
- **Phase gate:** Both above pass + manual login/logout flow tested in browser before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `.env.local` — `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` values (requires Supabase project)
- [ ] `npm install @supabase/ssr` — package not installed
- [ ] Supabase Dashboard — "Confirm email" setting documented (enable or disable based on dev preference)
- [ ] TypeScript baseline: `npx tsc --noEmit` must pass before Phase 1 work begins (currently passes per CLAUDE.md)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth email/password; `getUser()` server-side validation |
| V3 Session Management | yes | `@supabase/ssr` cookie-based sessions; HTTP-only cookies set by Supabase |
| V4 Access Control | yes | `/api/coach` 401 guard via `getUser()`; coach tab gated by `isAuthenticated` |
| V5 Input Validation | yes | Email format (`type="email"`), password minimum length (8 chars per UI-SPEC), Gemini key prefix `AIza` check |
| V6 Cryptography | no | Passwords hashed by Supabase Auth server (bcrypt); no custom crypto |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Gemini key exposure in network requests | Information Disclosure | Remove key from POST body; read from `user_metadata` server-side only |
| Gemini key in client bundle | Information Disclosure | Key stored in Supabase DB (`raw_user_meta_data`), never in env vars or source code |
| Session fixation | Elevation of Privilege | Supabase Auth rotates session tokens on each sign-in |
| CSRF on `/api/coach` | Tampering | Supabase session cookie is `SameSite=Lax` by default; plus auth check validates session |
| Unauthenticated AI API calls | Elevation of Privilege | `getUser()` guard at route handler entry; returns 401 before any Gemini call |
| localStorage key theft (XSS) | Information Disclosure | `edge_v5_apikey` being retired — key moves to HttpOnly cookies via Supabase |
| JWT tampering | Tampering | `getUser()` validates JWT against Supabase's public keys (not just decodes) |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 | auth-helpers deprecated; all SSR auth must use `@supabase/ssr` |
| `createClientComponentClient` | `createBrowserClient` from `@supabase/ssr` | 2024 | Same function, new package |
| `createServerComponentClient` | `createServerClient` from `@supabase/ssr` | 2024 | Requires explicit cookie `getAll`/`setAll` |
| `getSession()` for server auth | `getUser()` for server auth | 2024-2025 | `getSession()` returns unverified data; `getUser()` validates token server-side |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 2025 (transitional) | Supabase rebranding "anon" to "publishable"; both work |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: Fully deprecated. Do not use.
- `supabase.auth.getSession()` for authorization: Insecure for server-side auth decisions.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Supabase project env var is `NEXT_PUBLIC_SUPABASE_ANON_KEY` (not `PUBLISHABLE_KEY`) | Standard Stack, Code Examples | Client factory won't connect; easy fix once project is configured |
| A2 | "Confirm email" will be disabled in Supabase dashboard during development | Common Pitfalls #5 | Signup succeeds but session is null; login fails until email confirmed. Low risk — easy to toggle. |
| A3 | `updateUser({ data: { gemini_api_key } })` merges into existing `user_metadata` (does not replace other fields) | Code Examples | If it replaces, multiple metadata fields would need to be passed together on each update. Test with a console log in Settings before relying on it. |

**If this table is empty:** It's not — confirm A1 and A2 during Wave 0 setup.

---

## Open Questions (RESOLVED)

1. **Supabase Project Credentials** — RESOLVED: Wave 0 checkpoint (Plan 01-01 Task 1) handles this as a human-action step. Executor creates `.env.local` with real credentials before any auth code is tested.

2. **Email Confirmation Preference** — RESOLVED: Disable email confirmation in the Supabase Dashboard (Auth > Email Provider > Confirm email: OFF) during Phase 1 development. Re-enable before production. This is noted in the Plan 01-01 checkpoint.

3. **Settings Page Access — Account Icon Placement** — RESOLVED: Settings page lives at `app/settings/page.tsx`. The app shell (`app/page.tsx`) gets a `UserCircle` icon link to `/settings` — added to the bottom of the sidebar (desktop) and bottom bar (mobile) by Plan 01-06. Standard Next.js App Router route, no tab state involved.

---

## Sources

### Primary (HIGH confidence)

- `@supabase/ssr` — Context7 `/supabase/ssr` — `createBrowserClient`, `createServerClient`, `CookieMethodsServer` type, cookie handling
- Supabase docs — Context7 `/websites/supabase` — `signUp`, `signInWithPassword`, `signOut`, `updateUser`, `onAuthStateChange`
- Supabase JS v1 auth-update docs — `updateUser({ data: {...} })` pattern and `user_metadata` access path

### Secondary (MEDIUM confidence)

- [Supabase SSR Next.js Guide](https://supabase.com/docs/guides/auth/server-side/nextjs) — proxy/middleware pattern, `getClaims()` vs `getSession()` security guidance
- [Supabase Creating a Client](https://supabase.com/docs/guides/auth/server-side/creating-a-client) — `createClient()` file structure pattern
- [Managing Auth State in Next.js](https://dev.to/jais_mukesh/managing-supabase-auth-state-across-server-client-components-in-nextjs-2h2b) — `AuthProvider` pattern with `initialUser` prop and `onAuthStateChange`

### Tertiary (LOW confidence)

- None — all claims verified via Context7 or official Supabase docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — packages verified via npm registry, patterns verified via Context7
- Architecture: HIGH — derived from official @supabase/ssr docs and verified code patterns
- Existing code integration: HIGH — source files read directly; line-level specifics noted
- Pitfalls: HIGH — most derived from official docs security guidance and verified code inspection

**Research date:** 2026-05-05
**Valid until:** 2026-06-05 (Supabase APIs are stable; @supabase/ssr minor version bumps unlikely to break patterns)
