---
phase: 01-auth-and-security
plan: 06
status: complete
---

## Plan 06: Settings Page + Account Nav Icon

### One-liner

Settings page with email display, masked API key management, and logout confirmation; UserCircle icon added to both mobile bottom bar and desktop sidebar.

---

### Files Created

**`app/settings/page.tsx`** (new, "use client")
- Standalone page at `/settings` — renders instead of the 5-tab App shell
- Own ambient orb background (`ambient-bg` + `orb-1/2/3` classes) because app/page.tsx orbs are in the App component, not root layout
- Sticky back header: ChevronLeft + "Back" + centered "SETTINGS" mono title; hover transitions accent on back button
- Uses `createClient()` from `lib/supabase/client` to fetch user data on mount via `getUser()`

**Sections:**

ACCOUNT section:
- Email row: Mail icon + email in IBM Plex Mono + "VERIFIED" badge when `email_confirmed_at` exists
- Non-interactive display row

AI COACH section:
- Key status row: KeyRound icon + "Gemini API Key" label + masked key (`AIza••••xxxx`) or "Not connected" in red Mono + Connected/Not set badge
- "Update API key" expandable toggle row: PencilLine icon + ChevronRight that rotates 90deg when expanded; hover bg `rgba(255,255,255,0.03)`
- Expanded panel: password input with show/hide Eye toggle (IBM Plex Mono 14px), "Save key" `.btn-accent` button, success state shows CheckCircle + "Key saved" for 2 seconds then collapses

How API key update works:
```typescript
supabase.auth.updateUser({ data: { gemini_api_key: newKey.trim() } })
// After success: re-fetches user via getUser() to update masked display
```

SESSION section:
- Default row: LogOut icon + "Sign out" text in `var(--red)`, hover `rgba(248,113,113,0.04)`
- On click: row transforms to inline confirmation state (AlertTriangle + warning text + Cancel/Confirm buttons)
- Auto-cancels after 5 seconds via `useEffect` + `setTimeout`

How logout works:
```typescript
await supabase.auth.signOut()
// AuthProvider.onAuthStateChange fires SIGNED_OUT event → router.push('/login')
// No manual redirect needed in settings page
```

---

### Files Modified

**`app/settings/page.tsx`** — created (see above)

**`app/page.tsx`** — Account icon added to nav
- Added imports: `useRouter`, `usePathname` from `next/navigation`; `UserCircle` from `lucide-react`
- `isOnSettings = pathname === "/settings"` — toggles accent color on icon
- Mobile (bottom bar): `UserCircle` button with `lg:hidden` inside the existing flex tab row; `flex-1`, `min-h-[44px]`, same label-upper style as tab labels
- Desktop (sidebar): separate `hidden lg:block mt-auto` div after the tab buttons div, `borderTop: 1px solid var(--border)` divider, full-width button matching tab-btn-active style
- Clicking navigates via `router.push("/settings")` — does NOT call `setActiveTab()`
- TABS array and TAB_COMPONENTS unchanged

**`app/globals.css`** — `@keyframes spin` + `.spin` class added (used by Loader2 in settings save button)

---

### Ambient Orbs Handling

The `ambient-bg` / `orb` CSS classes are defined in `globals.css` and applied as a `position: fixed` layer. Settings page renders its own instance of the same div structure. This is the correct pattern — the orbs are not in `app/layout.tsx`; they live in the App component at `app/page.tsx`. Since `/settings` replaces the App component entirely, settings must include its own orb div to maintain visual consistency.

---

### Design System Compliance

- IBM Plex Mono on all data values: email, masked key, badge text, button labels in confirmation state
- No hardcoded hex colors — all CSS custom properties
- No `transition: all` — all transitions target specific properties
- 44px minimum tap targets on all interactive rows and buttons
- `env(safe-area-inset-top)` on header padding-top for iPhone notch

---

### TypeScript

`npx tsc --noEmit` — zero errors

---

### Threat Model Coverage

- T-06-01 (key display): Key is always masked via `AIza••••${key.slice(-4)}`; input uses `type="password"` with explicit show/hide toggle; full key never rendered in DOM
- T-06-02 (unauth access): `getUser()` returns null for unauthenticated users; email and key default to empty string / null — no sensitive data visible; `AuthProvider.onAuthStateChange` SIGNED_OUT handler redirects to `/login` if session expires while on settings

---

## Self-Check

- [x] `app/settings/page.tsx` exists
- [x] `app/page.tsx` modified with UserCircle + usePathname
- [x] `app/globals.css` modified with spin keyframe
- [x] `npx tsc --noEmit` passes (zero errors)
- [x] No hardcoded hex colors
- [x] IBM Plex Mono on all numeric/data values
- [x] No `transition: all` in new code
- [x] 44px tap targets maintained

## Self-Check: PASSED
