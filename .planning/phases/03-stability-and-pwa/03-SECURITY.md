---
phase: 3
slug: stability-and-pwa
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-09
---

# Phase 3 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| component render → TabErrorBoundary | Catches uncaught synchronous render errors from tab components before they propagate to the app shell | React error / non-sensitive |
| user input → Trade.pnl / Trade.rmult | Text field values parsed as numbers before reaching addTrade and Supabase insert | numeric — user-supplied |
| genId() → Trade.id / CoachingEntry.id | ID generation via Web Crypto API (with getRandomValues fallback for non-secure contexts) | UUID v4 |
| manifest.ts → browser install | Static manifest served by Next.js at /manifest.webmanifest; no user input | static config |
| public/ icon files → browser | Static asset delivery (icons, splash, favicons) | public binary |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-03-01-01 | Tampering | TabErrorBoundary reset | accept | Reset via setState only; no external input; boundary cannot be manipulated by user-supplied data | closed |
| T-03-01-02 | Denial of Service | componentDidCatch console.error | accept | Logs to console only; no external write; acceptable for development visibility | closed |
| T-03-02-01 | Tampering | Trade.pnl via TradeForm submit | mitigate | `isNaN(pnlNum)` guard at [TradeForm.tsx:75](app/components/TradeForm.tsx#L75); inline error blocks submit | closed |
| T-03-02-02 | Tampering | Trade.rmult via TradeForm submit | mitigate | `isNaN(rmultNum)` guard at [TradeForm.tsx:76](app/components/TradeForm.tsx#L76); inline error blocks submit | closed |
| T-03-02-03 | Tampering | Trade.id / CoachingEntry.id collision | mitigate | `genId()` uses `crypto.randomUUID()` with `getRandomValues` v4 fallback ([app/lib/genId.ts](app/lib/genId.ts)) — 122 random bits, collision-resistant | closed |
| T-03-03-01 | Spoofing | manifest.ts app identity | accept | Static file convention; no user input in name/icon fields; Next.js serves from trusted app directory | closed |
| T-03-03-02 | Information Disclosure | public/ icon files | accept | Public static assets; no sensitive data; expected to be publicly accessible | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-03-01 | T-03-01-01 | TabErrorBoundary internal state reset cannot be tampered with — no external input path | rickyxblackwell | 2026-05-09 |
| R-03-02 | T-03-01-02 | Console-only error logging is dev-time visibility; no external sink to abuse for DoS | rickyxblackwell | 2026-05-09 |
| R-03-03 | T-03-03-01 | Manifest is static and served from trusted Next.js app directory; no spoofing surface | rickyxblackwell | 2026-05-09 |
| R-03-04 | T-03-03-02 | Icons are intentionally public assets (PWA install + Apple touch icon); no PII | rickyxblackwell | 2026-05-09 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-09 | 7 | 7 | 0 | /gsd-secure-phase 3 (Claude Opus 4.7) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-09
