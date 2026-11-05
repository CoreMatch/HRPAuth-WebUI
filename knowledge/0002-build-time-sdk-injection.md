# ADR-0002: Build-Time SDK Injection: Six Glue Files, Five Mount Points

- **Status**: accepted
- **Date**: 2026-11-04

## Context

Ecosystem services (Yggdrasil-API, HASkinProxy, ...) contribute user-facing pages
to this WebUI. The injection mechanism is compile-time: HA-WebUI-SDKHandler pulls
SDK source packages from the HRPAuth core, unpacks them into this app's source
tree, and compiles one combined frontend (contract: HA-Contract
`docs/dev/HRPAuth/sdk-package.md`). This repository must therefore ship stable
seams where generated code lands.

## Decision

The seam consists of **six generated glue files** under `src/generated/`, each
carrying the header "GENERATED — DO NOT EDIT. This file is overwritten by
HA-WebUI-SDKHandler at build time." and each exporting one empty placeholder array
in this repository:

| Glue file | Export | Mount point (host code) |
|---|---|---|
| `sdk-manifest.ts` | `sdkManifest` | metadata for the other generators |
| `sdk-routes.tsx` | `sdkRouteElements` | `src/App.tsx:51` inside `<Routes>` |
| `sdk-navbar.tsx` | `sdkNavbarItems` | `src/components/Navbar.tsx:179` |
| `sdk-dashboard.tsx` | `sdkDashboardItems` | `src/pages/Dashboard.tsx:46` |
| `sdk-profile-cards.tsx` | `sdkProfileCards` | `src/pages/Profile.tsx:70` |
| `sdk-critical-operations.ts` | `sdkCriticalOperations` | `src/pages/AccountSecurity.tsx:1354-1356` |

Supporting rules:

- **The type contract is hand-maintained here, not generated**:
  `src/types/generated-sdk.ts` defines `SdkManifestEntry`, `SdkNavbarItem`,
  `SdkDashboardItem`, `SdkCriticalOperationItem`, `SdkProfileCardItem`, and its
  header comment points to HA-Contract `sdk-package.md` as the contract source
  (`src/types/generated-sdk.ts:1-5`).
- **SDK-declared npm dependencies must be pre-installed in this host**: SDK
  manifests may declare dependencies (e.g. `skinview3d`), and this `package.json`
  carries `skinview3d ^3.4.2` accordingly (`package.json` dependencies;
  yggdrasil-api SDK `manifest.json` `dependencies` block).
- Profile cards render sorted by `priority` with the handler's `loadOrder` as
  tie-breaker (`src/pages/Profile.tsx:70` onward; type fields in
  `src/types/generated-sdk.ts:42-48`).

## Consequences

- A plain `npm run build` of this repository compiles with **zero SDK pages** —
  every placeholder is an empty array, and host components guard on emptiness
  (e.g. `src/pages/AccountSecurity.tsx:1354`). This is the intended standalone
  behavior, not a broken build.
- Editing any `src/generated/sdk-*` file by hand is futile: the next SDKHandler
  build overwrites it. Persistent changes belong in the type contract
  (`src/types/generated-sdk.ts`) or in the SDK packages themselves.
- Adding a new injection surface means adding one glue file + one mount point +
  one type, and updating HA-WebUI-SDKHandler's generator plus the HA-Contract
  mounting contract — three repositories move together.
- Cost: the mount points silently render nothing when the SDK set is empty, so a
  missing service page is usually a packaging/registration problem upstream, not a
  frontend bug; debugging starts at the SDKHandler build, not here.

## Evidence

All paths relative to this repository unless noted.

- Six glue files and their headers: `src/generated/sdk-manifest.ts::sdkManifest`,
  `src/generated/sdk-routes.tsx::sdkRouteElements`,
  `src/generated/sdk-navbar.tsx::sdkNavbarItems`,
  `src/generated/sdk-dashboard.tsx::sdkDashboardItems`,
  `src/generated/sdk-profile-cards.tsx::sdkProfileCards`,
  `src/generated/sdk-critical-operations.ts::sdkCriticalOperations`.
- Mount points: `src/App.tsx:5,51`; `src/components/Navbar.tsx:13,179`;
  `src/pages/Dashboard.tsx:19,46`; `src/pages/Profile.tsx:10,70`;
  `src/pages/AccountSecurity.tsx:38,1354-1356`.
- Hand-maintained type contract: `src/types/generated-sdk.ts:1-48`.
- Host carries SDK dependency: `package.json` dependencies (`skinview3d`);
  declared by the yggdrasil-api SDK manifest
  (`/home/lnb/Desktop/HA/HRPAuth-Yggdrasil-API/sdk/manifest.json`, checked in
  this pass).
- Mounting contract authority: HA-Contract
  `/home/lnb/Desktop/HA/HA-Contract/docs/dev/HRPAuth/sdk-package.md`
  ("Generated Frontend Contract" referenced from `src/types/generated-sdk.ts:3`) —
  checked in this pass.
