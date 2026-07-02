import { getBackendUrl } from '../utils/config';
import type { RegisterRequest, RegisterResponse, RegisterError } from '../types/register';

export type RegisterApiResult = (RegisterResponse | RegisterError) & { code?: string };

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
      let code: string | undefined;

      if (statusCode === 500) {
        message = '服务器内部错误，请稍后重试';
      } else if (statusCode === 409) {
        if (body?.message === 'Email already registered') {
          message = '邮箱已被注册';
          code = 'email_exists';
        } else if (body?.message === 'Username already taken') {
          message = '用户名已被占用';
          code = 'username_exists';
        } else {
          message = '资源冲突';
        }
      } else if (statusCode === 400) {
        if (body?.message === 'Invalid or expired captcha') {
          message = '验证码错误或已过期，请重新输入';
          code = 'invalid_captcha';
        } else if (body?.message === 'Invalid email') {
          message = '邮箱格式不合法';
          code = 'invalid_email';
        } else if (body?.message === 'Username too short') {
          message = '用户名太短，至少需要3个字符';
          code = 'username_too_short';
        } else if (body?.message === 'Password too short') {
          message = '密码太短，至少需要6个字符';
          code = 'password_too_short';
        } else {
          message = body?.message || '请求参数错误';
        }
      } else if (statusCode === 429) {
        message = '请求过于频繁，请稍后重试';
        code = 'rate_limit';
      } else if (statusCode === 405) {
        message = '请求方法错误';
      }

      return {
        success: false,
        message,
        code,
      };
    }

    if (body?.success === false) {
      const message = body.message || '注册失败';
      const code = body.message === 'Invalid or expired captcha' ? 'invalid_captcha' : undefined;
      return {
        success: false,
        message,
        code,
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
