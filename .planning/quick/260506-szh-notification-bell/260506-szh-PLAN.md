---
phase: quick-260506-szh
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/lib/types.ts
  - app/lib/NotificationContext.tsx
  - app/components/NotificationBell.tsx
  - app/components/TradeAlert.tsx
  - app/components/tabs/Coach.tsx
  - app/page.tsx
autonomous: true
requirements: [QUICK-260506-SZH]
---

<objective>
Add a persistent notification bell to the app shell that aggregates all user-facing alerts
(revenge trade warnings, overtrading alerts, daily-limit hits, coach rate-limit notices,
coach key errors) into a chronological slide-up log panel.

Purpose: Users currently miss alerts when they dismiss them — this surfaces a persistent audit
trail. The bell badge gives a "you have unread notifications" signal at a glance.

Output:
- app/lib/NotificationContext.tsx — React context, sessionStorage persistence
- app/components/NotificationBell.tsx — bell + slide-up bottom sheet
- Types extended in app/lib/types.ts
- TradeAlert.tsx and Coach.tsx write to notification context on every alert
- page.tsx wraps app with NotificationProvider and mounts NotificationBell
</objective>

<execution_context>
@/Users/richardblackwell/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@/Users/richardblackwell/Trading App Full-Stack V6/.planning/PROJECT.md
@/Users/richardblackwell/Trading App Full-Stack V6/CLAUDE.md

<interfaces>
<!-- Existing types executor must not conflict with — from app/lib/types.ts -->
```typescript
export type TabId = "strategy" | "checklist" | "log" | "coach"
export interface Trade { id: string; date: string; time: string; instrument: string; direction: "long" | "short"; session: string; contracts: number; pnl: number; rmult: number; outcome: "win" | "loss" | "breakeven"; confluences: string[]; notes: string }
export interface CoachingEntry { /* ... */ }
export interface ChatMessage { /* ... */ }
```

<!-- TradeAlert alert types — executor needs these for notification type mapping -->
type Alert.type = "revenge" | "overtrading" | "daily-soft" | "daily-hard"
type Alert.severity = "warning" | "danger"

<!-- Coach.tsx error state shapes — executor needs these for notification injection -->
rateLimitNotice: { message: string; provider: "claude" | "gemini" } | null  (set at line 551)
keyErrorNotice:  { message: string; provider?: "claude" | "gemini" } | null  (set at line 554)

<!-- CSS tokens confirmed present in globals.css -->
--bg2, --bg3, --glass, --glass-md, --border, --border-accent
--red: #f87171, --yellow: #fbbf24
--yellow-subtle: rgba(251,191,36,0.08), --yellow-border: rgba(251,191,36,0.3)
--red-subtle: rgba(248,113,113,0.12), --red-border: rgba(248,113,113,0.3)
--text, --text2, --text3
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Notification type, context, and bell component</name>
  <files>
    app/lib/types.ts,
    app/lib/NotificationContext.tsx,
    app/components/NotificationBell.tsx
  </files>
  <action>
**app/lib/types.ts** — append below the existing exports (do not remove anything):
```typescript
export type NotificationType = "revenge" | "overtrading" | "daily-soft" | "daily-hard" | "rate-limit" | "key-error"

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  message: string
  timestamp: string
  read: boolean
}
```

**app/lib/NotificationContext.tsx** — new file, "use client":
- `NotificationContextValue`: `{ notifications: AppNotification[]; addNotification: (n: Omit<AppNotification, "id" | "timestamp" | "read">) => void; markAllRead: () => void; unreadCount: number }`
- State: `notifications: AppNotification[]` initialised from `sessionStorage.getItem("edge_notif_log")` (parse JSON, fallback `[]`).
- `addNotification`: prepend new entry (newest first) with `id = Math.random().toString(36).slice(2,9)`, `timestamp = new Date().toISOString()`, `read = false`. Write full array back to sessionStorage key `"edge_notif_log"`.
- `markAllRead`: set all `read = true`, persist.
- `unreadCount`: derived from `notifications.filter(n => !n.read).length`.
- Export `NotificationProvider` wrapping children with context, and `useNotifications` hook that throws if used outside provider.

**app/components/NotificationBell.tsx** — new file, "use client":

Structure: `<NotificationBell />` renders a `position: fixed` bell button in the top-right corner, plus the slide-up sheet as a sibling.

