---
phase: 01-auth-and-security
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/supabase/client.ts
  - lib/supabase/server.ts
  - .env.local
autonomous: false
requirements:
  - AUTH-01
  - AUTH-02
  - AUTH-03
  - SEC-01
  - SEC-02

must_haves:
  truths:
    - "@supabase/ssr is installed and importable"
    - "lib/supabase/client.ts exports createClient() using createBrowserClient"
    - "lib/supabase/server.ts exports async createClient() using createServerClient with awaited cookies()"
    - ".env.local contains NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY placeholders"
    - "npx tsc --noEmit passes after these files are created"
  artifacts:
    - path: "lib/supabase/client.ts"
      provides: "Browser Supabase client factory"
      exports: ["createClient"]
    - path: "lib/supabase/server.ts"
      provides: "Server Supabase client factory (async, cookie-aware)"
      exports: ["createClient"]
    - path: ".env.local"
      provides: "Environment variable template"
      contains: "NEXT_PUBLIC_SUPABASE_URL"
  key_links:
    - from: "lib/supabase/client.ts"
      to: "@supabase/ssr"
      via: "createBrowserClient import"
      pattern: "createBrowserClient"
    - from: "lib/supabase/server.ts"
      to: "next/headers"
      via: "await cookies()"
      pattern: "await cookies"

user_setup:
  - service: supabase
    why: "Auth session management — URL and anon key required before any auth code runs"
    env_vars:
      - name: NEXT_PUBLIC_SUPABASE_URL
        source: "Supabase Dashboard → Project Settings → API → Project URL"
      - name: NEXT_PUBLIC_SUPABASE_ANON_KEY
        source: "Supabase Dashboard → Project Settings → API → Project API keys → anon (public)"
    dashboard_config:
      - task: "Disable email confirmation for development"
        location: "Supabase Dashboard → Authentication → Providers → Email → Confirm email: OFF"
---

<objective>
Install @supabase/ssr and create the two Supabase client utilities that every other plan in this phase depends on.

Purpose: All auth operations — server-side session reads, client-side login/logout, and route handler auth checks — require these factory functions. They must exist before AuthProvider, auth pages, or the route handler guard can be implemented.

Output: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `.env.local` template, `@supabase/ssr` installed in node_modules.
</objective>

<execution_context>
@/Users/richardblackwell/.claude/get-shit-done/workflows/execute-plan.md
@/Users/richardblackwell/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/richardblackwell/Trading App Full-Stack V6/.planning/ROADMAP.md
@/Users/richardblackwell/Trading App Full-Stack V6/.planning/phases/01-auth-and-security/01-RESEARCH.md
@/Users/richardblackwell/Trading App Full-Stack V6/.planning/phases/01-auth-and-security/01-SPEC.md

<interfaces>
<!-- Key contracts the executor needs. From package.json and @supabase/ssr docs. -->

From @supabase/ssr (to be installed):
```typescript
import { createBrowserClient } from '@supabase/ssr'
import { createServerClient } from '@supabase/ssr'

// createBrowserClient implements singleton pattern internally.
// createServerClient requires explicit cookie getAll/setAll wiring.
```

From next/headers (Next.js 16 built-in — cookies() is async):
```typescript
import { cookies } from 'next/headers'
// MUST be awaited: const cookieStore = await cookies()
```

