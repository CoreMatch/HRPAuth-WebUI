# ADR-0005: src/generated/services Snapshots: Dev-Time Copies, Not Build Inputs

- **Status**: accepted

## Context

Besides the six glue files (ADR-0002), `src/generated/` also contains
`services/yggdrasil-api/` and `services/haskinproxy/` — full copies of SDK source
packages. Their presence suggests they participate in the build, and the
yggdrasil-api copy has visibly drifted from its upstream repository. Maintainers
need to know what these directories actually are.

## Decision / Findings

- **They are development-time snapshots of what HA-WebUI-SDKHandler unpacks at
  build time** — the handler's own code documents the layout "包解包在
  `src/generated/services/<name>/`"
  (`/home/lnb/Desktop/HA/hrpauth/HA-WebUI-SDKHandler/internal/inject/generate.go::moduleRef`,
  checked in this pass). In this repository they are reference copies only.
- **No app code imports them.** A repository-wide search for references to
  `generated/services` matches only files inside the snapshots themselves; no
  page, component, or glue file imports from them. They are, however, inside
  `tsconfig.app.json` `include: ["src"]`, so `tsc -b` still type-checks them —
  a type error in a snapshot breaks `npm run build` even though the code is
  unused at runtime.
- **The yggdrasil-api snapshot is stale** relative to
  `HRPAuth-Yggdrasil-API/sdk/` (compared in this pass):
  - manifest `version` is `1.0.0` here vs `1.0.3` upstream;
  - manifest structure differs: three routes (`/mojang-bind`,
    `/texture-management`, `/yggdrasil-api`) plus a `menu` section here, versus
    upstream's single `/yggdrasil-api` route with `dashboard` and `profile_cards`;
  - `ProfileCreationContent.tsx` (game-profile creation) is missing here;
  - `src/api/user.ts`, `src/locales/*.json`, `src/pages/YggdrasilApi.tsx` differ
    from upstream; the content components match.
- **The haskinproxy snapshot is in sync**: `diff -rq` against
  `HASkinProxy/sdk/src` reports no differences and both manifests are version
  `1.0.0` (checked in this pass).

## Consequences

- Nothing breaks at runtime because of the stale snapshot — the pages users see
  come from whatever SDKHandler injects at build time, not from these copies. The
  risk is the opposite: a developer reading or patching
  `src/generated/services/yggdrasil-api/` would be editing dead, outdated code.
  Real changes belong in the upstream SDK repositories.
- Because the snapshots are type-checked, syncing them carelessly (e.g. copying a
  new SDK version whose imports expect new host utilities) can break the build of
  this standalone repository.
- **This package is not published to npm.** `package.json` carries
  `"private": true` and the repository has no publish workflow and no publish
  script. The known consumer (HA-WebUI-SDKHandler) clones this repository by git
  URL, not through npm, so nothing depends on a publish pipeline.

## Evidence

All paths relative to this repository unless noted.

- Snapshot directories: `src/generated/services/yggdrasil-api/`,
  `src/generated/services/haskinproxy/`.
- No external importers: repository-wide search for `generated/services`
  references (only intra-directory hits; checked in this pass).
- Type-check inclusion: `tsconfig.app.json` `include: ["src", "vite-env.d.ts"]`.
- Handler unpack layout:
  `/home/lnb/Desktop/HA/hrpauth/HA-WebUI-SDKHandler/internal/inject/generate.go::moduleRef`.
- Stale manifest: `src/generated/services/yggdrasil-api/manifest.json`
  (version 1.0.0, three routes + `menu` + `dashboard`) vs
  `/home/lnb/Desktop/HA/hrpauth/HRPAuth-Yggdrasil-API/sdk/manifest.json`
  (version 1.0.3, one route + `dashboard` + `profile_cards`).
- File-level drift: `diff -rq src/generated/services/yggdrasil-api/src
  HRPAuth-Yggdrasil-API/sdk/src` — `user.ts`, `en.json`, `zh-CN.json`,
  `YggdrasilApi.tsx` differ; `ProfileCreationContent.tsx` only upstream (checked
  in this pass).
- haskinproxy parity: `diff -rq src/generated/services/haskinproxy/src
  HASkinProxy/sdk/src` — no differences (checked in this pass).
- No npm publish path: npm publishing is abandoned for this repository. The
  former `npm-publish.yml` workflow was removed (commit 28a0009), no publish
  script or publish-related `package.json` field remains, and this repository
  is consumed only as an application, never as an npm package.
