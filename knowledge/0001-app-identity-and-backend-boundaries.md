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
  `client_id = 'hrpauth-webui'` (`src/utils/api.ts:L22-L22 fp=4043818f ~ const CLIENT_ID = 'hrpauth-webui';`). Login goes through
  `POST /oauth/login-ticket` (email + password → login ticket + required second
  factors, `src/api/auth.ts:L65-L73 fp=a6667676 ~ export async function getLoginTicket(email: stri`), then a 2FA verification step, and token
  refresh uses `POST /oauth/token` with `grant_type=refresh_token`
  (`src/utils/api.ts:L40-L82 fp=f8035b31 ~ async function tryRefreshToken(): Promise<string`). Session state lives in cookies (`access_token`,
  `refresh_token`, `uid`, `user_email`, plus feature flags;
  `src/utils/cookie.ts:L98-L133 fp=2ea91899 ~ setCookie('user_email', email, {`).
- **Backend 1 — HRPAuth core** at `baseUrl`: all account/OAuth2/user endpoints.
- **Backend 2 — HASkinLib** at `skinlibUrl`: only the first-party Skinlib page
  (texture browse/upload/delete; applying a texture to the logged-in user goes
  to Backend 3 through the `/yggdrasil-api` relay prefix instead,
  `src/api/texture.ts:L13-L124 fp=0354e9c0 ~ const url = `${SkinlibUrl}/texture/upload`;`).
- **Backend 3 — HRPAuth-Yggdrasil-API**: never addressed directly. Its pages are
  injected via SDK packages and call the service through the core's relay under
  the `/yggdrasil-api` path prefix on `baseUrl` (README "Backend dependencies",
  `README.md:L62-L66 fp=e26a87ab ~ Backend dependencies`).
- **Sibling projects**: `HA-WebUI-SDKHandler` uses this repository as its build
  template — it clones this repo, unpacks SDK packages into
  `src/generated/services/<name>/`, overwrites the `src/generated/sdk-*.ts(x)`
  glue files, and compiles the result (SDKHandler config defaults
  `TemplateGitURL = https://github.com/CoreMatch/HRPAuth-WebUI.git`, checked in
  `/home/lnb/Desktop/HA/HA-WebUI-SDKHandler/internal/config/config.go (field: TemplateGitURL)`).
- **Default branch is `104`**, not `main` (`README.md:L16-L17 fp=4a073b43 ~ 1. Clone (default branch: 104)`; remote HEAD points
  at `origin/104`).

## Consequences

- Building this repository standalone (`npm run build`) yields a working portal
  with **no service pages injected** — the glue files ship as empty placeholders
  (ADR-0002). The full multi-service UI only exists in SDKHandler-driven builds.
- Operators must run and configure three systems for a complete deployment (core,
  skinlib, yggdrasil-api), and the README lists core + skinlib as hard
  prerequisites (`README.md:L9-L11 fp=869f929f ~ - Node.js and npm (Node ≥ 22 recommended)`).
- The `package.json` name "HRPAuth" (line 2) collides in reading with the backend
  project of the same name; the canonical repository name is HRPAuth-WebUI.
- Because the app trusts `baseUrl` for all authenticated calls, a deployment that
  points `baseUrl` at the wrong host silently breaks login rather than failing at
  build time (configuration semantics in ADR-0004).

## Evidence

All paths relative to this repository unless noted.

- OAuth2 client id and refresh flow: `src/utils/api.ts:L22-L82 fp=027f9b60 ~ CLIENT_ID const + tryRefreshToken flow`.
- Login-ticket flow: `src/api/auth.ts:L65-L73 fp=a6667676 ~ export async function getLoginTicket(email: stri`; second-factor selection in
  `src/pages/Login.tsx:L293-L340 fp=081665de ~ const res = await getLoginTicket(email, password`.
- Cookie session state: `src/utils/cookie.ts:L98-L133 fp=2ea91899 ~ setCookie('user_email', email, {`.
- Skinlib calls go to `SkinlibUrl` (the apply call goes to the yggdrasil-api
  relay): `src/api/texture.ts:L13-L124 fp=0354e9c0 ~ texture API calls (Skinlib browse/upload/delete + yggdrasil apply)`.
- Yggdrasil pages reached via core relay prefix: `README.md:L62-L66 fp=e26a87ab ~ Backend dependencies`.
- SDKHandler template relationship:
  `/home/lnb/Desktop/HA/HA-WebUI-SDKHandler/internal/config/config.go (field: TemplateGitURL)`
  (checked in this pass).
- Default branch: `README.md:L16-L17 fp=4a073b43 ~ 1. Clone (default branch: 104)`; `git remote show origin` HEAD → `origin/104`
  (checked in this pass).
- package.json identity: `package.json:L2-L4 fp=bd670645 ~ "name": "HRPAuth",` (name "HRPAuth", version 0.0.3,
  private).
