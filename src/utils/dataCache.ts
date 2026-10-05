import { request } from './api';
import { BackendUrl } from './config';
import { getTotpStatus, listWebAuthnCredentials } from '../api/auth';
import { fetchMojangProfile } from '../api/texture';
import { getAuthToken } from './cookie';

export interface UserData {
  email: string;
  username: string;
  avatar?: string;
  verified?: boolean;
  totp_enabled: boolean;
  webauthn_2fa_enabled?: boolean;
  recovery_key_enabled?: boolean;
  uid?: number;
  mbe?: boolean;
  mojang_uuid?: string;
}

export interface TextureInfo {
  texture_type: string;
  url: string;
  model?: string;
}

export interface MojangProfile {
  id: string;
  name: string;
  has_cape: boolean;
}

interface Cache {
  user: UserData | null;
  textures: TextureInfo[] | null;
  totpStatus: any | null;
  webauthnCredentials: any | null;
  mojangProfile: MojangProfile | null;
  lastFetched: number;
}

const cache: Cache = {
  user: null,
  textures: null,
  totpStatus: null,
  webauthnCredentials: null,
  mojangProfile: null,
  lastFetched: 0,
};

const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

export const dataCache = {
  getUser: () => cache.user,
  getTextures: () => cache.textures,
  getTotpStatus: () => cache.totpStatus,
  getWebauthnCredentials: () => cache.webauthnCredentials,
  getMojangProfile: () => cache.mojangProfile,

  setUser: (user: UserData) => {
    cache.user = user;
    cache.lastFetched = Date.now();
  },
  setTextures: (textures: TextureInfo[]) => {
    cache.textures = textures;
    cache.lastFetched = Date.now();
  },
  setTotpStatus: (status: any) => {
    cache.totpStatus = status;
    cache.lastFetched = Date.now();
  },
  setWebauthnCredentials: (creds: any) => {
    cache.webauthnCredentials = creds;
    cache.lastFetched = Date.now();
  },
  setMojangProfile: (profile: MojangProfile) => {
    cache.mojangProfile = profile;
    cache.lastFetched = Date.now();
  },

  isCacheValid: () => {
    return cache.user !== null && (Date.now() - cache.lastFetched < CACHE_TTL);
  },

  prefetch: async () => {
    if (!getAuthToken()) return;
    
    try {
      const [userResp, texturesResp, totpResp, webauthnResp] = await Promise.all([
        request(`${BackendUrl}/user`, { method: 'POST' }),
        request(`${BackendUrl}/texture/get`, { method: 'POST' }),
        getTotpStatus(),
        listWebAuthnCredentials(),
      ]);

      if (userResp.success) {
        cache.user = userResp.data;
        if (userResp.data.mojang_uuid) {
          const mojangProfile = await fetchMojangProfile(userResp.data.mojang_uuid);
          if (mojangProfile) {
            cache.mojangProfile = {
              id: mojangProfile.id,
              name: mojangProfile.name,
              has_cape: mojangProfile.has_cape
            };
          }
        }
      }
      
      if (texturesResp.success && texturesResp.data) {
        cache.textures = texturesResp.data.textures || [];
      }
      
      if (totpResp.success) {
        cache.totpStatus = totpResp.data;
      }
      
      if (webauthnResp.success) {
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
    cache.textures = null;
    cache.totpStatus = null;
    cache.webauthnCredentials = null;
    cache.mojangProfile = null;
    cache.lastFetched = 0;
  }
};
