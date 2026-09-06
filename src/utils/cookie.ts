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
  expiresIn?: number,
  remember: boolean = true,
  mbe?: boolean
): void {
  const baseOptions = {
    path: '/',
    sameSite: 'lax' as const,
    secure: window.location.protocol === 'https'
  };

  let expiryDate: Date | undefined;
  let farFuture: Date | undefined;

  if (remember) {
    farFuture = new Date();
    farFuture.setFullYear(farFuture.getFullYear() + 10);

    expiryDate = new Date();
    if (expiresIn) {
      expiryDate.setSeconds(expiryDate.getSeconds() + expiresIn);
    } else {
      expiryDate.setFullYear(expiryDate.getFullYear() + 10);
    }
  }
  // remember=false: 不设置 expires，cookie 为会话级，关闭浏览器即过期

  setCookie('user_email', email, {
    ...baseOptions,
    ...(farFuture ? { expires: farFuture } : {}),
  });

  setCookie('access_token', accessToken, {
    ...baseOptions,
    ...(expiryDate ? { expires: expiryDate } : {}),
  });

  setCookie('refresh_token', refreshToken, {
    ...baseOptions,
    ...(farFuture ? { expires: farFuture } : {}),
  });

  setCookie('uid', uid, {
    ...baseOptions,
    ...(farFuture ? { expires: farFuture } : {}),
  });

  if (verified !== undefined) {
    setCookie('verified', verified.toString(), {
      ...baseOptions,
      ...(farFuture ? { expires: farFuture } : {}),
    });
  }

  if (totp !== undefined) {
    setCookie('totp_enabled', totp.toString(), {
      ...baseOptions,
      ...(farFuture ? { expires: farFuture } : {}),
    });
  }

  if (mbe !== undefined) {
    setCookie('mbe_enabled', mbe.toString(), {
      ...baseOptions,
      ...(farFuture ? { expires: farFuture } : {}),
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

export function getMbeEnabled(): boolean | undefined {
  const mbeEnabled = getCookie('mbe_enabled');
  if (mbeEnabled === null) return undefined;
  return mbeEnabled === 'true';
}

export function setMbeEnabled(mbe: boolean): void {
  const farFuture = new Date();
  farFuture.setFullYear(farFuture.getFullYear() + 10);

  setCookie('mbe_enabled', mbe.toString(), {
    expires: farFuture,
    path: '/',
    sameSite: 'lax',
    secure: window.location.protocol === 'https'
  });
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

export function updateAccessToken(accessToken: string): void {
  setCookie('access_token', accessToken, {
    path: '/',
    sameSite: 'lax',
    secure: window.location.protocol === 'https'
  });
}

export function setRememberLogin(remember: boolean): void {
  const baseOptions = {
    path: '/',
    sameSite: 'lax' as const,
    secure: window.location.protocol === 'https'
  };

  if (remember) {
    const farFuture = new Date();
    farFuture.setFullYear(farFuture.getFullYear() + 10);
    setCookie('remember_login', 'true', { ...baseOptions, expires: farFuture });
  } else {
    setCookie('remember_login', 'true', baseOptions);
  }
}

export function getRememberLogin(): boolean {
  return getCookie('remember_login') === 'true';
}

export function clearAuthCookies(): void {
  deleteCookie('user_email');
  deleteCookie('access_token');
  deleteCookie('refresh_token');
  deleteCookie('uid');
  deleteCookie('verified');
  deleteCookie('totp_enabled');
  deleteCookie('mbe_enabled');
  deleteCookie('remember_login');
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