import { BackendUrl } from '../utils/config';
import type {
  CaptchaResponse,
  CaptchaDisabledResponse,
  CaptchaEnabledResponse,
} from '../types/register';

export type CaptchaFetchResult =
  | { enabled: true; token: string; imageUrl: string; expiresIn: number }
  | { enabled: false };

type CaptchaErrorBody = { success?: boolean; message?: string };

/**
 * Query backend captcha global toggle (GET /captcha/enabled).
 * Per doc section 4.4: frontend should use this on register page load
 * to decide whether to show the captcha input.
 */
export async function getCaptchaEnabled(): Promise<boolean> {
  const base = BackendUrl;
  const url = `${base}/captcha/enabled`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const resp = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!resp.ok) {
      return false;
    }

    const data = (await resp.json().catch(() => null)) as CaptchaEnabledResponse | null;
    return data?.enabled === 1;
  } catch {
    clearTimeout(timeoutId);
    return false;
  }
}

export async function requestCaptcha(): Promise<CaptchaFetchResult> {
  const base = BackendUrl;
  const url = `${base}/captcha`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (resp.status === 403) {
      let body: CaptchaDisabledResponse | null = null;
      try {
        body = (await resp.json()) as CaptchaDisabledResponse;
      } catch {
        body = null;
      }
      if (body?.message === 'Captcha is disabled') {
        return { enabled: false };
      }
    }

    const data = (await resp.json().catch(() => null)) as CaptchaResponse | null;

    if (!resp.ok) {
      const errBody = data as CaptchaErrorBody | null;
      throw new Error(errBody?.message || `Failed to load captcha (HTTP ${resp.status})`);
    }

    if (!data || data.success !== true || !data.token || !data.image_url) {
      throw new Error('Invalid captcha response');
    }

    const imageUrl = data.image_url.startsWith('http')
      ? data.image_url
      : `${base}${data.image_url.startsWith('/') ? '' : '/'}${data.image_url}`;

    return {
      enabled: true,
      token: data.token,
      imageUrl,
      expiresIn: data.expires_in ?? 300,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('请求超时，请检查网络连接后重试');
    }
    throw err;
  }
}
