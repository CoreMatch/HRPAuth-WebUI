export {};

// Allow importing CSS files in TypeScript
declare module '*.css';
declare module '*.png' {
  const value: string;
  export default value;
}
declare module '/revolution.png' {
  const value: string;
  export default value;
}
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.svg';
declare module '*.gif';

export interface LoginResponse {
  success: boolean;
  message: string;
  token: string;
  uid: string;
  totp: number;
}

export interface LoginError {
  success: false;
  message: string;
}

export interface CookieOptions {
  expires?: Date;
  maxAge?: number;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
}