Bell button:
- `position: fixed`, `top: calc(12px + env(safe-area-inset-top))`, `right: 16px`, `zIndex: 60`
- `width: 44px`, `height: 44px`, `borderRadius: 12px` — minimum tap target
- Background: `var(--glass-md)`, border `1px solid var(--border)`, `backdropFilter: blur(12px)`
- Icon: Lucide `Bell` (20px) in `var(--text2)`. When `unreadCount > 0`, color shifts to `var(--accent)`.
- Bell ring animation: when `unreadCount` increases (useEffect comparing prev/next), add CSS class `bell-ring` for 0.6s then remove it. The keyframe (defined in the component via a `<style>` tag or global CSS addition — prefer a `<style>` JSX tag inside the component to stay self-contained):
  ```css
  @keyframes bell-ring {
    0%,100% { transform: rotate(0deg); }
    20%     { transform: rotate(-15deg); }
    40%     { transform: rotate(15deg); }
    60%     { transform: rotate(-10deg); }
    80%     { transform: rotate(10deg); }
  }
  .bell-ring { animation: bell-ring 0.6s ease; }
  ```
- Red badge dot: `position: absolute`, `top: 8px`, `right: 8px`, `width: 8px`, `height: 8px`, `borderRadius: 50%`, `background: var(--red)`. Rendered only when `unreadCount > 0`. No count number — just dot per spec.
- `onClick`: toggle `open` state true/false AND call `markAllRead()` on open.

Slide-up bottom sheet:
- Rendered as sibling of bell button (both inside a React fragment).
- Overlay: `position: fixed`, `inset: 0`, `zIndex: 59`, `background: rgba(6,11,20,0.5)`, `backdropFilter: blur(3px)`. Click overlay → close panel.
- Sheet: `position: fixed`, `left: 0`, `right: 0`, `bottom: 0`, `zIndex: 60`, `height: 62vh`, `borderRadius: "20px 20px 0 0"`, `background: var(--bg2)`, `border: 1px solid var(--border)`, `borderBottom: none`, `backdropFilter: blur(12px)`.
- Slide animation: `transform: translateY(100%)` when closed → `translateY(0)` when open. Use `transition: transform 0.3s ease`. Use `display: none` when not open AND not animating (use `isVisible` state: set true on open, false after transitionend — or simply keep mounted and rely on transform).
  Simpler: always render both overlay and sheet but conditional on `open` boolean. Apply `transform` via inline style. Conditionally render with `open ? ... : null` is also fine — the 0.3s slide-in will play on mount if you apply initial transform via `useState` and a `useEffect` that sets it to 0 after mount. Either approach is acceptable — use whichever is cleanest.
- Sheet drag handle: centered `div` at top, `width: 40px`, `height: 4px`, `borderRadius: 2px`, `background: var(--border)`, `margin: 12px auto 0`.
- Header row: "Notifications" title in `var(--text)` 13px mono semibold uppercase tracking-wide. Right side: "Clear all" text button (only shown when `notifications.length > 0`) — clicking it clears sessionStorage and resets state to `[]`.
- Notification list: `overflow-y: auto`, `flex: 1`. Rendered in chronological order (array is prepend/newest-first — render as-is).
- Each notification row:
  - Left icon (24px circle): color/bg based on type:
    - `revenge`, `daily-hard`, `key-error` → `var(--red)` icon on `var(--red-subtle)` bg
    - `overtrading`, `daily-soft`, `rate-limit` → `var(--yellow)` icon on `var(--yellow-subtle)` bg
  - Icon SVGs: warning triangle for `revenge`/`daily-hard`/`overtrading`/`daily-soft`; clock for `rate-limit`; key for `key-error`. Use inline SVG (same pattern as TradeAlert.tsx).
  - Title: 12px mono semibold, color matches icon color
  - Message: 12px regular `var(--text2)`, 2-line clamp (`overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical`)
  - Relative time: 11px `var(--text3)` — reuse the same `relativeTime(iso)` helper (copy the function from Coach.tsx — do not import from Coach.tsx; keep it local in NotificationBell.tsx since Coach.tsx is a tab component).
  - Unread dot: 6px `var(--accent)` dot on the left of the row if `!n.read`. Disappears after `markAllRead`.
  - Row separator: `1px solid var(--border)`.
- Empty state: centered text "No notifications yet" in `var(--text3)` 12px.

Accessibility: `aria-label="Open notifications"` on bell button, `role="dialog"` on sheet, `aria-modal="true"`.
  </action>
  <verify>
    <automated>cd "/Users/richardblackwell/Trading App Full-Stack V6" && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - app/lib/types.ts exports AppNotification and NotificationType
    - app/lib/NotificationContext.tsx exports NotificationProvider and useNotifications
    - app/components/NotificationBell.tsx renders bell + sheet, compiles clean
    - TypeScript noEmit passes
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire sources (TradeAlert + Coach) and mount in page.tsx</name>
  <files>
    app/components/TradeAlert.tsx,
    app/components/tabs/Coach.tsx,
    app/page.tsx
  </files>
  <action>
