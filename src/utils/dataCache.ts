import { request } from './api';
import { BackendUrl } from './config';
import {
  getTwoFactorStatus,
  listWebAuthnCredentials,
  type TwoFactorStatusResponse,
  type WebAuthnCredentialListResponse,
  type WebAuthnCredentialRecord,
} from '../api/auth';
import { getAuthToken, getUid } from './cookie';

export interface UserData {
  email: string;
  username: string;
  avatar?: string;
  verified?: boolean;
  totp_enabled: boolean;
  webauthn_2fa_enabled?: boolean;
  recovery_key_enabled?: boolean;
  email_2fa_enabled?: boolean;
  uid?: number;
  mbe?: boolean;
  mojang_uuid?: string | null;
}

interface MojangProfile {
  id: string;
  name: string;
  has_cape: boolean;
}

interface Cache {
  user: UserData | null;
  twoFactorStatus: TwoFactorStatusResponse | null;
  webauthnCredentials: WebAuthnCredentialListResponse | WebAuthnCredentialRecord[] | null;
  mojangProfile: MojangProfile | null;
  lastFetched: number;
}

const cache: Cache = {
  user: null,
  twoFactorStatus: null,
  webauthnCredentials: null,
  mojangProfile: null,
  lastFetched: 0,
};

const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

export const dataCache = {
  getUser: () => cache.user,
  getTwoFactorStatus: () => cache.twoFactorStatus,
  getWebauthnCredentials: () => cache.webauthnCredentials,
  getMojangProfile: () => cache.mojangProfile,

  setUser: (user: UserData) => {
    cache.user = user;
    cache.lastFetched = Date.now();
  },
  setTwoFactorStatus: (status: TwoFactorStatusResponse) => {
    cache.twoFactorStatus = status;
    cache.lastFetched = Date.now();
  },
  setWebauthnCredentials: (creds: WebAuthnCredentialListResponse | WebAuthnCredentialRecord[]) => {
    cache.webauthnCredentials = creds;
    cache.lastFetched = Date.now();
  },
  setMojangProfile: (profile: MojangProfile | null) => {
    cache.mojangProfile = profile;
    cache.lastFetched = Date.now();
  },

  isCacheValid: () => {
    return cache.user !== null && (Date.now() - cache.lastFetched < CACHE_TTL);
  },

  prefetch: async () => {
    if (!getAuthToken()) return;
    const uid = getUid();
    
    try {
      const [userResp, twoFactorResp, webauthnResp] = await Promise.all([
        request<UserData>(`${BackendUrl}/user`, { method: 'POST' }),
        getTwoFactorStatus(uid || undefined),
        listWebAuthnCredentials(),
      ]);

      if (userResp.success && userResp.data) {
        cache.user = userResp.data;
      }
      
      if (twoFactorResp.success && twoFactorResp.data) {
        cache.twoFactorStatus = twoFactorResp.data;
      }
      
      if (webauthnResp.success && webauthnResp.data) {
        cache.webauthnCredentials = webauthnResp.data;
      }

      cache.lastFetched = Date.now();
      console.log('[DataCache] Prefetch complete');
    } catch (err) {
      console.error('[DataCache] Prefetch failed:', err);
    }
  },

  clear: () => {
    cache.user = null;
    cache.twoFactorStatus = null;
    cache.webauthnCredentials = null;
    cache.mojangProfile = null;
    cache.lastFetched = 0;
  }
};