Path alias (from tsconfig.json — @/* maps to project root):
// lib/supabase/server.ts is imported as @/lib/supabase/server
// NOT @/app/lib/supabase/server
// The root lib/ directory already exists (contains lib/utils.ts)
</interfaces>
</context>

<tasks>

<task type="checkpoint:human-action">
  <name>Task 1: Supabase project setup and package install</name>
  <what-built>This task requires human action before automated code can run. The Supabase URL, anon key, and @supabase/ssr package are all missing and cannot be created by Claude.</what-built>
  <how-to-verify>
    1. If you do not have a Supabase project yet: go to https://supabase.com → New project → create one. Takes ~2 minutes.
    2. In Supabase Dashboard → Project Settings → API, copy:
       - Project URL (looks like: https://xxxxxxxxxxxx.supabase.co)
       - anon (public) key (long JWT string)
    3. In Supabase Dashboard → Authentication → Providers → Email: set "Confirm email" to OFF (required for dev — otherwise signup returns session: null)
    4. Create the file `.env.local` in the project root with your real values:
       ```
       NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
       NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
       ```
    5. Run in terminal: `npm install @supabase/ssr`
    6. Confirm install succeeded: `node -e "require('@supabase/ssr')" && echo OK`
  </how-to-verify>
  <resume-signal>Type "ready" once .env.local is populated and `npm install @supabase/ssr` has completed successfully</resume-signal>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create Supabase client utilities</name>
  <files>lib/supabase/client.ts, lib/supabase/server.ts</files>
  <behavior>
    - client.ts: calling createClient() returns a Supabase browser client instance
    - client.ts: calling createClient() twice returns the same singleton (handled by createBrowserClient internally)
    - server.ts: createClient() is async and returns a Supabase server client
    - server.ts: cookies() is awaited before being passed to createServerClient
    - server.ts: setAll silently swallows errors (called from Server Components where cookies cannot be set)
    - Both files: use NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY env vars
    - Both files: use the non-null assertion operator (!) — env vars are guaranteed present via .env.local
  </behavior>
  <action>
    Create lib/supabase/ directory and both files as specified below.

    IMPORTANT PATH NOTE: The @/* alias maps to the project root, not app/. These files live at
    lib/supabase/ (sibling to app/) and are imported as @/lib/supabase/client and @/lib/supabase/server.
    The root lib/ directory already exists (it contains lib/utils.ts from shadcn scaffold).

    --- lib/supabase/client.ts ---
    Create with this exact content:
    ```typescript
    import { createBrowserClient } from '@supabase/ssr'

    export function createClient() {
      return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
    }
    ```
    No singleton wrapper needed — createBrowserClient handles this internally.

    --- lib/supabase/server.ts ---
    Create with this exact content:
    ```typescript
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
                // setAll called from Server Component where cookies cannot be set.
                // Safe to ignore — middleware handles session refresh if needed.
              }
            },
          },
        }
      )
    }
    ```
  </action>
  <verify>
    <automated>cd "/Users/richardblackwell/Trading App Full-Stack V6" && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>Both files exist. `npx tsc --noEmit` passes with no errors. `lib/supabase/client.ts` exports `createClient` using `createBrowserClient`. `lib/supabase/server.ts` exports async `createClient` using `createServerClient` with `await cookies()`.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| env → server runtime | NEXT_PUBLIC_* vars are embedded in client bundle — anon key is public by design. Secret keys must never be NEXT_PUBLIC_. |
| cookie store → server client | createServerClient reads auth tokens from HTTP cookies — all session trust flows through here |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-01 | Information Disclosure | NEXT_PUBLIC_SUPABASE_ANON_KEY | accept | Anon key is intentionally public — Supabase Row Level Security policies control what it can access. Never put secret service role key in NEXT_PUBLIC_. |
| T-01-02 | Tampering | lib/supabase/server.ts cookie wiring | mitigate | Use createServerClient from @supabase/ssr exclusively — never roll custom cookie handling. The setAll try/catch is required per Supabase SSR docs. |
</threat_model>

<verification>
- `npx tsc --noEmit` passes
- `lib/supabase/client.ts` exists and contains `createBrowserClient`
- `lib/supabase/server.ts` exists and contains `await cookies()` and `createServerClient`
- `.env.local` exists with real (non-placeholder) Supabase URL and anon key
- `node_modules/@supabase/ssr` directory exists
</verification>

<success_criteria>
Both client utilities are created and TypeScript-clean. The @supabase/ssr package is installed. Environment variables are populated. Every subsequent plan in this phase can import from @/lib/supabase/client or @/lib/supabase/server without issue.
</success_criteria>

<output>
After completion, create `.planning/phases/01-auth-and-security/01-01-SUMMARY.md` documenting:
- Package version installed (@supabase/ssr)
- Exact import paths for both utilities
- Confirmation that TypeScript passes
- Note whether NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY was used (Supabase is transitioning naming)
</output>
---
phase: 01-auth-and-security
plan: 02
type: execute
wave: 2
depends_on: ["01-01"]
files_modified:
  - app/components/AuthProvider.tsx
  - app/layout.tsx
autonomous: true
requirements:
  - AUTH-02
  - AUTH-03
  - AUTH-01

must_haves:
  truths:
    - "AuthProvider wraps TradesProvider in the root layout"
    - "AuthProvider receives initialUser from server-side getUser() call in layout.tsx"
    - "onAuthStateChange listener fires when auth state changes and updates React context"
    - "SIGNED_OUT event triggers router.push('/login')"
    - "useAuthContext() hook is exported and returns { user, isAuthenticated, isLoading }"
    - "layout.tsx is an async server component"
    - "npx tsc --noEmit passes"
  artifacts:
    - path: "app/components/AuthProvider.tsx"
      provides: "Auth context provider and useAuthContext hook"
      exports: ["AuthProvider", "useAuthContext"]
    - path: "app/layout.tsx"
      provides: "Root layout — async, wraps children with AuthProvider(initialUser) + TradesProvider"
      contains: "async function RootLayout"
  key_links:
    - from: "app/layout.tsx"
      to: "lib/supabase/server"
      via: "createClient() + getUser()"
      pattern: "supabase.auth.getUser"
    - from: "app/components/AuthProvider.tsx"
      to: "lib/supabase/client"
      via: "createClient() in useEffect"
      pattern: "onAuthStateChange"
    - from: "app/layout.tsx"
      to: "app/components/AuthProvider"
      via: "AuthProvider initialUser={user}"
      pattern: "AuthProvider"
---

<objective>
Create the AuthProvider client component and wire it into the root layout so auth state is available throughout the component tree.

Purpose: Every component that needs to know if a user is authenticated (Coach tab, Settings page) reads from AuthContext. The layout must call getUser() server-side to avoid a flash of unauthenticated state on initial load.

Output: `app/components/AuthProvider.tsx` (context + hook), modified `app/layout.tsx` (async, wraps with AuthProvider).
</objective>

<execution_context>
@/Users/richardblackwell/.claude/get-shit-done/workflows/execute-plan.md
@/Users/richardblackwell/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/richardblackwell/Trading App Full-Stack V6/.planning/phases/01-auth-and-security/01-RESEARCH.md
@/Users/richardblackwell/Trading App Full-Stack V6/app/layout.tsx
@/Users/richardblackwell/Trading App Full-Stack V6/.planning/phases/01-auth-and-security/01-01-SUMMARY.md

<interfaces>
<!-- Contracts the executor needs. Extracted from existing files and Plan 01 output. -->

From lib/supabase/server.ts (created in Plan 01):
```typescript
export async function createClient(): Promise<SupabaseClient>
// Usage: const supabase = await createClient()
// Then: const { data: { user } } = await supabase.auth.getUser()
```

From lib/supabase/client.ts (created in Plan 01):
```typescript
export function createClient(): SupabaseClient
// Usage in "use client" components only
```

From @supabase/supabase-js (already installed):
```typescript
import type { User } from '@supabase/supabase-js'
// User type includes: id, email, user_metadata, etc.
```

Existing app/layout.tsx structure (to be modified):
```typescript
// Currently: sync function, wraps only with TradesProvider
export default function RootLayout({ children }) {
  return (
    <html ...>
      <body>
        <TradesProvider>{children}</TradesProvider>
      </body>
    </html>
  )
}
// Must become: async function, adds AuthProvider wrapping TradesProvider
```

AuthProvider interface (defined in this plan):
```typescript
interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
}
export function useAuthContext(): AuthContextValue
export function AuthProvider({ children, initialUser }: {
  children: React.ReactNode
  initialUser: User | null
}): JSX.Element
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create AuthProvider component</name>
  <files>app/components/AuthProvider.tsx</files>
  <action>
    Create app/components/AuthProvider.tsx as a "use client" component.

    This component:
    1. Creates a React context with { user, isAuthenticated, isLoading }
    2. Accepts initialUser from the server (prevents flash of unauth state on load)
    3. Sets up onAuthStateChange listener to track live session changes
    4. On SIGNED_OUT event: calls router.push("/login") for D-11 (silent redirect)
    5. Exports useAuthContext() hook for consumers

    The isLoading initial value is false (not true) because initialUser is already known from SSR.
    Setting it to true would cause a loading flash that defeats the purpose of passing initialUser.

    ```typescript
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
      isLoading: false,
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

        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
          setUser(session?.user ?? null)
          if (event === "SIGNED_OUT") {
            router.push("/login")
          }
          // SIGNED_IN and TOKEN_REFRESHED handled automatically by @supabase/ssr cookies
        })

        return () => subscription.unsubscribe()
      }, [initialUser])

      return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading }}>
          {children}
        </AuthContext.Provider>
      )
    }
    ```

    Note: The eslint dependency array warning for `supabase` and `router` can be suppressed with
    // eslint-disable-next-line react-hooks/exhaustive-deps
    on the useEffect line if the project has exhaustive-deps rule enabled.
    Alternatively, wrap `supabase` in useMemo if TypeScript or linting requires it. Prefer the
    simpler form first — check if tsc passes.
  </action>
  <verify>
    <automated>cd "/Users/richardblackwell/Trading App Full-Stack V6" && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>File exists at app/components/AuthProvider.tsx. Exports AuthProvider and useAuthContext. TypeScript passes.</done>
</task>

<task type="auto">
  <name>Task 2: Make layout.tsx async and wrap with AuthProvider</name>
  <files>app/layout.tsx</files>
  <action>
    Modify app/layout.tsx to:
    1. Add `async` keyword to RootLayout function
    2. Import createClient from @/lib/supabase/server
    3. Import AuthProvider from ./components/AuthProvider
    4. Call createClient() and getUser() before the return statement
    5. Wrap TradesProvider with AuthProvider, passing initialUser={user}

    The existing font setup, metadata, viewport, and className structure must be preserved exactly.
    Only changes: async keyword, two new imports, the getUser() call, and the AuthProvider wrapper.

    Final layout.tsx:
    ```typescript
    import type { Metadata, Viewport } from "next"
    import { Inter, IBM_Plex_Mono, Geist } from "next/font/google"
    import { TradesProvider } from "./lib/TradesContext"
    import { AuthProvider } from "./components/AuthProvider"
    import { createClient } from "@/lib/supabase/server"
    import "./globals.css"
    import { cn } from "@/lib/utils"

    const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

    const inter = Inter({
      subsets: ["latin"],
      variable: "--font-inter",
      display: "swap",
    })

    const ibmPlexMono = IBM_Plex_Mono({
      subsets: ["latin"],
      weight: ["400", "500", "600"],
      variable: "--font-ibm-plex-mono",
      display: "swap",
    })

    export const metadata: Metadata = {
      title: "TRADING EDGE",
      description: "Prop futures trading journal & AI coaching",
      appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: "TRADING EDGE",
      },
    }

    export const viewport: Viewport = {
      width: "device-width",
      initialScale: 1,
      viewportFit: "cover",
      themeColor: "#060b14",
    }

    export default async function RootLayout({
      children,
    }: {
      children: React.ReactNode
    }) {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

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

    CRITICAL: getUser() is used (not getSession()). getUser() validates the JWT against Supabase
    Auth servers. getSession() reads cookie data without server validation — do NOT use it here.
  </action>
  <verify>
    <automated>cd "/Users/richardblackwell/Trading App Full-Stack V6" && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>layout.tsx is async. Imports AuthProvider and server createClient. Calls getUser() server-side. Wraps children with AuthProvider(initialUser=user) containing TradesProvider. TypeScript passes.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| server → AuthProvider | initialUser is derived from getUser() (server-validated JWT) — safe to trust |
| AuthProvider → children | isAuthenticated boolean gates UI only — API routes have independent auth checks |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-01 | Spoofing | app/layout.tsx getUser() | mitigate | Use getUser() not getSession() — validates token against Supabase Auth server on every layout render, preventing stale/forged cookie attacks |
| T-02-02 | Elevation of Privilege | AuthProvider isAuthenticated | accept | isAuthenticated gates UI only (D-02). Actual privilege enforcement is in /api/coach route handler (Plan 03). UI gate is defense-in-depth, not the security boundary. |
| T-02-03 | Denial of Service | layout.tsx getUser() call | accept | One network call per server render is acceptable. Supabase Auth is highly available. No caching of user object between requests (intentional — ensures fresh state). |
</threat_model>

<verification>
- `npx tsc --noEmit` passes
- `app/components/AuthProvider.tsx` exports both `AuthProvider` and `useAuthContext`
- `app/layout.tsx` is async and calls `supabase.auth.getUser()`
- `app/layout.tsx` wraps children with `<AuthProvider initialUser={user}><TradesProvider>`
- SIGNED_OUT event in AuthProvider triggers `router.push("/login")`
</verification>

<success_criteria>
Auth state is available throughout the component tree via useAuthContext(). The root layout provides the initial user state from the server, preventing a flash of unauthenticated content on load. Session expiry will silently redirect to /login per D-11.
</success_criteria>

<output>
After completion, create `.planning/phases/01-auth-and-security/01-02-SUMMARY.md` documenting:
- AuthProvider interface (exported types)
- How initialUser is passed from layout to provider
- Confirmation TypeScript passes
- Note any eslint suppression applied if needed
</output>
---
phase: 01-auth-and-security
plan: 03
type: execute
wave: 2
depends_on: ["01-01"]
files_modified:
  - app/api/coach/route.ts
  - app/lib/TradesContext.tsx
autonomous: true
requirements:
  - SEC-01
  - SEC-02

must_haves:
  truths:
    - "/api/coach returns 401 when no valid Supabase session is present"
    - "/api/coach returns 403 when authenticated but no Gemini key in user_metadata"
    - "apiKey is no longer read from the POST request body"
    - "Gemini key is read from user.user_metadata.gemini_api_key server-side only"
    - "TradesContext no longer contains apiKey state, setApiKey, or APIKEY_KEY"
    - "edge_v5_apikey localStorage key is no longer read or written"
    - "npx tsc --noEmit passes"
  artifacts:
    - path: "app/api/coach/route.ts"
      provides: "Auth-guarded Gemini proxy"
      contains: "getUser"
    - path: "app/lib/TradesContext.tsx"
      provides: "Trades/coaching state without API key management"
  key_links:
    - from: "app/api/coach/route.ts"
      to: "lib/supabase/server"
      via: "createClient() + getUser()"
      pattern: "supabase.auth.getUser"
    - from: "app/api/coach/route.ts"
      to: "user.user_metadata"
      via: "geminiApiKey read after getUser()"
      pattern: "user_metadata.gemini_api_key"
---

<objective>
Apply the highest-priority security fix: move Gemini API key out of the request body and into server-side user_metadata, and add a 401 auth guard to /api/coach.

Purpose: Currently the Gemini API key travels in every POST body to /api/coach — visible in network DevTools to anyone. This plan eliminates that exposure entirely (SEC-01) and blocks unauthenticated access (SEC-02). These two changes are the core security deliverable of the entire phase.

Output: Modified `app/api/coach/route.ts` (auth guard + key from user_metadata), modified `app/lib/TradesContext.tsx` (apiKey state removed).
</objective>

<execution_context>
@/Users/richardblackwell/.claude/get-shit-done/workflows/execute-plan.md
@/Users/richardblackwell/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/richardblackwell/Trading App Full-Stack V6/.planning/phases/01-auth-and-security/01-RESEARCH.md
@/Users/richardblackwell/Trading App Full-Stack V6/app/api/coach/route.ts
@/Users/richardblackwell/Trading App Full-Stack V6/app/lib/TradesContext.tsx
@/Users/richardblackwell/Trading App Full-Stack V6/.planning/phases/01-auth-and-security/01-01-SUMMARY.md

<interfaces>
<!-- What the executor needs to know before writing code. -->

From lib/supabase/server.ts (Plan 01):
```typescript
export async function createClient(): Promise<SupabaseClient>
// Auth guard pattern:
// const supabase = await createClient()
// const { data: { user }, error: authError } = await supabase.auth.getUser()
// if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
// const geminiApiKey = user.user_metadata?.gemini_api_key as string | undefined
```

From existing app/api/coach/route.ts (lines to change):
```typescript
// LINE 75 — REMOVE apiKey from destructuring:
const { message, mode, trades, history, patternSummary, strategyText, apiKey, sessionId } = body
// Replace with (body read AFTER auth check):
const { message, mode, trades, history, patternSummary, strategyText, sessionId } = body

// LINES 77-79 — REPLACE apiKey check with auth guard:
// OLD:
if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 10) {
  return NextResponse.json({ error: "Invalid API key" }, { status: 401 })
}
// NEW: Auth guard first, then key check (see Task 1 action for full pattern)

// LINE 88 — UPDATE GoogleGenAI instantiation:
// OLD: const ai = new GoogleGenAI({ apiKey: apiKey.trim() })
// NEW: const ai = new GoogleGenAI({ apiKey: geminiApiKey })
```

From existing TradesContext.tsx (lines to REMOVE):
- Line 8:  const APIKEY_KEY = "edge_v5_apikey"
- Line 26: apiKey: string  (from TradesContextValue interface)
- Line 27: setApiKey: (k: string) => void  (from TradesContextValue interface)
- Line 47: const [apiKey, setApiKeyState] = useState("")
- Line 55: setApiKeyState(readLS<string>(APIKEY_KEY, ""))
- Lines 93-96: the entire setApiKey callback
- Line 111: apiKey, setApiKey  from Provider value object
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add auth guard to /api/coach and read key from user_metadata</name>
  <files>app/api/coach/route.ts</files>
  <action>
    Modify app/api/coach/route.ts to:
    1. Import createClient from @/lib/supabase/server at the top
    2. At the start of the POST handler (BEFORE reading the body), add the auth check
    3. Read geminiApiKey from user.user_metadata.gemini_api_key (not from body)
    4. Remove apiKey from body destructuring
    5. Replace all uses of apiKey with geminiApiKey in the handler

    The body.apiKey parameter must be completely removed — do not read it even as a fallback.

    New POST handler start:
    ```typescript
    export async function POST(req: NextRequest) {
      try {
        // Auth check — before reading body (D-13, SEC-02)
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const geminiApiKey = user.user_metadata?.gemini_api_key as string | undefined
        if (!geminiApiKey || geminiApiKey.trim().length < 10) {
          return NextResponse.json(
            { error: "No Gemini API key configured. Add one in Settings." },
            { status: 403 }
          )
        }

        const body = await req.json()
        // Remove apiKey from destructuring — it is no longer accepted from client
        const { message, mode, trades, history, patternSummary, strategyText, sessionId } = body

        // Rate limiting (unchanged — uses sessionId from body)
        const sid = (sessionId as string) || "default"
        const last = lastCallTime.get(sid) || 0
        if (Date.now() - last < RATE_LIMIT_MS) {
          return NextResponse.json({ error: "Rate limited — wait 15 seconds" }, { status: 429 })
        }
        lastCallTime.set(sid, Date.now())

        // Use geminiApiKey (from user_metadata) instead of apiKey (from body)
        const ai = new GoogleGenAI({ apiKey: geminiApiKey.trim() })
        // ... rest of handler unchanged
    ```

    Keep everything else in the handler unchanged:
    - STRATEGY_SYSTEM constant
    - buildTradesSummary function
    - lastCallTime Map and RATE_LIMIT_MS
    - useGrounding logic
    - Gemini API call and response parsing
    - TITLE and PATTERN SUMMARY UPDATE extraction
    - Error handling at the bottom

    The import line to add at the top of the file:
    ```typescript
    import { createClient } from "@/lib/supabase/server"
    ```
  </action>
  <verify>
    <automated>cd "/Users/richardblackwell/Trading App Full-Stack V6" && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>route.ts imports createClient from @/lib/supabase/server. POST handler calls getUser() before reading body. Returns 401 if no user. Returns 403 if no gemini_api_key. apiKey parameter is not present in body destructuring. GoogleGenAI is instantiated with geminiApiKey from user_metadata. TypeScript passes.</done>
</task>

<task type="auto">
  <name>Task 2: Remove apiKey state from TradesContext</name>
  <files>app/lib/TradesContext.tsx</files>
  <action>
    Remove all API key management from TradesContext. This is an atomic change — do all
    removals together to avoid intermediate TypeScript errors.

    Lines to REMOVE (reference the existing file):
    - `const APIKEY_KEY = "edge_v5_apikey"` (line ~8)
    - `apiKey: string` from TradesContextValue interface (line ~26)
    - `setApiKey: (k: string) => void` from TradesContextValue interface (line ~27)
    - `const [apiKey, setApiKeyState] = useState("")` (line ~47)
    - `setApiKeyState(readLS<string>(APIKEY_KEY, ""))` in hydration useEffect (line ~55)
    - The entire `setApiKey` useCallback block (lines ~93-96):
      ```typescript
      const setApiKey = useCallback((k: string) => {
        setApiKeyState(k)
        localStorage.setItem(APIKEY_KEY, k)
      }, [])
      ```
    - `apiKey, setApiKey,` from the Provider value object (line ~111)

    The `edge_v5_apikey` localStorage key is RETIRED — do not rename it, do not migrate it,
    do not add any code that reads or writes it. Users will re-enter their key via /settings.

    Do NOT remove:
    - TRADES_KEY, COACHING_KEY, PATTERN_KEY constants
    - Any other state (trades, coachingHistory, patternSummary)
    - The ExportPackage interface
    - importData callback
    - Any other callbacks

    After removal, the TradesContextValue interface should look like:
    ```typescript
    interface TradesContextValue {
      trades: Trade[]
      addTrade: (t: Trade) => void
      deleteTrade: (id: string) => void
      coachingHistory: CoachingEntry[]
      addCoachingEntry: (e: CoachingEntry) => void
      updateCoachingEntry: (id: string, updates: Partial<CoachingEntry>) => void
      importData: (pkg: ExportPackage) => void
      patternSummary: string
      updatePatternSummary: (s: string) => void
    }
    ```

    NOTE: Coach.tsx currently reads `apiKey` and `setApiKey` from useTrades(). After this change,
    those destructured names will cause TypeScript errors in Coach.tsx. This is expected and
    intentional — Plan 05 fixes Coach.tsx. Do not fix Coach.tsx in this task; the TypeScript
    error here is a placeholder until Plan 05 runs.

    However, if TypeScript errors in Coach.tsx prevent the build from completing, add a temporary
    comment `// TODO: Plan 05 removes apiKey from Coach.tsx` and a type cast if needed, then
    proceed. The verify step below uses tsc only on TradesContext.tsx to isolate the check.
  </action>
  <verify>
    <automated>cd "/Users/richardblackwell/Trading App Full-Stack V6" && npx tsc --noEmit 2>&1 | grep -v "Coach.tsx" | head -20</automated>
  </verify>
  <done>TradesContext.tsx contains no reference to APIKEY_KEY, apiKey, setApiKey, or edge_v5_apikey. TradesContextValue interface does not include apiKey or setApiKey. TypeScript errors in Coach.tsx are expected (fixed in Plan 05) — all other files pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client POST body → route handler | Body is untrusted input — apiKey no longer accepted from body |
| Supabase Auth → route handler | getUser() result is trusted after server-side JWT validation |
| user_metadata → Gemini API | geminiApiKey travels server-to-server only, never to browser |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-03-01 | Information Disclosure | Gemini API key in POST body | mitigate | Key removed from body entirely — read from user.user_metadata server-side after getUser() validation. Key never travels client→server. |
| T-03-02 | Elevation of Privilege | /api/coach unauthenticated access | mitigate | getUser() guard at route entry returns 401 before any body parsing. No API calls made for unauthenticated requests. |
| T-03-03 | Tampering | sessionId rate limit bypass | accept | sessionId is still client-supplied (existing behavior). Rate limiting by userId rather than sessionId is a Phase 2 hardening item — acceptable for Phase 1 since auth guard prevents anonymous abuse. |
| T-03-04 | Information Disclosure | edge_v5_apikey in localStorage | mitigate | No longer written or read. Existing values remain in browser storage but are inert — the route handler ignores them. Key is now in Supabase user_metadata (httpOnly cookie path). |
</threat_model>

<verification>
- `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/coach -H "Content-Type: application/json" -d '{}'` returns `401` (run with dev server active)
- `grep -n "apiKey" app/api/coach/route.ts` shows no occurrence of reading apiKey from body
- `grep -n "user_metadata" app/api/coach/route.ts` shows geminiApiKey read from user_metadata
- `grep -n "apiKey\|APIKEY_KEY\|edge_v5_apikey" app/lib/TradesContext.tsx` returns no matches
</verification>

<success_criteria>
The Gemini API key is no longer visible in browser network requests. /api/coach returns 401 without a valid Supabase session. The key travels server-to-server only. SEC-01 and SEC-02 are satisfied.
</success_criteria>

<output>
After completion, create `.planning/phases/01-auth-and-security/01-03-SUMMARY.md` documenting:
- Exact changes made to route.ts (what was added/removed)
- Exact changes made to TradesContext.tsx
- Result of 401 curl test (include the command and output)
- Note which TypeScript errors remain (Coach.tsx — intentional, fixed in Plan 05)
</output>
---
phase: 01-auth-and-security
plan: 04
type: execute
wave: 3
depends_on: ["01-02"]
files_modified:
  - app/(auth)/layout.tsx
  - app/(auth)/login/page.tsx
  - app/(auth)/signup/page.tsx
autonomous: true
requirements:
  - AUTH-01
  - AUTH-02

must_haves:
  truths:
    - "Visiting /login shows the Midnight Market login screen without the 5-tab shell"
    - "Visiting /signup shows the Midnight Market 2-step signup without the 5-tab shell"
    - "Login form calls signInWithPassword, on success navigates to / and calls router.refresh()"
    - "Signup step 1 creates account with signUp, step 2 calls updateUser with gemini_api_key"
    - "Step 2 can be skipped — navigates to / without saving a key"
    - "Error messages match copywriting contract exactly"
    - "Password show/hide toggle works on all password fields"
    - "npx tsc --noEmit passes"
  artifacts:
    - path: "app/(auth)/layout.tsx"
      provides: "Standalone auth layout — ambient orbs, no app shell"
    - path: "app/(auth)/login/page.tsx"
      provides: "Login form — email/password, sign in, error states"
    - path: "app/(auth)/signup/page.tsx"
      provides: "2-step signup — account creation, Gemini key entry"
  key_links:
    - from: "app/(auth)/login/page.tsx"
      to: "lib/supabase/client"
      via: "createClient().auth.signInWithPassword"
      pattern: "signInWithPassword"
    - from: "app/(auth)/signup/page.tsx"
      to: "lib/supabase/client"
      via: "createClient().auth.signUp then updateUser"
      pattern: "signUp"
---

<objective>
Create the auth route group with login and signup pages matching the Midnight Market design contract.

Purpose: Users need a way to create accounts and log in. The route group (auth) keeps these pages isolated from the main app shell — they render without the 5-tab nav.

Output: `app/(auth)/layout.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`.
</objective>

<execution_context>
@/Users/richardblackwell/.claude/get-shit-done/workflows/execute-plan.md
@/Users/richardblackwell/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/richardblackwell/Trading App Full-Stack V6/.planning/phases/01-auth-and-security/01-UI-SPEC.md
@/Users/richardblackwell/Trading App Full-Stack V6/.planning/phases/01-auth-and-security/01-RESEARCH.md
@/Users/richardblackwell/Trading App Full-Stack V6/app/globals.css
@/Users/richardblackwell/Trading App Full-Stack V6/.planning/phases/01-auth-and-security/01-02-SUMMARY.md

<interfaces>
<!-- Key patterns for auth pages. -->

From lib/supabase/client.ts (Plan 01):
```typescript
export function createClient(): SupabaseClient
// Browser-side only. Use in "use client" components.
```

Auth operations (from @supabase/supabase-js — already installed):
```typescript
// LOGIN
const { error } = await supabase.auth.signInWithPassword({ email, password })
// On success: router.push("/"); router.refresh() — refresh forces layout getUser() re-run

// SIGNUP
const { data, error } = await supabase.auth.signUp({ email, password })
// data.user = created user. data.session may be null if email confirm is enabled.

// STORE KEY after signup (step 2)
const { error } = await supabase.auth.updateUser({
  data: { gemini_api_key: key.trim() }
})
// Then: router.push("/"); router.refresh()
```

CSS classes available from app/globals.css:
- `.ambient-bg` / `.orb.orb-1`, `.orb-2`, `.orb-3` — ambient background (reuse exactly)
- `.glass` / `.glass-md` — glass surface with backdrop-filter and border
- `.mono` — IBM Plex Mono font
- `.label-upper` — 10px Inter 600 uppercase tracking-widest
- `.btn-accent` — gradient accent button (check if this class exists; if not, apply inline styles per UI-SPEC)

Exact error copy (from UI-SPEC Copywriting Contract):
- Wrong credentials: "Invalid email or password. Please try again."
- Network error: "Connection failed. Check your internet and try again."
- Email in use: "An account with this email already exists. Sign in instead?"
- Password mismatch: "Passwords do not match."
- Weak password: "Password must be at least 8 characters."
- API key format: "API keys start with 'AIza'. Double-check your key."
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Auth layout and login page</name>
  <files>app/(auth)/layout.tsx, app/(auth)/login/page.tsx</files>
  <action>
    Create the route group directory app/(auth)/ and both files.

    --- app/(auth)/layout.tsx ---
    Minimal layout that renders auth pages WITHOUT the 5-tab shell or TradesProvider.
    Must include ambient orbs so the glass card sits over the animated background.

    ```typescript
    export default function AuthLayout({ children }: { children: React.ReactNode }) {
      return (
        <div style={{ minHeight: "100dvh", position: "relative" }}>
          <div className="ambient-bg" aria-hidden="true">
            <div className="orb orb-1" />
            <div className="orb orb-2" />
            <div className="orb orb-3" />
          </div>
          {children}
        </div>
      )
    }
    ```

    This is a Server Component (no "use client"). It only wraps children in the orb background.

    --- app/(auth)/login/page.tsx ---
    "use client" — interactive form.

    Layout: flex column, min-height 100dvh, items-center, justify-center.
    Padding: env(safe-area-inset-top) 16px env(safe-area-inset-bottom) 16px.

    Glass card: max-width 400px, width calc(100%-32px), centered.
    Glass card styles (per UI-SPEC):
    - background: var(--glass-md)
    - backdropFilter: blur(14px) saturate(160%)
    - border: 1px solid var(--border)
    - borderRadius: 20px
    - boxShadow: 0 8px 32px rgba(0,0,0,0.3), inset 0 0.5px 0 rgba(255,255,255,0.1)
    - padding: 32px desktop / 24px mobile (use CSS, not JS breakpoints)

    Card entry animation: slideUp (opacity 0→1, translateY 24px→0, 0.35s ease).
    Apply via CSS class from globals.css if `fade-up` or `slideUp` class exists; otherwise
    use inline style + CSS animation via a className with `@keyframes` in globals.css.
    Respect prefers-reduced-motion.

    Wordmark (per UI-SPEC):
    - Accent bar: 6px × 20px rounded-full, background var(--accent), box-shadow glow
    - Text: "TRADING EDGE", IBM Plex Mono 13px weight 600, letter-spacing 0.2em uppercase

    Form fields (per UI-SPEC):
    - Label: 10px Inter 600 uppercase, color var(--text2), letter-spacing 0.08em, mb 6px
    - Input: height 48px, full width, border-radius 12px, background rgba(255,255,255,0.04),
      border 1px solid var(--border), padding 0 16px, Inter 14px, color var(--text)
    - Focus state: border-color rgba(56,189,248,0.45), box-shadow 0 0 0 2px rgba(56,189,248,0.08)
    - Error state: border-color rgba(248,113,113,0.5), box-shadow 0 0 0 2px rgba(248,113,113,0.08)
    - Password toggle: lucide Eye/EyeOff, 16px, right side of input, color var(--text2)

    Sign in button (per UI-SPEC):
    - height 48px, width 100%, border-radius 12px
    - background: linear-gradient(to bottom, #38bdf8, #0ea5e9)
    - boxShadow: 0 1px 24px rgba(56,189,248,0.25)
    - color: var(--bg) — dark text on light button
    - Inter 15px weight 600
    - Loading state: Loader2 spinner (lucide), button disabled opacity 0.7
    - Disabled when fields empty: opacity 0.5, cursor not-allowed

    Error display: lucide AlertCircle 12px + "Invalid email or password. Please try again."
    in 12px IBM Plex Mono, color var(--red). Below the password field.

    Footer link: "No account? Create one →" — span + <Link href="/signup"> styled as accent

    Form submit handler:
    ```typescript
    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
      e.preventDefault()
      setLoading(true)
      setError(null)
      const formData = new FormData(e.currentTarget)
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email: formData.get("email") as string,
        password: formData.get("password") as string,
      })
      if (error) {
        setError("Invalid email or password. Please try again.")
        setLoading(false)
      } else {
        router.push("/")
        router.refresh()
      }
    }
    ```
    Network errors (non-auth errors from Supabase): catch with a general catch block and show
    "Connection failed. Check your internet and try again."

    Field autocomplete attributes:
    - Email: name="email", type="email", autoComplete="email"
    - Password: name="password", type="password", autoComplete="current-password"
  </action>
  <verify>
    <automated>cd "/Users/richardblackwell/Trading App Full-Stack V6" && npx tsc --noEmit 2>&1 | grep -v "Coach.tsx" | head -20</automated>
  </verify>
  <done>app/(auth)/layout.tsx exists with ambient orbs, no app shell. app/(auth)/login/page.tsx exists with Midnight Market design, sign in handler, error states, and footer link. TypeScript passes (excluding known Coach.tsx errors from Plan 03).</done>
</task>

<task type="auto">
  <name>Task 2: Signup page (2-step flow)</name>
  <files>app/(auth)/signup/page.tsx</files>
  <action>
    Create app/(auth)/signup/page.tsx as a "use client" component.

    Same outer shell as login (ambient orbs via auth layout, centered glass card).

    State:
    - step: 1 | 2 (default 1)
    - email, password, confirmPassword (step 1 fields)
    - geminiKey (step 2 field)
    - loading, error (shared)
    - showPassword, showConfirmPassword, showGeminiKey (toggle states)
    - keyValid: null | boolean (step 2 validation)
    - step1Complete: boolean (true after signUp succeeds)

    Progress indicator (per UI-SPEC):
    - 2 dots connected by a line
    - Active dot: 8px, background var(--accent), glow shadow
    - Inactive dot: 8px, background var(--border)
    - Connector: 32px × 1px, var(--border) in step 1, var(--accent) in step 2
    - Transitions: 0.3s ease on background and box-shadow

    Step 1 — Create account:
    Heading: "Create your account" (20px Inter 600)
    Fields: Email, Password (with strength indicator), Confirm Password
    Password strength indicator (per UI-SPEC):
    - Weak < 8 chars: 33% width, var(--red)
    - Fair 8+ chars: 66% width, var(--yellow)
    - Strong 12+ chars: 100% width, var(--green)
    - 3px height bar, transition width+color 0.3s ease
    - 10px Mono label right-aligned above bar
    CTA: "Continue →" — disabled if any field empty or passwords don't match
    Footer: "Already have an account? Sign in →" → /login

    Step 1 submit handler:
    ```typescript
    async function handleStep1(e: React.FormEvent) {
      e.preventDefault()
      if (password !== confirmPassword) { setError("Passwords do not match."); return }
      if (password.length < 8) { setError("Password must be at least 8 characters."); return }
      setLoading(true)
      setError(null)
      const supabase = createClient()
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        if (error.message.includes("already registered")) {
          setError("An account with this email already exists. Sign in instead?")
        } else {
          setError(error.message)
        }
        setLoading(false)
      } else {
        setLoading(false)
        setStep(2)
      }
    }
    ```

    Step 2 — Connect AI coach:
    Heading: "Connect your AI coach"
    Description panel (per UI-SPEC):
    - border: 1px solid var(--border-accent), background: var(--accent3), border-radius 12px, p-4
    - lucide Sparkles icon + "Gemini API Key" label in accent color
    - Description text in var(--text2)
    - Link: "Get a free key at ai.google.dev →" opens in _blank

    Gemini key field:
    - type="password" with show/hide toggle
    - font: IBM Plex Mono 14px (key is a token — mono applies)
    - placeholder: "AIza…"
    - onBlur validation: if value present and doesn't start with "AIza", show format error
    - if valid format onBlur: show subtle "Looks good" in var(--green)

    "Save and start coaching" button:
    - disabled when field empty or keyValid === false
    - enabled when field has "AIza" prefix OR user explicitly tapped skip

    Skip link: "Skip for now — I'll add this later"
    - <button> styled as text link
    - min height 44px
    - var(--text2) → var(--text) on hover

    Back button: lucide ChevronLeft + "Back" → setStep(1), preserve field values

    Step 2 primary handler:
    ```typescript
    async function handleStep2(skipKey = false) {
      if (!skipKey && (!geminiKey.trim() || !geminiKey.startsWith("AIza"))) {
        setKeyValid(false)
        return
      }
      setLoading(true)
      const supabase = createClient()
      if (!skipKey && geminiKey.trim()) {
        await supabase.auth.updateUser({ data: { gemini_api_key: geminiKey.trim() } })
      }
      router.push("/")
      router.refresh()
    }
    ```

    Step transition animation (per UI-SPEC):
    - Outgoing: opacity 1→0, translateX 0→-12px, 0.18s ease
    - Incoming: opacity 0→1, translateX 12px→0, 0.22s ease
    - Sequence: outgoing first, then incoming (use setTimeout after 180ms for incoming)
    - prefers-reduced-motion: instant swap

    Implement the animation with a CSS class approach:
    - Add a state `transitioning: boolean` and `direction: "forward" | "back"`
    - On step change: set transitioning=true → wait 180ms → change step → set transitioning=false
    - Apply CSS transforms based on transitioning state and direction
    - Minimal implementation acceptable — the key requirement is not a jarring flash
  </action>
  <verify>
    <automated>cd "/Users/richardblackwell/Trading App Full-Stack V6" && npx tsc --noEmit 2>&1 | grep -v "Coach.tsx" | head -30</automated>
  </verify>
  <done>app/(auth)/signup/page.tsx exists. 2-step flow works (step 1 creates account, step 2 optionally saves Gemini key). Progress indicator renders. Skip link navigates to / without saving key. All copy matches the copywriting contract. TypeScript passes (excluding Coach.tsx).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| user input → signUp/signInWithPassword | Email and password are user-supplied — validated by Supabase Auth on the server |
| user input → updateUser gemini_api_key | Key is stored in user_metadata — only the authenticated user can write their own metadata |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-01 | Information Disclosure | Gemini key visible during signup step 2 | mitigate | Field uses type="password" with show/hide toggle. Key is sent to Supabase Auth via TLS. |
| T-04-02 | Tampering | Signup without email confirmation | accept | Email confirmation is disabled per A2 assumption in RESEARCH.md. Acceptable for development — re-enable before production launch. Note in SUMMARY. |
| T-04-03 | Spoofing | Client-side password strength check only | accept | Password minimum enforcement is UX only. Supabase Auth enforces its own minimum (6 chars by default). The UI check (8 chars) is stricter — no gap. |
</threat_model>

<verification>
- Visiting /login shows glass card with wordmark, email/password fields, "Sign in" button
- Visiting /signup shows 2-step flow with progress indicator
- Neither page shows the 5-tab shell
- Ambient orbs are visible through the glass card on both pages
- TypeScript passes (excluding Coach.tsx — fixed in Plan 05)
</verification>

<success_criteria>
Users can create accounts and log in. The auth screens match the Midnight Market design system with ambient orbs, glass card, IBM Plex Mono, and correct CSS token usage. AUTH-01 and AUTH-02 are implemented.
</success_criteria>

<output>
After completion, create `.planning/phases/01-auth-and-security/01-04-SUMMARY.md` documenting:
- Both pages created with route paths
- Auth operations used (signUp, signInWithPassword, updateUser)
- Any design compromises (e.g., if slideUp animation class needed adding to globals.css)
- TypeScript status
</output>
---
phase: 01-auth-and-security
plan: 05
type: execute
wave: 3
depends_on: ["01-02", "01-03"]
files_modified:
  - app/components/tabs/Coach.tsx
autonomous: true
requirements:
  - AUTH-01
  - AUTH-02

must_haves:
  truths:
    - "Coach tab renders PreviewCoachView when isAuthenticated is false (D-06)"
    - "No redirect happens when unauthenticated user taps Coach tab (D-07)"
    - "apiKey and setApiKey are no longer read from useTrades() in Coach.tsx"
    - "apiKey is no longer sent in the fetch body to /api/coach"
    - "Mode chips are visible but have opacity 0.35 and pointer-events none in preview mode"
    - "Sample response card renders with realistic trading content and DEMO badge"
    - "CTA banner links to /signup (Create free account) and /login (Sign in to existing account)"
    - "History sub-tab shows lock empty state when unauthenticated"
    - "Disabled input area renders with correct placeholder and opacity 0.4"
    - "npx tsc --noEmit passes"
  artifacts:
    - path: "app/components/tabs/Coach.tsx"
      provides: "Auth-aware Coach tab with PreviewCoachView and auth-gated ChatView"
  key_links:
    - from: "app/components/tabs/Coach.tsx"
      to: "app/components/AuthProvider"
      via: "useAuthContext() hook"
      pattern: "useAuthContext"
    - from: "CoachTab (root component)"
      to: "PreviewCoachView or ChatView"
      via: "isAuthenticated conditional"
      pattern: "isAuthenticated"
---

<objective>
Make the Coach tab auth-aware: remove all API key management from the component, add PreviewCoachView for unauthenticated users, and remove apiKey from the fetch body.

Purpose: Coach.tsx has three dependencies on the now-removed apiKey state from TradesContext. Fixing them unblocks TypeScript and delivers D-06/D-07 (preview mode without redirect). The Coach tab is the primary value gate — getting this right is critical for the auth UX.

Output: Modified `app/components/tabs/Coach.tsx` with PreviewCoachView and auth-gated behavior.
</objective>

<execution_context>
@/Users/richardblackwell/.claude/get-shit-done/workflows/execute-plan.md
@/Users/richardblackwell/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/richardblackwell/Trading App Full-Stack V6/.planning/phases/01-auth-and-security/01-UI-SPEC.md
@/Users/richardblackwell/Trading App Full-Stack V6/app/components/tabs/Coach.tsx
@/Users/richardblackwell/Trading App Full-Stack V6/.planning/phases/01-auth-and-security/01-03-SUMMARY.md
@/Users/richardblackwell/Trading App Full-Stack V6/.planning/phases/01-auth-and-security/01-02-SUMMARY.md

<interfaces>
<!-- What the executor needs. -->

From app/components/AuthProvider.tsx (Plan 02):
```typescript
import { useAuthContext } from "@/app/components/AuthProvider"
// Returns: { user: User | null, isAuthenticated: boolean, isLoading: boolean }
```

From app/lib/TradesContext.tsx after Plan 03 changes:
```typescript
// apiKey and setApiKey are REMOVED. Do not destructure them.
// Valid destructure:
const { trades, coachingHistory, addCoachingEntry, patternSummary, updatePatternSummary } = useTrades()
// updateCoachingEntry also available if needed
```

fetch body change (from Plan 03 — apiKey removed from route handler):
```typescript
// OLD (remove this):
body: JSON.stringify({ ..., apiKey, ... })
// NEW (apiKey line deleted):
body: JSON.stringify({ message, mode, trades, history, patternSummary, strategyText, sessionId })
```

Existing Coach.tsx structure to preserve:
- genId(), genSessionId() helper functions
- MODES array and MODE_LABELS record
- MOMENTUM_MAP record
- relativeTime() helper
- MessageBubble component
- ThinkingBubble component
- HistoryCard component
- The sendMessage async function logic (minus apiKey references)
- HistoryView component — needs unauthenticated empty state added
- ChatView component — remove ApiKeyPanel and apiKey gating, keep everything else
- CoachTab (root) — add auth check, render PreviewCoachView or ChatView+HistoryView
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add PreviewCoachView and auth-gate CoachTab</name>
  <files>app/components/tabs/Coach.tsx</files>
  <action>
    Make the following changes to Coach.tsx. Read the file carefully before editing.

    CHANGE 1 — Add import at top of file:
    ```typescript
    import { useAuthContext } from "@/app/components/AuthProvider"
    import Link from "next/link"
    ```

    CHANGE 2 — Remove ApiKeyPanel component entirely (lines 70-97).
    This component is replaced by the /settings page.

    CHANGE 3 — In ChatView():
    - Change destructuring to remove apiKey and setApiKey:
      OLD: const { trades, coachingHistory, addCoachingEntry, apiKey, setApiKey, patternSummary, updatePatternSummary } = useTrades()
      NEW: const { trades, coachingHistory, addCoachingEntry, patternSummary, updatePatternSummary } = useTrades()
    - Remove state: showSettings (and its initial value `!apiKey`)
    - Remove the ApiKeyPanel render block (the `showSettings &&` block)
    - Remove the "API key" button row (the flex justify-between with "● Key set" / "○ Set key" button)
    - In sendMessage(): remove `if (!apiKey) { setShowSettings(true); return }` guard
    - In sendMessage(): remove `apiKey` from the fetch JSON body
    - In sendMessage(): the send button disabled condition changes from `!input.trim() || loading || !apiKey` to `!input.trim() || loading`
    - In sendMessage(): the send button background condition removes `&& apiKey`
    - Mode chips: disabled condition changes from `loading || !apiKey` to `loading`
    - Empty state text: remove `!apiKey ? "Set your Gemini API key to get started"` branch; use only trades.length check and default message
    - In empty state: remove the "Set API Key →" button block (`{!apiKey && (...)}`)

    CHANGE 4 — In HistoryView(): Add unauthenticated empty state.
    Wrap the existing return with an auth check:
    ```typescript
    function HistoryView() {
      const { isAuthenticated } = useAuthContext()
      const { coachingHistory, updateCoachingEntry } = useTrades()
      // ... existing state

      if (!isAuthenticated) {
        return (
          <div className="p-4">
            <div className="glass rounded-2xl p-8 flex flex-col items-center justify-center gap-3 text-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <p className="text-sm font-medium mt-2" style={{ color: "var(--text)" }}>
                Session history requires an account
              </p>
              <p className="text-xs" style={{ color: "var(--text2)", lineHeight: 1.6 }}>
                Your coaching sessions will be saved here once you sign up.
              </p>
              <Link href="/signup"
                className="mono text-sm font-semibold px-4 py-2 rounded-xl mt-4"
                style={{ background: "linear-gradient(to bottom, #38bdf8, #0ea5e9)", color: "var(--bg)", display: "block", textAlign: "center", maxWidth: 200, boxShadow: "0 1px 24px rgba(56,189,248,0.25)" }}>
                Create free account →
              </Link>
            </div>
          </div>
        )
      }

      // ... existing HistoryView content unchanged
    }
    ```

    CHANGE 5 — Add PreviewCoachView component (new, before CoachTab):
    ```typescript
    function PreviewCoachView() {
      return (
        <div className="flex flex-col" style={{ minHeight: "calc(100dvh - 130px)" }}>
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-4 pb-2">

              {/* Mode chips — disabled */}
              <div className="flex flex-wrap gap-2">
                {MODES.map(mode => (
                  <div key={mode.id}
                    className="flex items-center gap-1.5 mono text-xs px-3 py-2 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", color: "var(--text2)", opacity: 0.35, cursor: "not-allowed", pointerEvents: "none" }}>
                    {mode.icon}
                    {mode.label}
                  </div>
                ))}
              </div>

              {/* Sample AI response */}
              <div className="flex gap-2.5">
                <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.3)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
                  </svg>
                </div>
                <div style={{ flex: 1, maxWidth: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: "16px", borderTopLeftRadius: 4, padding: 16, color: "var(--text)", lineHeight: 1.65, position: "relative" }}>
                  <span className="mono"
                    style={{ position: "absolute", top: 10, right: 12, fontSize: 9, fontWeight: 600, textTransform: "uppercase", background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", color: "var(--text3)", borderRadius: 4, padding: "2px 6px", letterSpacing: "0.06em" }}>
                    DEMO
                  </span>
                  <p style={{ fontSize: 14 }}>
                    {`Journal Analysis · 12 trades reviewed

Key pattern identified: Your NQ long setups during the 9:30–10:15 AM EST session carry a 67% win rate, but you're cutting winners at +1.2R on average when your strategy targets +2R. This is costing roughly +4.8R per week.

Priority adjustment: Set a partial exit at +1.5R (half position) and trail the remainder to your next liquidity level. This protects profit while letting runners develop.

Momentum: ↑ Positive — discipline score improving over the last 8 sessions.`}
                  </p>
                  <div className="mono mt-2" style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text3)" }}>
                    JOURNAL ANALYSIS · TODAY
                  </div>
                </div>
              </div>

              {/* CTA banner */}
              <div className="glass rounded-2xl p-5 text-center" style={{ marginTop: 16, border: "1px solid var(--border-accent)", background: "var(--accent3)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 8px" }}>
                  <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
                </svg>
                <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", lineHeight: 1.2 }}>
                  Your AI trading coach is ready
                </p>
                <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6, marginTop: 8 }}>
                  Sign up free to analyze your real trade data, identify patterns in your journal, and get coaching tailored to your exact strategy.
                </p>
                <Link href="/signup"
                  className="mono font-semibold"
                  style={{ display: "block", height: 48, lineHeight: "48px", width: "100%", borderRadius: 12, background: "linear-gradient(to bottom, #38bdf8, #0ea5e9)", boxShadow: "0 1px 24px rgba(56,189,248,0.25)", color: "var(--bg)", fontSize: 15, marginTop: 16, textAlign: "center" }}>
                  Create free account →
                </Link>
                <Link href="/login"
                  style={{ display: "block", textAlign: "center", marginTop: 8, fontSize: 13, color: "var(--text2)", paddingTop: 10, paddingBottom: 10 }}>
                  Sign in to existing account
                </Link>
              </div>
            </div>
          </div>

          {/* Disabled input area */}
          <div style={{ flexShrink: 0, padding: "12px 16px 16px", background: "rgba(6,11,20,0.8)", backdropFilter: "blur(12px)", borderTop: "1px solid var(--border)", opacity: 0.4, pointerEvents: "none" }}>
            <div className="flex items-end gap-2 rounded-2xl px-3 py-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
              <textarea
                disabled
                placeholder="Sign up to start coaching your trades…"
                rows={1}
                className="flex-1 resize-none outline-none text-sm mono bg-transparent"
                style={{ color: "var(--text)", lineHeight: 1.5, maxHeight: 120, minHeight: 24 }}
              />
              <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", opacity: 0.3 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      )
    }
    ```

    CHANGE 6 — In CoachTab (root component):
    OLD:
    ```typescript
    export default function CoachTab() {
      const { apiKey, setApiKey, coachingHistory } = useTrades()
    ```
    NEW:
    ```typescript
    export default function CoachTab() {
      const { isAuthenticated } = useAuthContext()
      const { coachingHistory } = useTrades()
    ```

    In the CoachTab return, conditionally render PreviewCoachView:
    ```typescript
    {activeView === "chat"
      ? (!isAuthenticated ? <PreviewCoachView /> : <ChatView />)
      : <HistoryView />}
    ```
    (History view handles its own unauth state internally — it's always mounted when activeView === "history".)
  </action>
  <verify>
    <automated>cd "/Users/richardblackwell/Trading App Full-Stack V6" && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>Coach.tsx imports useAuthContext. CoachTab renders PreviewCoachView when !isAuthenticated. apiKey is not referenced anywhere in Coach.tsx. apiKey is not in the fetch body. HistoryView shows lock empty state when unauthenticated. TypeScript passes (full clean compile).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| isAuthenticated (UI) → /api/coach | UI gate prevents sending requests, but /api/coach has its own independent 401 guard (Plan 03) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-01 | Elevation of Privilege | PreviewCoachView bypass | accept | isAuthenticated is UI-only gating per D-02. The actual security boundary is the /api/coach 401 guard (Plan 03). A user who bypasses the UI gate still can't get a Gemini response without a valid session cookie. |
| T-05-02 | Information Disclosure | Demo content in PreviewCoachView | accept | Sample response is fictional trading data, not real user data. No PII. No API calls for preview. |
</threat_model>

<verification>
- `grep -n "apiKey" app/components/tabs/Coach.tsx` returns no results
- `grep -n "useAuthContext" app/components/tabs/Coach.tsx` shows the import and usage
- `npx tsc --noEmit` passes with zero errors
</verification>

<success_criteria>
TypeScript compiles clean. Unauthenticated users see the preview mode with sample response and CTA. Authenticated users see the full ChatView. The fetch body no longer includes apiKey. D-06 and D-07 are satisfied.
</success_criteria>

<output>
After completion, create `.planning/phases/01-auth-and-security/01-05-SUMMARY.md` documenting:
- Full list of changes made to Coach.tsx
- Confirmation of clean TypeScript compile
- Lines removed (ApiKeyPanel, apiKey references, showSettings state)
- Lines added (PreviewCoachView, useAuthContext import)
</output>
---
phase: 01-auth-and-security
plan: 06
type: execute
wave: 4
depends_on: ["01-02", "01-03", "01-04", "01-05"]
files_modified:
  - app/settings/page.tsx
  - app/page.tsx
autonomous: true
requirements:
  - AUTH-03
  - SEC-01

must_haves:
  truths:
    - "/settings page exists and renders the Midnight Market settings layout"
    - "Email display row shows authenticated user's email"
    - "API key row shows masked key (AIza••••xxxx) or 'Not connected' if absent"
    - "Update key expandable panel saves key via updateUser({ data: { gemini_api_key } })"
    - "Logout row shows inline confirmation, calls signOut() on confirm, redirects to /login"
    - "Account icon (lucide UserCircle) is added to bottom bar (mobile) and sidebar (desktop)"
    - "Account icon navigates to /settings via router.push('/settings')"
    - "npx tsc --noEmit passes"
  artifacts:
    - path: "app/settings/page.tsx"
      provides: "Settings page — email display, API key management, logout"
    - path: "app/page.tsx"
      provides: "App shell — modified to include Account nav icon"
  key_links:
    - from: "app/settings/page.tsx"
      to: "lib/supabase/client"
      via: "createClient().auth.updateUser and signOut"
      pattern: "updateUser"
    - from: "app/settings/page.tsx"
      to: "app/components/AuthProvider"
      via: "useAuthContext for user email"
      pattern: "useAuthContext"
    - from: "app/page.tsx"
      to: "app/settings/page.tsx"
      via: "router.push('/settings') on account icon click"
      pattern: "/settings"
---

<objective>
Create the Settings page and add the account navigation icon to the app shell.

Purpose: Users need a way to manage their Gemini API key after signup and to log out. The settings page is the Phase 1 home for both. The account icon in the app shell provides the nav entry point.

Output: `app/settings/page.tsx` (full Midnight Market settings page), modified `app/page.tsx` (account icon added to nav).
</objective>

<execution_context>
@/Users/richardblackwell/.claude/get-shit-done/workflows/execute-plan.md
@/Users/richardblackwell/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/richardblackwell/Trading App Full-Stack V6/.planning/phases/01-auth-and-security/01-UI-SPEC.md
@/Users/richardblackwell/Trading App Full-Stack V6/app/page.tsx
@/Users/richardblackwell/Trading App Full-Stack V6/.planning/phases/01-auth-and-security/01-05-SUMMARY.md

<interfaces>
<!-- What the executor needs. -->

From lib/supabase/client.ts (Plan 01):
```typescript
export function createClient(): SupabaseClient
// Settings operations:
// supabase.auth.getUser() — read email and user_metadata
// supabase.auth.updateUser({ data: { gemini_api_key: key } }) — save key
// supabase.auth.signOut() — triggers onAuthStateChange SIGNED_OUT → router.push('/login')
```

From app/components/AuthProvider.tsx (Plan 02):
```typescript
import { useAuthContext } from "@/app/components/AuthProvider"
// Returns: { user: User | null, isAuthenticated: boolean, isLoading: boolean }
// user.email — email display
// user.user_metadata.gemini_api_key — for masked display (read on mount via getUser())
```

From app/page.tsx (existing):
// Nav structure uses TABS array + button render loop.
// Account icon goes AFTER the tab buttons, separated by styling.
// Mobile: rightmost in bottom bar. Desktop: bottom of sidebar, after a divider.
// Uses router.push('/settings') — not tab state — because settings is a separate page.
// Icon: lucide UserCircle, 20px
// Label: "Account"
// Color: var(--text2) default; var(--accent) when on /settings page
// Use usePathname() from next/navigation to detect if on /settings

Masked key format:
```typescript
const maskedKey = geminiApiKey
  ? `AIza••••${geminiApiKey.slice(-4)}`
  : null
```

Logout confirmation auto-cancel:
```typescript
// Auto-cancel after 5 seconds of inactivity on the confirm state
useEffect(() => {
  if (showLogoutConfirm) {
    const timer = setTimeout(() => setShowLogoutConfirm(false), 5000)
    return () => clearTimeout(timer)
  }
}, [showLogoutConfirm])
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create settings page</name>
  <files>app/settings/page.tsx</files>
  <action>
    Create app/settings/page.tsx as a "use client" component.

    IMPORTANT: Settings is a standalone page (not in the (auth) route group). It uses the
    root layout (which has AuthProvider + TradesProvider + ambient orbs from app/page.tsx).
    However, settings must render its OWN ambient orbs because app/page.tsx's orbs are only
    rendered by the App component (not the root layout itself). Settings replaces the App
    component when at /settings. Add the ambient orb div at the top of the settings page render.

    Wait — re-check: the ambient orbs are in app/page.tsx App component, not layout.tsx.
    Settings page renders instead of page.tsx App component. So settings page MUST include
    its own orb background.

    Page structure:
    ```
    <div style={{ minHeight: "100dvh", position: "relative" }}>
      {/* Ambient orbs */}
      <div className="ambient-bg" aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      {/* Sticky back header */}
      <header style={{ ... }}>
        <button onClick={() => router.back()}>
          <ChevronLeft /> Back
        </button>
        <span className="mono">SETTINGS</span>
      </header>

      {/* Content */}
      <main style={{ padding: "24px 16px 48px", maxWidth: 600, margin: "0 auto" }}>
        {/* ACCOUNT section */}
        {/* AI COACH section */}
        {/* SESSION section */}
      </main>
    </div>
    ```

    Back header (per UI-SPEC):
    - height: 56px + env(safe-area-inset-top) padding-top
    - background: rgba(6,11,20,0.9), backdropFilter: blur(12px)
    - borderBottom: 1px solid var(--border)
    - position: sticky, top: 0, zIndex: 40
    - Back button: ChevronLeft (18px, var(--text2)) + "Back" (14px Inter var(--text2))
      - hover: color var(--accent), transition: color 0.15s ease
    - Title: "SETTINGS" — IBM Plex Mono 11px weight 600 uppercase letter-spacing 0.12em var(--text2)

    Section structure (per UI-SPEC):
    - Section label: 10px Inter 600 uppercase, color var(--text2), letter-spacing 0.1em, mb 8px
    - Glass card: rounded-2xl, overflow hidden, border: 1px solid var(--border)
    - Rows separated by: borderTop: 1px solid var(--border)
    - Space between sections: 24px

    ACCOUNT section — email row:
    - height: min 56px
    - padding: 0 16px
    - display: flex, align-items: center, justify-content: space-between
    - Left: Mail icon (16px, var(--text2)) + email text (14px Inter var(--text), margin-left 10px)
    - Right: "VERIFIED" badge if user.email_confirmed_at exists:
      9px Mono 600, color var(--green), background rgba(52,211,153,0.1),
      border: 1px solid rgba(52,211,153,0.2), borderRadius: 4px, padding: 2px 6px
    - Non-interactive row (no cursor pointer)

    AI COACH section — API key:

    Key status row (always visible, height 56px):
    - Left: KeyRound icon (16px, var(--text2)) + div (margin-left 10px):
        - "Gemini API Key" (14px Inter var(--text))
        - masked key (11px Mono var(--text2)) OR "Not connected" (11px Mono var(--red))
    - Right badge:
        - If connected: "Connected" (10px Mono var(--green), bg rgba(52,211,153,0.1), border var(--green)20, rounded-full px-2 py-0.5)
        - If not set: "Not set" (10px Mono var(--red), bg rgba(248,113,113,0.1), border rgba(248,113,113,0.2), rounded-full)

    "Update API key" expandable row (per UI-SPEC):
    - Always visible, height 44px, padding 0 16px
    - PencilLine icon (14px var(--text2)) + "Update API key" (13px Inter var(--text2))
    - Chevron right on far right, rotates 90deg when expanded
    - Background: transparent → rgba(255,255,255,0.03) on hover
    - On click: toggle expanded state

    Expanded panel (inside same glass card):
    - padding 16px
    - Input: type="password" with show/hide toggle, IBM Plex Mono 14px, placeholder "AIza…", full width
    - "Save key" button: height 44px, width 100%, margin-top 12px, .btn-accent styles
      - Disabled when input is empty or unchanged
      - Loading state: spinner, disabled
    - Success state after save: replace button with CheckCircle icon + "Key saved" (13px Mono var(--green))
      Show for 2 seconds then collapse panel and reset

    Save key handler:
    ```typescript
    async function handleSaveKey() {
      if (!newKey.trim() || newKey.trim() === currentMaskedDisplay) return
      setSaving(true)
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        data: { gemini_api_key: newKey.trim() }
      })
      if (!error) {
        setSaveSuccess(true)
        setTimeout(() => {
          setSaveSuccess(false)
          setExpanded(false)
          setNewKey("")
          // re-fetch user to update masked display
          supabase.auth.getUser().then(({ data: { user } }) => {
            const key = user?.user_metadata?.gemini_api_key as string | undefined
            setMaskedKey(key ? `AIza••••${key.slice(-4)}` : null)
          })
        }, 2000)
      }
      setSaving(false)
    }
    ```

    SESSION section — logout:
    Row (height 56px, padding 0 16px, cursor pointer):
    - Default: LogOut icon (16px var(--red)) + "Sign out" (14px Inter weight 500 var(--red))
    - Background: transparent → rgba(248,113,113,0.04) on hover

    On first click: show inline confirmation (row transforms, height expands to 72px, 0.2s ease):
    - AlertTriangle icon (16px var(--red)) + "Are you sure? This ends your session." (12px Inter var(--red))
    - Two buttons side by side:
        Cancel: "Cancel" (12px Mono var(--text2)), border var(--border), height 44px, padding 0 12px, border-radius 8px
        Confirm: "Sign out" (12px Mono var(--red)), border rgba(248,113,113,0.3), height 44px, padding 0 12px, border-radius 8px, bg rgba(248,113,113,0.06) → .12 hover
    - Auto-cancel after 5 seconds (useEffect with setTimeout)

    On confirm:
    ```typescript
    const supabase = createClient()
    await supabase.auth.signOut()
    // AuthProvider onAuthStateChange fires SIGNED_OUT → router.push('/login')
    // No manual router.push needed
    ```

    On mount: read user data for display:
    ```typescript
    useEffect(() => {
      const supabase = createClient()
      supabase.auth.getUser().then(({ data: { user } }) => {
        setEmail(user?.email ?? "")
        const key = user?.user_metadata?.gemini_api_key as string | undefined
        setMaskedKey(key ? `AIza••••${key.slice(-4)}` : null)
      })
    }, [])
    ```
  </action>
  <verify>
    <automated>cd "/Users/richardblackwell/Trading App Full-Stack V6" && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>app/settings/page.tsx exists. Email row, API key section with expandable update panel, and logout with inline confirmation are all implemented. Ambient orbs are included. TypeScript passes.</done>
</task>

<task type="auto">
  <name>Task 2: Add account icon to app shell nav</name>
  <files>app/page.tsx</files>
  <action>
    Modify app/page.tsx to add a UserCircle account icon to the nav bar.

    Add at the top of the file:
    ```typescript
    import { usePathname, useRouter } from "next/navigation"
    import { UserCircle } from "lucide-react"
    ```

    Inside App(), add:
    ```typescript
    const router = useRouter()
    const pathname = usePathname()
    const isOnSettings = pathname === "/settings"
    ```

    In the nav: after the TABS.map() loop, add the account button. It must be:
    - Separated from tab buttons (use a wrapper div with flex-col on desktop)
    - Mobile: sits after the 5 tab buttons in the bottom bar row (flex-row, flex-1 like others)
    - Desktop: sits at the bottom of the sidebar, with a divider line above it

    Mobile addition (inside the flex div wrapping the tab buttons, after the map):
    ```tsx
    <button
      onClick={() => router.push("/settings")}
      className="flex-1 lg:hidden flex flex-col items-center gap-0.5 py-2 min-h-[44px] justify-center"
      style={{ color: isOnSettings ? "var(--accent)" : "var(--text2)" }}
      aria-label="Account"
    >
      <UserCircle size={20} />
      <span className="label-upper" style={{ color: isOnSettings ? "var(--accent)" : "var(--text2)" }}>
        Account
      </span>
    </button>
    ```

    Desktop addition (after the flex div closing tag for tab buttons, still inside the nav):
    ```tsx
    {/* Account — desktop sidebar bottom */}
    <div className="hidden lg:block mt-auto pt-3 px-3" style={{ borderTop: "1px solid var(--border)" }}>
      <button
        onClick={() => router.push("/settings")}
        className={`flex flex-row items-center gap-2.5 px-3 py-2.5 rounded-xl w-full${isOnSettings ? " tab-btn-active" : ""}`}
        style={{
          color: isOnSettings ? "var(--accent)" : "var(--text2)",
          background: isOnSettings ? "var(--accent3)" : "transparent",
          border: isOnSettings ? "1px solid var(--border-accent)" : "1px solid transparent",
        }}
        aria-label="Account settings"
      >
        <UserCircle size={20} />
        <span className="lg:normal-case lg:tracking-normal lg:font-medium lg:text-sm">Account</span>
      </button>
    </div>
    ```

    For the desktop sidebar, the nav currently uses a flex column but the tab buttons div takes
    `h-full`. We need the Account button to stick to the bottom. Adjust the tab buttons wrapper:
    - The outer nav uses className="tab-bar" — check globals.css for its flexbox setup
    - The div wrapping TABS.map() currently has className with `h-full` — this is the container
    - Add the Account desktop button as a sibling div AFTER the tabs div, using `mt-auto`

    The tab-bar class on the nav is likely `flex flex-col` on desktop. The Account button with
    `mt-auto` will push to the bottom. If tab-bar isn't flex-col, adjust accordingly.

    IMPORTANT: Do not break the existing tab selection behavior. The TABS array and TAB_COMPONENTS
    record are unchanged. The account button uses router.push('/settings') — it does NOT call
    setActiveTab(). Settings is a separate page, not a tab.
  </action>
  <verify>
    <automated>cd "/Users/richardblackwell/Trading App Full-Stack V6" && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>app/page.tsx imports UserCircle and usePathname. Account button renders in mobile bottom bar after tab buttons. Account button renders at bottom of desktop sidebar with divider. Clicking navigates to /settings. isOnSettings toggles accent color. TypeScript passes.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Settings page → updateUser | updateUser is an authenticated call — Supabase only allows users to update their own metadata |
| Settings page → signOut | signOut invalidates the session cookie server-side |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-06-01 | Information Disclosure | Gemini key display in settings | mitigate | Key is always masked (AIza••••xxxx) in the UI. Never show full key. type="password" on input. The last 4 chars are low-value for attackers. |
| T-06-02 | Elevation of Privilege | Settings page access without auth | accept | Settings page reads user data on mount via getUser() — if unauthenticated, email and key will be null and the page will show empty state. The AuthProvider SIGNED_OUT handler will redirect to /login if session expires while on settings. No sensitive data is visible to unauthenticated users. |
</threat_model>

<verification>
- `/settings` renders without the 5-tab shell (it has its own orb background and back header)
- Email display shows the authenticated user's email
- API key shows masked format or "Not connected"
- "Update API key" expandable panel works
- Logout inline confirmation appears on first click, auto-cancels after 5s
- Account icon appears in bottom bar (mobile) and sidebar (desktop)
- Clicking account icon navigates to /settings
- `npx tsc --noEmit` passes
</verification>

<success_criteria>
Users can manage their Gemini API key and log out from the Settings page. The account icon in the app shell provides consistent navigation access. AUTH-03 (logout from any tab) is satisfied. D-14 and D-15 are implemented.
</success_criteria>

<output>
After completion, create `.planning/phases/01-auth-and-security/01-06-SUMMARY.md` documenting:
- Settings page sections implemented
- How ambient orbs were handled (own div in settings)
- Account icon placement in both mobile and desktop nav
- Confirmation that TypeScript passes cleanly
</output>
---
phase: 01-auth-and-security
plan: 07
type: execute
wave: 5
depends_on: ["01-03", "01-04", "01-05", "01-06"]
files_modified: []
autonomous: false
requirements:
  - AUTH-01
  - AUTH-02
  - AUTH-03
  - SEC-01
  - SEC-02

must_haves:
  truths:
    - "TypeScript compiles clean: npx tsc --noEmit passes with zero errors"
    - "User can sign up with email + password and land on the app"
    - "User can log in with existing credentials"
    - "Session persists after closing and reopening the browser tab"
    - "Logout returns user to /login"
    - "/api/coach returns 401 without a session cookie"
    - "Gemini API key is not present in any network request from the browser"
    - "Coach tab shows preview mode when not authenticated"
    - "Settings page shows email and masked API key for authenticated user"
  artifacts:
    - path: "lib/supabase/client.ts"
      provides: "Browser client"
    - path: "lib/supabase/server.ts"
      provides: "Server client"
    - path: "app/components/AuthProvider.tsx"
      provides: "Auth context"
    - path: "app/layout.tsx"
      provides: "Async root layout with AuthProvider"
    - path: "app/(auth)/login/page.tsx"
      provides: "Login screen"
    - path: "app/(auth)/signup/page.tsx"
      provides: "Signup screen"
    - path: "app/components/tabs/Coach.tsx"
      provides: "Auth-gated Coach tab"
    - path: "app/settings/page.tsx"
      provides: "Settings page"
    - path: "app/api/coach/route.ts"
      provides: "Auth-guarded route handler"
  key_links:
    - from: "/login form"
      to: "/api/coach"
      via: "cookie set by @supabase/ssr after sign in"
      pattern: "signInWithPassword → cookie → getUser"
    - from: "/signup step 2"
      to: "user_metadata"
      via: "updateUser({ data: { gemini_api_key } })"
      pattern: "gemini_api_key"
---

<objective>
Final verification pass: TypeScript clean compile and manual smoke tests for all five acceptance criteria from SPEC.md.

Purpose: All plans are complete. This plan verifies they work together end-to-end. A human must perform the browser smoke tests — auth flows require a real browser, real Supabase session, and real network.

Output: Phase 1 is verified complete. SPEC.md acceptance criteria confirmed.
</objective>

<execution_context>
@/Users/richardblackwell/.claude/get-shit-done/workflows/execute-plan.md
@/Users/richardblackwell/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/richardblackwell/Trading App Full-Stack V6/.planning/phases/01-auth-and-security/01-SPEC.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Full TypeScript clean compile</name>
  <files></files>
  <action>
    Run the TypeScript compiler against the full project. Fix any remaining type errors.

    Common remaining errors to check:
    1. Any file still importing `apiKey` or `setApiKey` from useTrades() — search and fix
    2. Any missing import of UserCircle from lucide-react
    3. The `User` type from @supabase/supabase-js — ensure it's imported where used
    4. The `usePathname` import in page.tsx — ensure it's from "next/navigation"
    5. Any implicit `any` from body destructuring in route.ts

    Run:
    ```bash
    npx tsc --noEmit
    ```

    If there are errors, fix them. Common fixes:
    - Missing type imports: add `import type { X } from "package"`
    - Property access on possibly null/undefined: use optional chaining (?.)
    - Unused variables: prefix with _ or remove
  </action>
  <verify>
    <automated>cd "/Users/richardblackwell/Trading App Full-Stack V6" && npx tsc --noEmit 2>&1; echo "Exit code: $?"</automated>
  </verify>
  <done>npx tsc --noEmit exits with code 0. Zero TypeScript errors.</done>
</task>

<task type="auto">
  <name>Task 2: Automated 401 guard test</name>
  <files></files>
  <action>
    Start the dev server if not already running, then test the 401 guard on /api/coach.

    This test does NOT require a logged-in session — it tests that an unauthenticated request
    returns 401.

    Run the following curl command (dev server must be running on port 3000):
    ```bash
    curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/coach \
      -H "Content-Type: application/json" \
      -d '{}'
    ```

    Expected output: `401`

    If the dev server is not running, start it: `npm run dev`
    Wait for it to be ready (watch for "Ready" in output), then run the curl.

    If the result is not 401:
    - Check that app/api/coach/route.ts has the auth guard at the TOP of the POST handler (before body parsing)
    - Check that createClient from @/lib/supabase/server is imported and called
    - Verify that the getUser() call and the !user check are both present
  </action>
  <verify>
    <automated>curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/coach -H "Content-Type: application/json" -d '{}'</automated>
  </verify>
  <done>curl returns 401 for unauthenticated /api/coach POST. SEC-02 verified.</done>
</task>

<task type="checkpoint:human-verify">
  <name>Task 3: Browser smoke test — full auth flow</name>
  <what-built>All auth infrastructure is implemented. This task verifies the complete user journey in a real browser with a real Supabase project.</what-built>
  <how-to-verify>
    With the dev server running at http://localhost:3000, test each of these flows:

    **FLOW 1 — Signup:**
    1. Visit http://localhost:3000/signup
    2. Confirm: ambient orbs visible, glass card centered, no 5-tab shell
    3. Enter a new email + password (8+ chars) → click "Continue →"
    4. Step 2 appears: progress dot 2 activates, "Connect your AI coach" heading
    5. Enter your real Gemini API key (starts with AIza) → click "Save and start coaching"
    6. App navigates to http://localhost:3000 (5-tab shell loads)
    7. Tap Coach tab — ChatView is shown (NOT the preview mode)

    **FLOW 2 — Coach tab authenticated:**
    8. In Coach tab, tap "Analyze Journal" mode chip — it should trigger a request
    9. Open browser DevTools → Network tab → find the /api/coach POST request
    10. Confirm: the request body does NOT contain "apiKey" or any Gemini key string
    11. Confirm: a "gemini_api_key" string does NOT appear in the request body

    **FLOW 3 — Settings:**
    12. Click the Account icon (bottom bar on mobile, sidebar on desktop)
    13. Settings page opens: back header, SETTINGS title, ambient orbs
    14. Email row shows your email with VERIFIED badge
    15. API key row shows masked key (AIza••••xxxx) and "Connected" badge

    **FLOW 4 — Logout:**
    16. Tap "Sign out" row → inline confirmation appears
    17. Tap "Sign out" confirm button
    18. App redirects to /login

    **FLOW 5 — Session persistence:**
    19. Log in again via /login
    20. Close the browser tab completely
    21. Reopen http://localhost:3000
    22. Confirm: app loads directly to the 5-tab shell (no redirect to login)
    23. Confirm: Coach tab shows ChatView (not preview mode)

    **FLOW 6 — Coach preview (unauthenticated):**
    24. Log out (via settings)
    25. Navigate to http://localhost:3000 (do not go to /login)
    26. Tap Coach tab
    27. Confirm: preview mode renders (sample response visible, CTA banner, "DEMO" badge)
    28. Confirm: no redirect to /login occurred
    29. Mode chips are visible but grayed out (opacity 0.35)
    30. Input area is visible but disabled

    **FLOW 7 — Gemini key security audit:**
    31. Log in as a user WITH a Gemini key
    32. Open DevTools → Network → clear requests
    33. Tap "Analyze Journal" in Coach tab and wait for response
    34. Inspect the POST /api/coach request body
    35. Confirm: "AIza" string is NOT present anywhere in the request payload
    36. Run in terminal: `grep -r "gemini_api_key" .next/static/ 2>/dev/null | head -5`
    37. Confirm: empty result (key is not in the client bundle)
  </how-to-verify>
  <resume-signal>Type "all flows pass" if all 7 flows work correctly, or describe which step failed and what you saw instead</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Full system | Verification confirms all trust boundaries from Plans 01-06 are working end-to-end |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-07-01 | Information Disclosure | .next/static bundle — gemini key absence | mitigate | Verified by grep in Task 3 step 36. Key stored in Supabase user_metadata, never in source or build output. |
| T-07-02 | Information Disclosure | Network request — apiKey absence | mitigate | Verified by DevTools in Task 3 step 35. Route handler reads key server-side from getUser() result. |
</threat_model>

<verification>
- `npx tsc --noEmit` exits with code 0
- `curl -X POST http://localhost:3000/api/coach -d '{}'` returns HTTP 401
- All 7 browser smoke flows pass
</verification>

<success_criteria>
Phase 1 is complete when:
- TypeScript compiles clean
- 401 curl test passes
- All SPEC.md acceptance criteria verified by human smoke test
- Gemini key is confirmed absent from client bundle and network requests
</success_criteria>

<output>
After completion, create `.planning/phases/01-auth-and-security/01-07-SUMMARY.md` documenting:
- TypeScript result (zero errors)
- 401 curl test result
- Which smoke test flows passed
- Any issues discovered and how they were resolved
- Phase 1 declared complete
</output>
