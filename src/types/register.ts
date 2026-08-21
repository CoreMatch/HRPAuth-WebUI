export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  password2: string;
  captcha_token?: string;
  captcha_code?: string;
}

export interface RegisterResponse {
  uid: number;
  profile_id: string;
}

export interface RegisterError {
  success: false;
  message: string;
}

export interface CaptchaResponse {
  success: true;
  token: string;
  image_url: string;
  expires_in: number;
}

export interface CaptchaDisabledResponse {
  success: false;
  message: 'Captcha is disabled';
}

export interface CaptchaEnabledResponse {
  enabled: 0 | 1;
}
