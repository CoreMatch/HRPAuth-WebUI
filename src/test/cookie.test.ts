import { describe, it, expect, beforeEach } from 'vitest';
import {
  setCookie,
  getCookie,
  deleteCookie,
  setAuthCookies,
  getAuthToken,
  getUserEmail,
  getUid,
  clearAuthCookies,
  getVerified,
  getTotpEnabled,
  setTotpEnabled
} from '../utils/cookie';

const clearAllCookies = (): void => {
  document.cookie.split(';').forEach((cookie) => {
    const name = cookie.split('=')[0].trim();
    if (name) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  });
};

describe('cookie utilities', () => {
  beforeEach(() => {
    clearAllCookies();
  });

  describe('setCookie / getCookie', () => {
    it('sets and reads a simple cookie', () => {
      setCookie('foo', 'bar');
      expect(getCookie('foo')).toBe('bar');
    });

    it('returns null for missing cookies', () => {
      expect(getCookie('missing')).toBeNull();
    });

    it('encodes and decodes special characters', () => {
      setCookie('email', 'a@b.com');
      expect(getCookie('email')).toBe('a@b.com');
    });
  });

  describe('deleteCookie', () => {
    it('removes an existing cookie', () => {
      setCookie('foo', 'bar');
      expect(getCookie('foo')).toBe('bar');
      deleteCookie('foo');
      expect(getCookie('foo')).toBeNull();
    });
  });

  describe('setAuthCookies', () => {
    it('persists email, tokens, and uid through helpers', () => {
      setAuthCookies('user@example.com', 'access123', 'refresh456', '42');
      expect(getUserEmail()).toBe('user@example.com');
      expect(getUid()).toBe('42');
      expect(getAuthToken()).toBe('access123');
    });

    it('persists verified and totp flags when provided', () => {
      setAuthCookies('user@example.com', 'access123', 'refresh456', '42', true, false);
      expect(getVerified()).toBe(true);
      expect(getTotpEnabled()).toBe(false);
    });

    it('does not set verified/totp cookies when omitted', () => {
      setAuthCookies('user@example.com', 'access123', 'refresh456', '42');
      expect(getVerified()).toBeUndefined();
      expect(getTotpEnabled()).toBeUndefined();
    });
  });

  describe('getAuthToken / getUid', () => {
    it('returns null when access_token cookie is missing', () => {
      expect(getAuthToken()).toBeNull();
      expect(getUid()).toBeNull();
    });
  });

  describe('setTotpEnabled / clearAuthCookies', () => {
    it('toggles the totp_enabled cookie', () => {
      setTotpEnabled(true);
      expect(getTotpEnabled()).toBe(true);
      setTotpEnabled(false);
      expect(getTotpEnabled()).toBe(false);
    });

    it('clears all auth-related cookies', () => {
      setAuthCookies('user@example.com', 'access123', 'refresh456', '42', true, true);
      clearAuthCookies();
      expect(getUserEmail()).toBeNull();
      expect(getUid()).toBeNull();
      expect(getAuthToken()).toBeNull();
      expect(getVerified()).toBeUndefined();
      expect(getTotpEnabled()).toBeUndefined();
    });
  });
});
