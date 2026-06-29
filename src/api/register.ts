import { getBackendUrl } from '../utils/config';
import type { RegisterRequest, RegisterResponse, RegisterError } from '../types/register';

export type RegisterApiResult = (RegisterResponse | RegisterError) & { code?: string };

function isInvalidCaptcha(statusCode: number, message: string | undefined): boolean {
  return statusCode === 400 && message === 'Invalid or expired captcha';
}

export async function register(
  data: Omit<RegisterRequest, 'password2'>
): Promise<RegisterApiResult> {
  try {
    const base = getBackendUrl();
    const url = `${base}/register`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const statusCode = resp.status;
    const body = await resp.json().catch(() => null) as
      | { success?: boolean; message?: string; uid?: number }
      | null;

    if (!resp.ok) {
      let message = '注册失败';

      if (statusCode === 500) {
        message = '服务器内部错误，请稍后重试';
      } else if (statusCode === 409) {
        message = '邮箱已被注册';
      } else if (statusCode === 400) {
        message = '请求参数错误';
      } else if (statusCode === 405) {
        message = '请求方法错误';
      }

      if (body?.message) {
        message = body.message;
      }
      if (isInvalidCaptcha(statusCode, body?.message)) {
        message = '验证码错误或已过期，请重新输入';
      }

      return {
        success: false,
        message,
        code: isInvalidCaptcha(statusCode, body?.message) ? 'invalid_captcha' : undefined,
      };
    }

    if (body?.success === false) {
      const message = body.message || '注册失败';
      return {
        success: false,
        message,
        code: isInvalidCaptcha(statusCode, message) ? 'invalid_captcha' : undefined,
      };
    }

    return body as RegisterResponse;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          message: '请求超时，请检查网络连接后重试',
        };
      } else if (error.message.includes('Failed to fetch')) {
        return {
          success: false,
          message: '网络错误：无法连接到后端服务器',
        };
      }
    }
    return {
      success: false,
      message: '网络错误：无法连接到后端。',
    };
  }
}