**app/components/TradeAlert.tsx** — add notification writes:
- Import `useNotifications` from `"../lib/NotificationContext"`.
- Inside `TradeAlert`, call `const { addNotification } = useNotifications()`.
- In the P&L `useEffect` (lines ~98-105): after `setAlert(detected)` is called (when `detected` is non-null and key is not dismissed), also call:
  ```typescript
  addNotification({ type: detected.type, title: detected.title, message: detected.message })
  ```
  Wrap in the same `!dismissedKeys.current.has(detected.key)` guard — don't add duplicate notifications per dismissed key. To prevent re-adding on every re-render, track a `notifiedKeys` ref (separate from `dismissedKeys`): `const notifiedKeys = useRef(new Set<string>())`. Only call `addNotification` if `!notifiedKeys.current.has(detected.key)`, then add the key to `notifiedKeys.current`.
- Apply the same `notifiedKeys` guard to the modal `useEffect` (lines ~108-116) for revenge/overtrading alerts.
- The `alert.type` values ("revenge" | "overtrading" | "daily-soft" | "daily-hard") match `NotificationType` exactly — no mapping needed.

**app/components/tabs/Coach.tsx** — add notification writes:
- Import `useNotifications` from `"../../lib/NotificationContext"`.
- Inside the `Coach` component body, call `const { addNotification } = useNotifications()`.
- At line ~551 (where `setRateLimitNotice` is called), also call:
  ```typescript
  addNotification({ type: "rate-limit", title: "Rate Limit", message: errMsg })
  ```
- At line ~554 (where `setKeyErrorNotice` is called), also call:
  ```typescript
  addNotification({ type: "key-error", title: "API Key Error", message: errMsg })
  ```
- No deduplication needed for coach errors — each API call failure is a distinct event.

**app/page.tsx** — wrap with provider and mount bell:
- Import `NotificationProvider` from `"./lib/NotificationContext"`.
- Import `NotificationBell` from `"./components/NotificationBell"`.
- Wrap the entire return value with `<NotificationProvider>...</NotificationProvider>` as the outermost element (outside the ambient bg divs).
- Mount `<NotificationBell />` as a sibling just before the closing `</NotificationProvider>`, after the `<TradeModal>` and `<TradeAlert>` lines. This ensures the bell sits above the app shell in z-order (it uses `position: fixed` z-60) and is NOT affected by `showAccount` — it is always visible.
  Per spec: "visible on all tabs except Account". Since the bell is always mounted, suppress it when `showAccount` is true by passing a prop: `<NotificationBell hidden={showAccount} />`. In `NotificationBell`, accept `hidden?: boolean` prop and return `null` when `hidden` is true.
  </action>
  <verify>
    <automated>cd "/Users/richardblackwell/Trading App Full-Stack V6" && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - TradeAlert calls addNotification for revenge/overtrading/daily-soft/daily-hard (each unique key fires once per session)
    - Coach calls addNotification for rate-limit and key-error on each API failure
    - page.tsx wraps tree with NotificationProvider, mounts NotificationBell with hidden={showAccount}
    - TypeScript noEmit passes with zero new errors
    - Bell hidden on Account tab, visible on all other tabs
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| sessionStorage → React state | Data is user-local, no server involvement |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-SZH-01 | Information Disclosure | sessionStorage "edge_notif_log" | accept | Notifications contain no PII beyond P&L values already visible in app; sessionStorage cleared on browser close; same origin only |
| T-SZH-02 | Denial of Service | Notification array growth | mitigate | Cap array at 100 entries in addNotification: `const next = [newEntry, ...prev].slice(0, 100)` |
</threat_model>

<verification>
1. `npx tsc --noEmit` — zero errors
2. Open app in browser, log a trade with a loss → open trade modal → bell badge dot appears
3. Tap bell → slide-up panel appears with the revenge trade warning entry
4. Navigate to Account tab → bell disappears
5. Navigate back to any other tab → bell reappears
6. Tap "Clear all" → list empties, badge dot disappears
</verification>

<success_criteria>
- Bell renders fixed top-right, hidden only on Account tab
- Badge dot appears after any TradeAlert or Coach error fires
- Bell rings (0.6s rotation keyframe) when badge count increases
- Slide-up sheet covers ~62vh with glass styling, drag handle, and header
- Each notification row shows: colored icon, type-appropriate SVG, title, 2-line clamped message, relative time
- Unread dot on each entry clears after bell is opened (markAllRead)
- sessionStorage key `edge_notif_log` persists within session, clears on browser close
- `npx tsc --noEmit` passes clean
</success_criteria>

<output>
After completion, create `.planning/quick/260506-szh-notification-bell/260506-szh-SUMMARY.md` with:
- Files created/modified
- Key implementation decisions
- Any deviations from this plan with rationale
</output>
