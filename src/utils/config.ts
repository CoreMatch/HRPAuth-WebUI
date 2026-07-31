export interface BackendConfig {
  baseUrl: string;
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

const DEFAULT_CONFIG: BackendConfig = { baseUrl: '' };

let runtimeConfig: BackendConfig = DEFAULT_CONFIG;

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
      if (typeof data.baseUrl === 'string' && data.baseUrl.trim() !== '') {
        runtimeConfig = { baseUrl: data.baseUrl };
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

export function getBackendUrl(): string {
  // In dev, use a same-origin empty path so requests are reverse-proxied
  // by the Vite dev server to the backend configured in
  // config/backend-dev.json. This avoids CORS issues during development.
  if (import.meta.env.DEV) {
    return '';
  }
  return getRelayUrl();
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
  const base = getBackendUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return base + cleanEndpoint;
}
