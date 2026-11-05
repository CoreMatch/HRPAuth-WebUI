# ADR-0004: Dual-Backend Configuration: baseUrl and skinlibUrl

- **Status**: accepted
- **Date**: 2026-11-04

## Context

The app talks to two independent backends — the HRPAuth core (all account/OAuth2
traffic) and HASkinLib (the public skin library) — and must work both behind the
Vite dev proxy and as fully static production assets served from any web server.
The backend addresses therefore cannot be baked in at compile time.

## Decision

Configuration is a two-field contract `{ baseUrl, skinlibUrl }`
(`src/utils/config.ts:1-4`), resolved differently per environment:

- **Production**: `initBackendUrl()` (called from `src/main.tsx:17`) fetches
  `/config.json` with `cache: 'no-cache'` (`src/utils/config.ts:46-56,64-90`).
  The file is the verbatim copy of `public/config.json` in the build output and
  **can be edited after building without recompiling** (`README.md:43-52`).
- **All-or-nothing validation**: both fields must be non-empty strings, otherwise
  the whole file is ignored and the app falls back to empty defaults
  (`DEFAULT_CONFIG`, `src/utils/config.ts:18,72-81`). There is no partial apply.
- **Dev**: `BackendUrl = ''` (same-origin) and `SkinlibUrl = '/skinlib-api'`
  (`src/utils/config.ts:46-51`); the Vite dev server reverse-proxies
  `/skinlib-api/*` to `skinlibUrl` (with path rewrite) and everything non-static
  to `baseUrl`, both read from `config/backend-dev.json` at Vite startup
  (`vite.config.ts:11-16,67-94`). A missing or malformed `backend-dev.json` makes
  `npm run dev` fail to start (`README.md:24-39`).
- URL values are sanitized (backticks/quotes stripped, trailing slash removed)
  before use (`src/utils/config.ts:53-55`).
- Extras: `getRelayUrl()`/`getRealBackendUrl()` ask the relay's `/status`
  endpoint for the real backend URL behind it (`src/utils/config.ts:92-124`); the
  yggdrasil-api SDK page uses this to display/service-info its backend. The
  Skinlib page can override `SkinlibUrl` at runtime via `setSkinlibUrl`
  (`src/utils/config.ts:39-41`, `src/pages/Skinlib.tsx:272,410`).

## Consequences

- **Deployment is a file edit, not a rebuild** — but forgetting to edit
  `public/config.json` means the checked-in values ship. Those currently point at
  the maintainer's infrastructure (`public/config.json`: `baseUrl
  https://ha.mcnb.dev/`, `skinlibUrl https://skin.mcnb.dev/`), so an unedited
  deployment silently calls the original author's servers. Deployers must treat
  `config.json` as mandatory-edit, as the README's production section states.
- The all-or-nothing rule means one typo in either field degrades the app to
  same-origin relative requests (empty `baseUrl`) instead of failing loudly; the
  symptom is network errors in the browser console plus the `[Config]` error logs.
- Dev and prod resolve URLs through different code paths (proxy vs. absolute URL),
  so "works in dev" does not prove `config.json` correctness.
- `skinlibUrl` is the only backend address a user can change at runtime; `baseUrl`
  is fixed at startup.

## Evidence

All paths relative to this repository unless noted.

- Config shape and defaults: `src/utils/config.ts:1-4,18`.
- Startup init: `src/main.tsx:8,17`.
- Production load + all-or-nothing validation: `src/utils/config.ts:46-56,64-90`.
- Dev-mode values: `src/utils/config.ts:46-51`.
- Vite proxy wiring and `backend-dev.json` read at startup:
  `vite.config.ts:11-16,67-94`.
- Required-fields deployment guidance: `README.md:24-39` (dev) and `README.md:43-52`
  (production, "If either field is missing or empty, the configuration is ignored").
- Checked-in production-pointing values: `public/config.json` (baseUrl
  `https://ha.mcnb.dev/`, skinlibUrl `https://skin.mcnb.dev/`);
  `config/backend-dev.json (field: skinlibUrl)` (local dev HASkinLib at
  `http://127.0.0.1`, port 2701).
- Relay discovery: `src/utils/config.ts:92-124`; consumer
  `src/generated/services/yggdrasil-api/src/pages/YggdrasilApi.tsx:35` (snapshot
  code, see ADR-0005).
- Runtime skinlib override: `src/utils/config.ts:39-41`,
  `src/pages/Skinlib.tsx:49,272,410`.
