---
phase: 01-auth-and-security
plan: 03
status: complete
---

## Plan 03: Gemini API Key Security + /api/coach Auth Guard

### What Was Built

**`app/api/coach/route.ts`** (modified)
- Added `import { createClient } from "@/lib/supabase/server"` at top
- POST handler now calls `supabase.auth.getUser()` BEFORE reading the request body
- Returns `401 Unauthorized` for any request without a valid Supabase session
- Returns `403` if authenticated user has no `gemini_api_key` in `user_metadata`
- `geminiApiKey` read from `user.user_metadata.gemini_api_key` (server-side only)
- `apiKey` removed from body destructuring — never accepted from client

**`app/lib/TradesContext.tsx`** (modified — apiKey state removed)
- Removed: `APIKEY_KEY` constant, `apiKey` state, `setApiKeyState`, `setApiKey` callback
- Removed: `apiKey` / `setApiKey` from `TradesContextValue` interface and Provider value
- Removed: `readLS(APIKEY_KEY)` from hydration effect
- `edge_v5_apikey` localStorage key is retired — existing values are inert

### Security Impact
- SEC-01 satisfied: Gemini API key never appears in browser network requests
- SEC-02 satisfied: `/api/coach` returns 401 for unauthenticated requests
- Key travels server-to-server only (Supabase user_metadata → Gemini API)

### TypeScript
- Coach.tsx has 4 expected errors (references to removed `apiKey`/`setApiKey`) — intentional, fixed in Plan 05
- All other files compile clean

### Known State
Coach.tsx will have TypeScript errors until Plan 05 removes apiKey references from that component.
