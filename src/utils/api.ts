import { getAuthToken, getRefreshToken, getRememberLogin, updateAccessToken, clearAuthCookies } from './cookie';
import { BackendUrl } from './config';

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  code?: string;
  meta?: {
    request_id: string;
    [key: string]: any;
  };
}

const CLIENT_ID = 'hrpauth-webui';

let isRefreshing = false;
let pendingRequests: Array<{
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}> = [];

function notifyPending(error: Error): void {
  pendingRequests.forEach(({ reject }) => reject(error));
  pendingRequests = [];
}

function notifyPendingWithToken(token: string): void {
  pendingRequests.forEach(({ resolve }) => resolve(token));
  pendingRequests = [];
}

async function tryRefreshToken(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error('no_refresh_token');
  }

  const response = await fetch(`${BackendUrl}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok || !body?.success) {
    throw new Error(body?.message || `refresh_failed_${response.status}`);
  }

  const data = body.data;
  const newAccessToken = data?.access_token;
  const newRefreshToken = data?.refresh_token;

  if (!newAccessToken) {
    throw new Error('no_access_token_in_refresh');
  }

  updateAccessToken(newAccessToken);

  // Refresh token rotation: update refresh_token cookie if a new one is issued
  if (newRefreshToken) {
    const { setCookie } = await import('./cookie');
    setCookie('refresh_token', newRefreshToken, {
      path: '/',
      sameSite: 'lax',
      secure: window.location.protocol === 'https',
    });
  }

  return newAccessToken;
}

function redirectToLogin(): void {
  clearAuthCookies();
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

async function fetchWithAuth(
  url: string,
  options: RequestInit
): Promise<Response> {
  const headers = new Headers(options.headers);
  const token = getAuthToken();

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, { ...options, headers });
}

export async function request<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    let response = await fetchWithAuth(url, options);

    // Handle 401: attempt token refresh if "remember me" was checked
    if (response.status === 401 && getRememberLogin()) {
      if (isRefreshing) {
        // Another refresh is in progress — wait for it
        try {
          const newToken = await new Promise<string>((resolve, reject) => {
            pendingRequests.push({ resolve, reject });
          });
          // Retry with the new token
          const retryHeaders = new Headers(options.headers);
          retryHeaders.set('Authorization', `Bearer ${newToken}`);
          response = await fetch(url, { ...options, headers: retryHeaders });
        } catch {
          return {
            success: false,
            message: '登录已过期，请重新登录',
            code: 'oauth_login_required',
          };
        }
      } else {
        isRefreshing = true;
        try {
          const newToken = await tryRefreshToken();
          notifyPendingWithToken(newToken);
          // Retry with the new token
          const retryHeaders = new Headers(options.headers);
          retryHeaders.set('Authorization', `Bearer ${newToken}`);
          response = await fetch(url, { ...options, headers: retryHeaders });
        } catch (err) {
          notifyPending(err instanceof Error ? err : new Error('refresh_failed'));
          redirectToLogin();
          return {
            success: false,
            message: '登录已过期，请重新登录',
            code: 'oauth_login_required',
          };
        } finally {
          isRefreshing = false;
        }
      }
    } else if (response.status === 401) {
      // "Remember me" not checked — force re-login
      redirectToLogin();
      return {
        success: false,
        message: '登录已过期，请重新登录',
        code: 'oauth_login_required',
      };
    }

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        message: body?.message || `请求失败 (${response.status})`,
        code: body?.code || 'request_failed',
      };
    }

    if (!body || typeof body !== 'object') {
      return {
        success: false,
        message: '服务器返回了无效的响应',
        code: 'invalid_response',
      };
    }

    return body;
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '网络错误',
      code: 'network_error',
    };
  }
}
