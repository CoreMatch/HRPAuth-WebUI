# HRPAuth WebUI

[English](README.md)

[HRPAuth](https://github.com/CoreMatch/HRPAuth) 认证核心的官方 Web 前端。提供账号门户（登录、注册、账号安全），并作为生态各服务 SDK 页面在构建期注入的挂载宿主。

## 前置依赖

- Node.js 与 npm（建议 Node ≥ 22）
- 运行中的 [HRPAuth](https://github.com/CoreMatch/HRPAuth) 核心 —— 本前端对接的后端
- 运行中的 [HASkinLib](https://github.com/CoreMatch/HASkinLib) 服务 —— 皮肤库后端

## 快速开始（开发）

```bash
# 1. 克隆（默认分支：104）
git clone https://github.com/CoreMatch/HRPAuth-WebUI.git
cd HRPAuth-WebUI

# 2. 安装依赖
npm install
```

编辑 `config/backend-dev.json` 配置开发态后端代理，**两个字段都必填**：

```json
{
  "baseUrl": "https://your-hrpauth-core.example.com",
  "skinlibUrl": "https://your-skinlib.example.com"
}
```

然后启动开发服务器：

```bash
npm run dev
```

注意：缺少 `skinlibUrl` 时 `npm run dev` 无法启动。

## 生产配置

编辑 `public/config.json`，**两个字段都必填**：

```json
{
  "baseUrl": "https://your-hrpauth-core.example.com",
  "skinlibUrl": "https://your-skinlib.example.com"
}
```

该文件构建时复制到 `dist/config.json`，部署后仍可直接编辑、无需重新构建。任一字段缺失或为空时，配置整体被忽略并回落为空默认值。

## 构建与部署

```bash
npm run build
```

`dist/` 产物为纯静态文件，任意 Web 服务器均可托管；需配置 SPA 回退到 `index.html`（Apache 示例见 [`htaccess.example`](htaccess.example)）。

## 后端依赖

- `baseUrl` —— HRPAuth 核心 API。
- `skinlibUrl` —— HASkinLib 皮肤库服务。
- Yggdrasil 相关页面经 `baseUrl` 上的 `/yggdrasil-api` 路径前缀访问 [HRPAuth-Yggdrasil-API](https://github.com/CoreMatch/HRPAuth-Yggdrasil-API) 服务（由 HRPAuth 核心对外暴露）。

## SDK 页面

额外的服务页面可通过 SDK 包在构建期注入（由 [HA-WebUI-SDKHandler](https://github.com/CoreMatch/HA-WebUI-SDKHandler) 聚合）。SDK 包格式与挂载契约见 HA-Contract [`docs/dev/HRPAuth/sdk-package.md`](https://github.com/CoreMatch/HA-Contract/blob/main/docs/dev/HRPAuth/sdk-package.md)。

## 文档

- API 标准：[HA-Contract `docs/api/README.md`](https://github.com/CoreMatch/HA-Contract/blob/main/docs/api/README.md)
- SDK 包契约：[HA-Contract `docs/dev/HRPAuth/sdk-package.md`](https://github.com/CoreMatch/HA-Contract/blob/main/docs/dev/HRPAuth/sdk-package.md)

## 许可

[AGPL-3.0](LICENSE)
