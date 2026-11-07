# ADR-0004: Dual-Backend Configuration: baseUrl and skinlibUrl

- **Status**: accepted

## Context

The app talks to two independent backends — the HRPAuth core (all account/OAuth2
traffic) and HASkinLib (the public skin library) — and must work both behind the
Vite dev proxy and as fully static production assets served from any web server.
The backend addresses therefore cannot be baked in at compile time.

## Decision

Configuration is a two-field contract `{ baseUrl, skinlibUrl }`
(`src/utils/config.ts:L1-L4 ~ export interface BackendConfig {`), resolved differently per environment:

- **Production**: `initBackendUrl()` (called from `src/main.tsx:L17-L17 ~ await initBackendUrl();`) fetches
  `/config.json` with `cache: 'no-cache'` (`src/utils/config.ts:L46-L90 ~ initBackendUrl + production load/all-or-nothing validation`).
  The file is the verbatim copy of `public/config.json` in the build output and
  **can be edited after building without recompiling** (`README.md:L43-L52 ~ Edit `public/config.json`. **Both fields are req`).
- **All-or-nothing validation**: both fields must be non-empty strings, otherwise
  the whole file is ignored and the app falls back to empty defaults
  (`DEFAULT_CONFIG`, `src/utils/config.ts:L18-L81 ~ DEFAULT_CONFIG + all-or-nothing field validation`). There is no partial apply.
- **Dev**: `BackendUrl = ''` (same-origin) and `SkinlibUrl = '/skinlib-api'`
  (`src/utils/config.ts:L46-L51 ~ export async function initBackendUrl(): Promise<`); the Vite dev server reverse-proxies
  `/skinlib-api/*` to `skinlibUrl` (with path rewrite) and everything non-static
  to `baseUrl`, both read from `config/backend-dev.json` at Vite startup
  (`vite.config.ts:L11-L94 ~ BackendConfig interface + dev proxy for baseUrl/skinlibUrl`). A missing or malformed `backend-dev.json` makes
  `npm run dev` fail to start (`README.md:L24-L39 ~ Configure the dev backend proxy by editing config/backend-dev.json`).
- URL values are sanitized (backticks/quotes stripped, trailing slash removed)
  before use (`src/utils/config.ts:L53-L55 ~ 清洗 URL 中的非标准字符（如反引号），防止配置文件格式错误导致 URL 失效。`).
- Extras: `getRelayUrl()`/`getRealBackendUrl()` ask the relay's `/status`
  endpoint for the real backend URL behind it (`src/utils/config.ts:L92-L124 ~ export function getRelayUrl(): string {`); the
  yggdrasil-api SDK page uses this to display/service-info its backend. The
  Skinlib page can override `SkinlibUrl` at runtime via `setSkinlibUrl`
  (`src/utils/config.ts:L39-L41 ~ export function setSkinlibUrl(url: string): void`, `src/pages/Skinlib.tsx:L272-L410 ~ sourceUrl state + setSkinlibUrl on save`).

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

- Config shape and defaults: `src/utils/config.ts:L1-L18 ~ BackendConfig interface + DEFAULT_CONFIG`.
- Startup init: `src/main.tsx:L8-L17 ~ initBackendUrl import + startup call`.
- Production load + all-or-nothing validation: `src/utils/config.ts:L46-L90 ~ initBackendUrl + production load/all-or-nothing validation`.
- Dev-mode values: `src/utils/config.ts:L46-L51 ~ export async function initBackendUrl(): Promise<`.
- Vite proxy wiring and `backend-dev.json` read at startup:
  `vite.config.ts:L11-L94 ~ BackendConfig interface + dev proxy for baseUrl/skinlibUrl`.
- Required-fields deployment guidance: `README.md:L24-L39 ~ dev backend proxy required fields` (dev) and `README.md:L43-L52 ~ production config.json required fields`
  (production, "If either field is missing or empty, the configuration is ignored").
- Checked-in production-pointing values: `public/config.json` (baseUrl
  `https://ha.mcnb.dev/`, skinlibUrl `https://skin.mcnb.dev/`);
  `config/backend-dev.json (field: skinlibUrl)` (local dev HASkinLib at
  `http://127.0.0.1`, port 2701).
- Relay discovery: `src/utils/config.ts:L92-L124 ~ export function getRelayUrl(): string {`; consumer
  `src/generated/services/yggdrasil-api/src/pages/YggdrasilApi.tsx:L35-L35 ~ getRealBackendUrl().then((url: string) => {` (snapshot
  code, see ADR-0005).
- Runtime skinlib override: `src/utils/config.ts:L39-L41 ~ export function setSkinlibUrl(url: string): void`,
  `src/pages/Skinlib.tsx:L49-L410 ~ setSkinlibUrl import + sourceUrl state + save`.
