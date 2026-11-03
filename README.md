# HRPAuth WebUI

[中文文档](README.zh-CN.md)

The official web frontend for the [HRPAuth](https://github.com/CoreMatch/HRPAuth) authentication core. It provides the account portal (login, registration, account security) and hosts additional service pages injected from ecosystem SDK packages.

## Prerequisites

- Node.js and npm (Node ≥ 22 recommended)
- A running [HRPAuth](https://github.com/CoreMatch/HRPAuth) core — the backend this UI talks to
- A running [HASkinLib](https://github.com/CoreMatch/HASkinLib) service — the skin library backend

## Quick Start (development)

```bash
# 1. Clone (default branch: 104)
git clone https://github.com/CoreMatch/HRPAuth-WebUI.git
cd HRPAuth-WebUI

# 2. Install dependencies
npm install
```

Configure the dev backend proxy by editing `config/backend-dev.json`. **Both fields are required**:

```json
{
  "baseUrl": "https://your-hrpauth-core.example.com",
  "skinlibUrl": "https://your-skinlib.example.com"
}
```

Then start the dev server:

```bash
npm run dev
```

Note: if `skinlibUrl` is missing, `npm run dev` fails to start.

## Production configuration

Edit `public/config.json`. **Both fields are required**:

```json
{
  "baseUrl": "https://your-hrpauth-core.example.com",
  "skinlibUrl": "https://your-skinlib.example.com"
}
```

The file is copied to `dist/config.json` on build and can be edited afterwards without rebuilding. If either field is missing or empty, the configuration is ignored and the app falls back to empty defaults.

## Build and deploy

```bash
npm run build
```

The build output in `dist/` is fully static — serve it with any web server and configure an SPA fallback to `index.html` (see [`htaccess.example`](htaccess.example) for Apache).

## Backend dependencies

- `baseUrl` — the HRPAuth core API.
- `skinlibUrl` — the HASkinLib skin library service.
- Yggdrasil-related pages call the [HRPAuth-Yggdrasil-API](https://github.com/CoreMatch/HRPAuth-Yggdrasil-API) service through the `/yggdrasil-api` path prefix on `baseUrl`, as exposed by the HRPAuth core.

## SDK pages

Additional service pages can be injected at build time via SDK packages aggregated by [HA-WebUI-SDKHandler](https://github.com/CoreMatch/HA-WebUI-SDKHandler). For the SDK package format and mounting contract, see HA-Contract [`docs/dev/HRPAuth/sdk-package.md`](https://github.com/CoreMatch/HA-Contract/blob/main/docs/dev/HRPAuth/sdk-package.md).

## Documentation

- API standard: [HA-Contract `docs/api/README.md`](https://github.com/CoreMatch/HA-Contract/blob/main/docs/api/README.md)
- SDK package contract: [HA-Contract `docs/dev/HRPAuth/sdk-package.md`](https://github.com/CoreMatch/HA-Contract/blob/main/docs/dev/HRPAuth/sdk-package.md)

## License

[AGPL-3.0](LICENSE)
