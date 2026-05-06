---
phase: 01-auth-and-security
plan: 04
status: complete
---

## Plan 04: Login and Signup Pages

### What Was Built

**`app/(auth)/layout.tsx`** (new)
- Server component, no 5-tab shell
- Ambient orbs background visible behind glass panels
- Minimal wrapper — auth pages render in isolation from the main app shell

**`app/(auth)/login/page.tsx`** (new)
- "TRADING EDGE" wordmark at top
- Glass card with email/password fields
- `signInWithPassword()` — on success: `router.push("/")` + `router.refresh()`
- Password show/hide toggle
- Error message: "Invalid email or password. Try again."
- Link to `/signup` for new users

**`app/(auth)/signup/page.tsx`** (new)
- 2-step flow with progress dots indicator
- Step 1: email/password signup via `supabase.auth.signUp()`
- Step 2: Gemini API key entry via `supabase.auth.updateUser({ data: { gemini_api_key } })`
- "Skip for now" on Step 2 navigates to `/` without saving a key
- Password show/hide toggle on both password fields

### Design Compliance
- CSS custom properties only (no hardcoded hex)
- IBM Plex Mono on data values
- Glass-md cards over visible ambient orbs
- 44px minimum tap targets
- Midnight Market token palette throughout

### TypeScript
`npx tsc --noEmit` — zero errors project-wide
