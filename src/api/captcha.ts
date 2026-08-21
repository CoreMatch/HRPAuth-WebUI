import { BackendUrl } from '../utils/config';
import { request } from '../utils/api';
import type {
  CaptchaResponse,
  CaptchaEnabledResponse,
} from '../types/register';

export type CaptchaFetchResult =
  | { enabled: true; token: string; imageUrl: string; expiresIn: number }
  | { enabled: false };

/**
 * Query backend captcha global toggle (GET /captcha/enabled).
 */
export async function getCaptchaEnabled(): Promise<boolean> {
  const url = `${BackendUrl}/captcha/enabled`;
  const res = await request<CaptchaEnabledResponse>(url, { method: 'GET' });
  return res.success && res.data?.enabled === 1;
}

export async function requestCaptcha(): Promise<CaptchaFetchResult> {
  const url = `${BackendUrl}/captcha`;

  const res = await request<CaptchaResponse>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.success) {
    if (res.code === 'captcha_disabled') {
      return { enabled: false };
    }
    throw new Error(res.message || 'Failed to load captcha');
  }

  const data = res.data;
  if (!data || !data.token || !data.image_url) {
    throw new Error('Invalid captcha response');
  }

  const imageUrl = data.image_url.startsWith('http')
    ? data.image_url
    : `${BackendUrl}${data.image_url.startsWith('/') ? '' : '/'}${data.image_url}`;

  return {
    enabled: true,
    token: data.token,
    imageUrl,
    expiresIn: data.expires_in ?? 300,
  };
}
