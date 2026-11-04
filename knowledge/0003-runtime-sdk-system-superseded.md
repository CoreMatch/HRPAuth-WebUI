# ADR-0003: The September Runtime SDK System Was Superseded on 2026-10-09

- **Status**: accepted
- **Date**: 2026-11-04

## Context

During September 2026 this app loaded service SDKs **at runtime**: a service
registry discovered microservices, fetched their JS SDK bundles (via the backend
relay / external SDK URLs), mounted them dynamically into shared panels, and
exposed a manual SDK debug loader. Anyone reading old notes or old code references
(`serviceRegistry`, `ServicePanel`, `sdk_url`, `window['<service-name>-sdk']`)
will assume that model is still alive. It is not.

## Decision

Commit `de4e5d4` (2026-10-09, "refactor: replace runtime SDK system with
build-time injected assets") removed the entire runtime loading stack and replaced
it with the build-time injection seams (ADR-0002):

- **Deleted**: `src/utils/serviceRegistry.ts` (146 lines), the runtime SDK type
  declarations `src/types/service-sdk.d.ts` (66 lines), `src/pages/ServiceEmbed.tsx`,
  `src/components/ServicePanel.tsx`, the manual SDK-loading debug UI (DashboardDebug
  shrank by ~238 lines), and the runtime discovery parts of
  `src/api/services.ts`, `Navbar`, `Dashboard`, `main.tsx`.
- **Added**: the generated placeholder files (`sdk-manifest`, `sdk-navbar`,
  `sdk-dashboard`, `sdk-routes`) and the hand-maintained type contract
  `src/types/generated-sdk.ts`.

The direction matches the ecosystem contract: HA-Contract
`docs/dev/HRPAuth/sdk-package.md` states the SDK package model "replaces the old
runtime JS SDK model (`sdk_url` + `window['<service-name>-sdk']`)" and gives the
rationale — HRPAuth is the single trusted broker that validates every package
before acceptance, the SDK handler aggregates accepted packages into a fresh
frontend build, and satellites never serve UI code to browsers directly.

## Consequences

- **No runtime SDK discovery exists anymore.** `src/api/services.ts` now only
  serves the presence/metadata listings used by the dashboard; nothing fetches or
  executes remote JavaScript. A deployment cannot add a service page by pointing
  the app at a new URL — it requires an SDK package on the core plus an
  SDKHandler rebuild.
- Old debugging habits are stale: the DashboardDebug page still exists but only
  inspects a single `/user` (logged-in) or `/status` (anonymous) request/response
  pair (`src/pages/DashboardDebug.tsx:41-70`); it no longer loads SDKs.
- The runtime-era fixes (relay-always loading `9f85acc`, late-listener race fix
  `fb094f7`, debug/registry improvements `6ddf3ba`) are history-only context; the
  failure modes they addressed (remote bundle fetch races) cannot occur in the
  current model.
- Cost of the switch: page availability is coupled to build/publish cadence. A
  service that uploads a new SDK package becomes visible only after the next
  SDKHandler build and redeployment of the static assets.

## Evidence

All paths relative to this repository at commit `cde6689` unless noted.

- Replacement commit: `de4e5d4` (2026-10-09) — message "replace runtime SDK
  system with build-time injected assets"; stat shows deletions of
  `src/utils/serviceRegistry.ts` (-146), `src/types/service-sdk.d.ts` (-66),
  `src/pages/ServiceEmbed.tsx` (-11), `src/components/ServicePanel.tsx` (-67),
  `src/pages/DashboardDebug.tsx` (-238 net), and addition of the four
  `src/generated/sdk-*` files plus `src/types/generated-sdk.ts` (+31).
- Runtime-era history: commits `417cd94` (2026-09-01, service registry),
  `1607f7a` (navbar integration), `573c73f` (dynamic mount/shared panel),
  `170d07d` (external SDK URLs + debug services), `6ddf3ba` (2026-09-03),
  `9f85acc` and `fb094f7` (2026-09-02 relay/race fixes).
- Old model naming (`sdk_url` + `window['<service-name>-sdk']`) and broker
  rationale: HA-Contract `docs/dev/HRPAuth/sdk-package.md`, opening paragraph and
  "Design Positioning" — checked in this pass.
- DashboardDebug's reduced role: `src/pages/DashboardDebug.tsx:41-70` (requests
  `/user` or `/status` only).
