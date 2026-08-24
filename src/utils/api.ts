import { getAuthToken } from './cookie';

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

export async function request<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = getAuthToken();
  const headers = new Headers(options.headers);

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const mergedOptions: RequestInit = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, mergedOptions);
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
