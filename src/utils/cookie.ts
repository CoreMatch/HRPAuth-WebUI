import type { CookieOptions } from '../global';

export function setCookie(name: string, value: string, options: CookieOptions = {}): void {
  const { expires, maxAge, domain, path = '/', secure, httpOnly, sameSite = 'lax' } = options;

  let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

  if (expires) {
    cookieString += `; expires=${expires.toUTCString()}`;
  }

  if (maxAge !== undefined) {
    cookieString += `; max-age=${maxAge}`;
  }

  if (domain) {
    cookieString += `; domain=${domain}`;
  }

  cookieString += `; path=${path}`;

  if (secure) {
    cookieString += '; secure';
  }

  if (httpOnly) {
    cookieString += '; httponly';
  }

  cookieString += `; samesite=${sameSite}`;

  document.cookie = cookieString;
}

export function getCookie(name: string): string | null {
  const nameEQ = `${encodeURIComponent(name)}=`;
  const cookies = document.cookie.split(';');

  for (let i = 0; i < cookies.length; i++) {
    let cookie = cookies[i];
    while (cookie.charAt(0) === ' ') {
      cookie = cookie.substring(1, cookie.length);
    }
    if (cookie.indexOf(nameEQ) === 0) {
      return decodeURIComponent(cookie.substring(nameEQ.length, cookie.length));
    }
  }

  return null;
}

export function deleteCookie(name: string, options: Pick<CookieOptions, 'domain' | 'path'> = {}): void {
  const { domain, path = '/' } = options;

  let cookieString = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  cookieString += `; path=${path}`;

  if (domain) {
    cookieString += `; domain=${domain}`;
  }

  document.cookie = cookieString;
}

export function setAuthCookies(
  email: string,
  accessToken: string,
  refreshToken: string,
  uid: string,
  verified?: boolean,
  totp?: boolean,
  expiresIn?: number
): void {
  const expiryDate = new Date();
  if (expiresIn) {
    expiryDate.setSeconds(expiryDate.getSeconds() + expiresIn);
  } else {
    expiryDate.setFullYear(expiryDate.getFullYear() + 10);
  }

  const farFuture = new Date();
  farFuture.setFullYear(farFuture.getFullYear() + 10);

  setCookie('user_email', email, {
    expires: farFuture,
    path: '/',
    sameSite: 'lax',
    secure: window.location.protocol === 'https'
  });

  setCookie('access_token', accessToken, {
    expires: expiryDate,
    path: '/',
    sameSite: 'lax',
    secure: window.location.protocol === 'https'
  });

  setCookie('refresh_token', refreshToken, {
    expires: farFuture,
    path: '/',
    sameSite: 'lax',
    secure: window.location.protocol === 'https'
  });

  setCookie('uid', uid, {
    expires: farFuture,
    path: '/',
    sameSite: 'lax',
    secure: window.location.protocol === 'https'
  });

  if (verified !== undefined) {
    setCookie('verified', verified.toString(), {
      expires: farFuture,
      path: '/',
      sameSite: 'lax',
      secure: window.location.protocol === 'https'
    });
  }

  if (totp !== undefined) {
    setCookie('totp_enabled', totp.toString(), {
      expires: farFuture,
      path: '/',
      sameSite: 'lax',
      secure: window.location.protocol === 'https'
    });
  }
}

export function getVerified(): boolean | undefined {
  const verified = getCookie('verified');
  if (verified === null) return undefined;
  return verified === 'true';
}

export function getTotpEnabled(): boolean | undefined {
  const totpEnabled = getCookie('totp_enabled');
  if (totpEnabled === null) return undefined;
  return totpEnabled === 'true';
}

export function setTotpEnabled(totp: boolean): void {
  const farFuture = new Date();
  farFuture.setFullYear(farFuture.getFullYear() + 10);
  
  setCookie('totp_enabled', totp.toString(), {
    expires: farFuture,
    path: '/',
    sameSite: 'lax',
    secure: window.location.protocol === 'https'
  });
}

export function clearAuthCookies(): void {
  deleteCookie('user_email');
  deleteCookie('access_token');
  deleteCookie('refresh_token');
  deleteCookie('uid');
  deleteCookie('verified');
  deleteCookie('totp_enabled');
}

export function getAuthToken(): string | null {
  return getCookie('access_token');
}

export function getRefreshToken(): string | null {
  return getCookie('refresh_token');
}

export function getUserEmail(): string | null {
  return getCookie('user_email');
}

export function getUid(): string | null {
  return getCookie('uid');
}