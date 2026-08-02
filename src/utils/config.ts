export interface BackendConfig {
  baseUrl: string;
  skinlibUrl: string;
}

export interface MetadataResponse {
  status: string;
  backend: {
    name: string;
    url: string;
    version: string;
    php_version: string;
    server_time: string;
  };
  message: string;
}

const DEFAULT_CONFIG: BackendConfig = { baseUrl: '', skinlibUrl: '' };

let runtimeConfig: BackendConfig = DEFAULT_CONFIG;

/**
 * 全局后端地址。
 * 应用启动时（main.tsx）通过 initBackendUrl() 一次性确定：
 * - 开发环境：空串（同源），由 Vite dev server 反向代理到 config/backend-dev.json 配置的后端
 * - 生产环境：/config.json 中的 baseUrl
 * 业务代码一律直接引用本变量，禁止自行判断环境。
 */
export let BackendUrl: string = '';

/**
 * 全局皮肤库地址。
 */
export let SkinlibUrl: string = '';

/**
 * 动态更新皮肤库地址。
 */
export function setSkinlibUrl(url: string): void {
  SkinlibUrl = url.replace(/\/$/, '');
}

/**
 * 项目启动时调用：一次性判断当前环境并写入 BackendUrl。
 */
export async function initBackendUrl(): Promise<void> {
  if (import.meta.env.DEV) {
    BackendUrl = '';
    SkinlibUrl = '/skinlib-api';
    return;
  }
  await loadConfig();
  BackendUrl = runtimeConfig.baseUrl.replace(/\/$/, '');
  SkinlibUrl = runtimeConfig.skinlibUrl.replace(/\/$/, '');
}

/**
 * Load the runtime configuration from /config.json (an external file copied
 * verbatim from public/ to the build output, editable without rebuilding).
 * Falls back to the default (same-origin) config if the file is missing or
 * malformed.
 */
export async function loadConfig(): Promise<BackendConfig> {
  try {
    const response = await fetch('/config.json', { cache: 'no-cache' });
    if (response.ok) {
      const data = await response.json() as Partial<BackendConfig>;
      if (typeof data.baseUrl === 'string' && data.baseUrl.trim() !== '' &&
          typeof data.skinlibUrl === 'string' && data.skinlibUrl.trim() !== '') {
        runtimeConfig = { 
          baseUrl: data.baseUrl,
          skinlibUrl: data.skinlibUrl
        };
        return runtimeConfig;
      }
    }
  } catch {
    // Ignore: fall back to the default config below.
  }
  return runtimeConfig;
}

export function getRelayUrl(): string {
  return runtimeConfig.baseUrl.replace(/\/$/, '');
}

let cachedRealBackendUrl: string | null = null;

export async function getRealBackendUrl(): Promise<string> {
  if (cachedRealBackendUrl) {
    return cachedRealBackendUrl;
  }

  const relayUrl = getRelayUrl();
  try {
    const response = await fetch(`${relayUrl}/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json() as MetadataResponse;
      if (data.backend && data.backend.url) {
        cachedRealBackendUrl = data.backend.url.replace(/\/$/, '');
        return cachedRealBackendUrl;
      }
    }
  } catch {
    // If fetch fails, fall back to relay URL
  }

  return relayUrl;
}

export function getApiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return BackendUrl + cleanEndpoint;
}
