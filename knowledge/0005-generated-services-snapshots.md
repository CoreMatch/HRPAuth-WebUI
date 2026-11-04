# ADR-0005: src/generated/services Snapshots: Dev-Time Copies, Not Build Inputs

- **Status**: accepted
- **Date**: 2026-11-04

## Context

Besides the six glue files (ADR-0002), `src/generated/` also contains
`services/yggdrasil-api/` and `services/haskinproxy/` — full copies of SDK source
packages. Their presence suggests they participate in the build, and the
yggdrasil-api copy has visibly drifted from its upstream repository. Maintainers
need to know what these directories actually are.

## Decision / Findings

- **They are development-time snapshots of what HA-WebUI-SDKHandler unpacks at
  build time** — the handler's own code documents the layout "包解包在
  `src/generated/services/<name>/`" (`HA-WebUI-SDKHandler/internal/inject/generate.go:28-29`,
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
  - manifest structure is the pre-2026-10-22 shape: three routes (`/mojang-bind`,
    `/texture-management`, `/yggdrasil-api`) plus a `menu` section, versus
    upstream's single `/yggdrasil-api` route with `dashboard` and `profile_cards`
    (upstream commit `fd942af` removed the old route/menu entries);
  - `ProfileCreationContent.tsx` (game-profile creation, upstream commit
    `e328042`, 2026-10-28) is missing here;
  - `src/api/user.ts`, `src/locales/*.json`, `src/pages/YggdrasilApi.tsx` differ
    from upstream; the content components match.
  - The snapshot's own history explains the split state: `manifest.json` was last
    touched by `1a846cd` (2026-10-13) while the source files were re-synced by
    `b76f2cf` (2026-10-28) — a partial sync.
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
- **Gap — publish pipeline contradiction (owner to confirm)**:
  `.github/workflows/npm-publish.yml` runs `npm publish --access public` on every
  GitHub release, but `package.json` sets `"private": true`, which npm refuses to
  publish. The known consumer (HA-WebUI-SDKHandler) clones this repository by git
  URL instead. Whether the npm workflow is dead config or the `private` flag is
  wrong cannot be decided from the code — flagged for the author rather than
  resolved here.

## Evidence

All paths relative to this repository at commit `cde6689` unless noted.

- Snapshot directories: `src/generated/services/yggdrasil-api/`,
  `src/generated/services/haskinproxy/`.
- No external importers: repository-wide search for `generated/services`
  references (only intra-directory hits; checked in this pass).
- Type-check inclusion: `tsconfig.app.json` `include: ["src", "vite-env.d.ts"]`.
- Handler unpack layout: `HA-WebUI-SDKHandler/internal/inject/generate.go:28-29`.
- Stale manifest: `src/generated/services/yggdrasil-api/manifest.json`
  (version 1.0.0, three routes + `menu`) vs `HRPAuth-Yggdrasil-API/sdk/manifest.json`
  (version 1.0.3, one route + `dashboard` + `profile_cards`); upstream commits
  `fd942af` (route/menu cleanup, 2026-10-22) and `e328042` (game profile system,
  2026-10-28).
- Partial sync history: snapshot `manifest.json` last modified in `1a846cd`
  (2026-10-13); source re-sync in `b76f2cf` (2026-10-28, message: "restructure
  pages, add url utils and sdk support").
- File-level drift: `diff -rq src/generated/services/yggdrasil-api/src
  HRPAuth-Yggdrasil-API/sdk/src` — `user.ts`, `en.json`, `zh-CN.json`,
  `YggdrasilApi.tsx` differ; `ProfileCreationContent.tsx` only upstream (checked
  in this pass).
- haskinproxy parity: `diff -rq src/generated/services/haskinproxy/src
  HASkinProxy/sdk/src` — no differences (checked in this pass).
- Publish contradiction: `.github/workflows/npm-publish.yml` (`npm publish
  --access public` on release) vs `package.json:3` (`"private": true`).
