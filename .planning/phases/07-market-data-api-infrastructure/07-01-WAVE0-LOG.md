# Phase 07 Wave 0 — Verification Log

Date: 2026-05-06

## Polygon Futures Tier
- Probe URL: https://api.polygon.io/futures/v1/contracts?product_code=ES
- HTTP status: 200
- Polygon tier: full
- Plan 07-03 instruction: Build full fetchPolygonFutures with bars + OI

## Alpha Vantage MCP Reachability
- URL: https://mcp.alphavantage.co/mcp
- HTTP status: 400 (OAuth Bearer token required — apikey query param not accepted)
- Reachable: no (auth method mismatch)
- Plan 07-03 instruction: Use AV direct REST API (https://www.alphavantage.co/query) with ?apikey= param instead of MCP protocol. Same tool palette, simpler implementation.

## Env vars confirmed (Task 1)
- SUPABASE_SERVICE_ROLE_KEY: present
- FRED_API_KEY: present
