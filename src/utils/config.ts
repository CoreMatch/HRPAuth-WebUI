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
  SkinlibUrl = url.replace(/[`'"]/g, '').replace(/\/$/, '');
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
  // 清洗 URL 中的非标准字符（如反引号），防止配置文件格式错误导致 URL 失效。
  BackendUrl = runtimeConfig.baseUrl.replace(/[`'"]/g, '').replace(/\/$/, '');
  SkinlibUrl = runtimeConfig.skinlibUrl.replace(/[`'"]/g, '').replace(/\/$/, '');
}

/**
 * Load the runtime configuration from /config.json (an external file copied
 * verbatim from public/ to the build output, editable without rebuilding).
 * Falls back to the default (same-origin) config if the file is missing or
 * malformed.
 */
export async function loadConfig(): Promise<BackendConfig> {
  try {
    const configUrl = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/config.json`.replace(/^\/\//, '/');
    console.log(`[Config] 正在从 ${configUrl} 加载生产环境配置...`);
    const response = await fetch(configUrl, { cache: 'no-cache' });
    if (response.ok) {
      const data = await response.json() as Partial<BackendConfig>;
      console.log('[Config] 成功加载配置:', data);
      if (typeof data.baseUrl === 'string' && data.baseUrl.trim() !== '' &&
          typeof data.skinlibUrl === 'string' && data.skinlibUrl.trim() !== '') {
        runtimeConfig = { 
          baseUrl: data.baseUrl.replace(/[`'"]/g, ''),
          skinlibUrl: data.skinlibUrl.replace(/[`'"]/g, '')
        };
        return runtimeConfig;
      } else {
        console.error('[Config] 配置内容格式不正确:', data);
      }
    } else {
      console.error(`[Config] 无法获取配置: ${response.status} ${response.statusText}`);
    }
  } catch (err) {
    console.error('[Config] 加载配置时发生错误:', err);
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
