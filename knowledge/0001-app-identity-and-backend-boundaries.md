# ADR-0001: App Identity and Backend Boundaries

- **Status**: accepted

## Context

This repository (`CoreMatch/HRPAuth-WebUI`, checkout directory named
`HRPAuth-Web`) is easy to misread: its `package.json` name is "HRPAuth", it talks
to several different backends, and part of its page tree is injected by another
project at build time. This entry pins down what the app is and where its edges
run.

## Decision

The app is the **official account-portal frontend of the HRPAuth core** (login,
registration, account security, profile, dashboard), and additionally the **host
application for build-time SDK page injection** (ADR-0002). Its boundaries:

- **Identity**: an OAuth2 client of the HRPAuth core with hardcoded
  `client_id = 'hrpauth-webui'` (`src/utils/api.ts:22`). Login goes through
  `POST /oauth/login-ticket` (email + password → login ticket + required second
  factors, `src/api/auth.ts:65-73`), then a 2FA verification step, and token
  refresh uses `POST /oauth/token` with `grant_type=refresh_token`
  (`src/utils/api.ts:40-82`). Session state lives in cookies (`access_token`,
  `refresh_token`, `uid`, `user_email`, plus feature flags;
  `src/utils/cookie.ts:98-133`).
- **Backend 1 — HRPAuth core** at `baseUrl`: all account/OAuth2/user endpoints.
- **Backend 2 — HASkinLib** at `skinlibUrl`: only the first-party Skinlib page
  (texture browse/upload/apply/delete, `src/api/texture.ts:13-101`).
- **Backend 3 — HRPAuth-Yggdrasil-API**: never addressed directly. Its pages are
  injected via SDK packages and call the service through the core's relay under
  the `/yggdrasil-api` path prefix on `baseUrl` (README "Backend dependencies",
  `README.md:62-66`).
- **Sibling projects**: `HA-WebUI-SDKHandler` uses this repository as its build
  template — it clones this repo, unpacks SDK packages into
  `src/generated/services/<name>/`, overwrites the `src/generated/sdk-*.ts(x)`
  glue files, and compiles the result (SDKHandler config defaults
  `TemplateGitURL = https://github.com/CoreMatch/HRPAuth-WebUI.git`, checked in
  `/home/lnb/Desktop/HA/HA-WebUI-SDKHandler/internal/config/config.go (field: TemplateGitURL)`).
- **Default branch is `104`**, not `main` (`README.md:16-17`; remote HEAD points
  at `origin/104`).

## Consequences

- Building this repository standalone (`npm run build`) yields a working portal
  with **no service pages injected** — the glue files ship as empty placeholders
  (ADR-0002). The full multi-service UI only exists in SDKHandler-driven builds.
- Operators must run and configure three systems for a complete deployment (core,
  skinlib, yggdrasil-api), and the README lists core + skinlib as hard
  prerequisites (`README.md:9-11`).
- The `package.json` name "HRPAuth" (line 2) collides in reading with the backend
  project of the same name; the canonical repository name is HRPAuth-WebUI.
- Because the app trusts `baseUrl` for all authenticated calls, a deployment that
  points `baseUrl` at the wrong host silently breaks login rather than failing at
  build time (configuration semantics in ADR-0004).

## Evidence

All paths relative to this repository unless noted.

- OAuth2 client id and refresh flow: `src/utils/api.ts:22,40-82`.
- Login-ticket flow: `src/api/auth.ts:65-73`; second-factor selection in
  `src/pages/Login.tsx:293-340`.
- Cookie session state: `src/utils/cookie.ts:98-133`.
- Skinlib calls go to `SkinlibUrl`: `src/api/texture.ts:13,38,47,90,101`.
- Yggdrasil pages reached via core relay prefix: `README.md:62-66`.
- SDKHandler template relationship:
  `/home/lnb/Desktop/HA/HA-WebUI-SDKHandler/internal/config/config.go (field: TemplateGitURL)`
  (checked in this pass).
- Default branch: `README.md:16-17`; `git remote show origin` HEAD → `origin/104`
  (checked in this pass).
- package.json identity: `package.json:2-4` (name "HRPAuth", version 0.0.3,
  private).
