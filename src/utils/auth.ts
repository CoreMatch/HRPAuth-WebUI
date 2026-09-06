import { request } from './api';
import { BackendUrl } from './config';
import { setAuthCookies, setRememberLogin } from './cookie';

/**
 * Shared login-success handler used by both Register (auto-login) and Login pages.
 *
 * Fetches user info, sets auth cookies, and returns the final uid so callers
 * can redirect to the appropriate page.
 */
export async function completeLogin(
  accessToken: string,
  refreshToken: string,
  uid: string,
  email: string,
  rememberMe: boolean = true
): Promise<string> {
  try {
    const userRes = await request(`${BackendUrl}/user`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uid, email }),
    });

    const userData = userRes.data;
    const verified = userRes.success && userData ? userData.verified : undefined;
    const finalUid = userRes.success && userData ? userData.uid : uid;
    const totpEnabled = userRes.success && userData ? Boolean(userData.totp_enabled) : undefined;

    setAuthCookies(email, accessToken, refreshToken, String(finalUid), verified, totpEnabled, undefined, rememberMe);
    setRememberLogin(rememberMe);
    return String(finalUid);
  } catch {
    setAuthCookies(email, accessToken, refreshToken, uid, undefined, undefined, undefined, rememberMe);
    setRememberLogin(rememberMe);
    return uid;
  }
}
