# Knowledge Base

## What This Is

The knowledge base and the contracts have different jobs. **A contract describes a
project's own outward behavior**, so that external developers can build their own
projects against it. **The knowledge base is this project's memo to itself**: it
serves self-hosting and maintenance of this project, and it is not meant to make
external projects accommodate this one. It may therefore record implementation
orientation, boundaries, and why things are designed the way they are — but it never
defines outward behavior.

## Order of Authority

For outward behavior, **the HA-Contract repository is authoritative**: the business
API standard lives in HA-Contract `docs/api/` (OpenAPI under `docs/api/openapi/`),
and the SDK package format and mounting contract this frontend participates in live
in HA-Contract `docs/dev/HRPAuth/sdk-package.md`. This repository keeps no contracts
of its own. The knowledge base only explains internal workings and design rationale.
If an entry here ever appears to contradict a contract, the contract wins and the
entry is stale — fix the entry, never the contract, and surface the conflict to the
owner.

## Format

Each entry is one page in ADR style:

- **Status** (`accepted` / `superseded` / ...), **Date**
- **Context** — the problem and constraints
- **Decision** — what was chosen
- **Consequences** — including costs and limitations
- **Evidence** — `file:line`, protocol entries. Every piece of evidence must
  have been actually checked; anything that could not be verified is marked
  "not verified". Do not fabricate.

## Entries

| # | Title | Status | Date |
|---|-------|--------|------|
| [0001](0001-app-identity-and-backend-boundaries.md) | App Identity and Backend Boundaries | accepted | 2026-11-04 |
| [0002](0002-build-time-sdk-injection.md) | Build-Time SDK Injection: Six Glue Files, Five Mount Points | accepted | 2026-11-04 |
| [0003](0003-no-runtime-sdk-loading.md) | No Runtime SDK Loading: Pages Arrive via Build-Time Injection | accepted | 2026-11-04 |
| [0004](0004-dual-backend-configuration.md) | Dual-Backend Configuration: baseUrl and skinlibUrl | accepted | 2026-11-04 |
| [0005](0005-generated-services-snapshots.md) | src/generated/services Snapshots: Dev-Time Copies, Not Build Inputs | accepted | 2026-11-04 |
