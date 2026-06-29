import backendConfig from '../../config/backend.json';

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

let cachedRealBackendUrl: string | null = null;

export function getRelayUrl(): string {
  return backendConfig.baseUrl.replace(/\/$/, '');
}

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

export function getBackendUrl(): string {
  return getRelayUrl();
}

export function getApiUrl(endpoint: string): string {
  const base = getBackendUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return base + cleanEndpoint;
}
