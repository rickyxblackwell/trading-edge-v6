---
quick_task: 260506-szh
name: notification-bell
completed: "2026-05-07"
tags: [notification, ux, bell, session-storage, react-context]
key_files:
  created:
    - app/lib/NotificationContext.tsx
    - app/components/NotificationBell.tsx
  modified:
    - app/lib/types.ts
    - app/components/TradeAlert.tsx
    - app/components/tabs/Coach.tsx
    - app/page.tsx
decisions:
  - "markOneRead simplified: panel open already calls markAllRead, so per-row tap is a no-op — avoids duplicate local state"
  - "Clear all uses sessionStorage.removeItem + page reload to avoid state sync complexity"
  - "Bell fixed top-right z-195; backdrop z-196; panel z-197 — below TradeAlert z-200 and Coach banners z-500"
  - "NotificationProvider wraps full app return inside the existing React fragment in page.tsx"
---

# Quick Task 260506-szh: Notification Bell Summary

**One-liner:** Persistent notification bell with slide-up bottom sheet aggregating trade alerts and coach errors into a sessionStorage-backed audit trail.

## Files Created

- `/app/lib/NotificationContext.tsx` — React context with `NotificationProvider` and `useNotifications` hook. Loads/saves to `sessionStorage("edge_notif_log")` on mount and every change. `addNotification` deduplicates by checking if the last entry has the same title+message. Array capped at 100 entries (T-SZH-02 mitigation).
- `/app/components/NotificationBell.tsx` — Fixed top-right bell button (44px tap target, glass style), red badge dot when unread, 0.6s ring animation on new notifications, slide-up bottom sheet (~62dvh) with drag handle, header, per-type colored icons (warning triangle / clock / key SVGs), 2-line clamped messages, relative timestamps.

## Files Modified

- `app/lib/types.ts` — Added `NotificationType` union and `AppNotification` interface.
- `app/components/TradeAlert.tsx` — Imported `useNotifications`; added `notifiedKeys` ref; calls `addNotification` in both P&L and modal useEffects when a new unique key is detected.
- `app/components/tabs/Coach.tsx` — Imported `useNotifications` in `ChatView`; calls `addNotification` for `rate-limit` and `key-error` on each API failure.
- `app/page.tsx` — Wraps return with `<NotificationProvider>`; mounts `<NotificationBell hidden={showAccount} />` after TradeAlert.

## Commits

- `a075090` feat(quick-260506-szh-01): add AppNotification type, NotificationContext, and NotificationBell component
- `9e62284` feat(quick-260506-szh-01): wire notification sources and mount bell in app shell

## Deviations from Plan

None — plan executed exactly as written. Minor internal simplification: dropped redundant local `setNotifState` / `notifRef` in `NotificationBell` since `markAllRead()` is called on panel open, making per-row state tracking unnecessary.

## Known Stubs

None.

## Threat Flags

None beyond what was modeled in the plan (T-SZH-01: no PII beyond P&L values; T-SZH-02: 100-entry cap implemented).

## Self-Check

- [x] `app/lib/NotificationContext.tsx` — exists
- [x] `app/components/NotificationBell.tsx` — exists
- [x] `app/lib/types.ts` exports `AppNotification` and `NotificationType`
- [x] Commits a075090 and 9e62284 exist
- [x] `npx tsc --noEmit` — zero errors
