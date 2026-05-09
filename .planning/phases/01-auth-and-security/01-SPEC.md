# Phase 1 SPEC — Auth & Security

## Phase Goal

Users can securely create accounts and log in with email/password. The Gemini API key is a server-side environment variable — never exposed to the client. The `/api/coach` route requires an authenticated session.

## Boundaries

**In scope:**
- Supabase Auth: email/password signup, login, logout
- Session persistence across browser restarts
- Moving Gemini API key from user-supplied localStorage to server-side env var
- Auth guard on `/api/coach` route (return 401 if unauthenticated)
- Login/signup UI screen(s)
- Auth state wired into app shell (show app only when authenticated)

**Out of scope (Phase 2+):**
- Supabase data persistence (trades, coaching history) — Phase 2
- V5 localStorage data migration — Phase 2
- OAuth / social login — v2 backlog
- Password reset email flow — can follow in a patch

## Requirements (Locked)

| REQ-ID | Requirement |
|--------|-------------|
| AUTH-01 | User can create account with email/password via Supabase Auth |
| AUTH-02 | User session persists across app restarts |
| AUTH-03 | User can log out from any tab |
| SEC-01 | Gemini API key stored as server-side env var — never exposed to client |
| SEC-02 | `/api/coach` returns 401 for unauthenticated requests |

## Acceptance Criteria

1. **Signup:** New user can create account with email + password and land on the app
2. **Login:** Returning user can log in and reach the 5-tab shell
3. **Persistence:** Closing and reopening the app does not require re-login (session cookie/token persists)
4. **Logout:** Clicking logout from any tab returns user to the login screen
5. **API security:** `curl -X POST /api/coach` without auth header returns `401`
6. **Key hidden:** Gemini API key is not present in any client bundle, network request, or localStorage
7. **TypeScript:** `npx tsc --noEmit` passes after implementation

## Constraints

- Must not break existing TradesContext or localStorage data during Phase 1 (data migration is Phase 2)
- Must not rename `edge_v5_*` localStorage keys
- Supabase project must be configured before execution (URL + anon key as env vars)
- Design: auth screens follow Midnight Market design system (no default Supabase UI components)
