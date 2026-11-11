# ADR-0003: No Runtime SDK Loading: Pages Arrive via Build-Time Injection

- **Status**: accepted

## Context

Whether service pages reach the browser at runtime (the app fetches a service's
JS bundle and mounts it) or at build time determines who vouches for the code
users execute. The ecosystem contract settles this: HA-Contract
`docs/dev/HRPAuth/sdk-package.md` defines a compile-time aggregation model in
which HRPAuth is the single trusted broker — satellite services upload SDK
packages to HRPAuth, HRPAuth validates every package before acceptance, the SDK
handler aggregates accepted packages into a fresh frontend build, and satellites
never serve UI code to browsers directly.

## Decision

This app performs **no runtime SDK discovery or loading**: nothing fetches or
executes remote JavaScript, and service pages exist only through the build-time
injection seam (ADR-0002). An earlier runtime-loading model was replaced by this
one because fetching bundles in the browser would bypass the core's package
validation.

## Consequences

- **No runtime SDK discovery.** `src/api/services.ts` only wraps the core's
  presence/route/relay management endpoints; nothing fetches or executes remote
  JavaScript. A deployment cannot add a service page by pointing the app at a
  new URL — it requires an SDK package accepted by the core plus an SDKHandler
  rebuild.
- The DashboardDebug page only inspects a single `/user` (logged-in) or
  `/status` (anonymous) request/response pair
  (`src/pages/DashboardDebug.tsx:L41-L70 fp=6a06a898 ~ const base = BackendUrl;`); it does not load SDKs.
- Page availability is coupled to the build/publish cadence: a service that
  uploads a new SDK package becomes visible only after the next SDKHandler build
  and redeployment of the static assets.

## Evidence

All paths relative to this repository unless noted.

- No SDK discovery in the services API: `src/api/services.ts:L48-L110 fp=51e04e74 ~ **`
  (presence/route/relay wrappers only).
- DashboardDebug's role: `src/pages/DashboardDebug.tsx:L41-L70 fp=6a06a898 ~ const base = BackendUrl;` (requests `/user`
  or `/status` only).
- Broker rationale and compile-time model: HA-Contract
  `/home/lnb/Desktop/HA/hrpauth/HRPAuth/knowledge/0012-sdk-package-contract.md`, opening
  paragraph and "Design Positioning" — checked in this pass.
