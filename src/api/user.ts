import { BackendUrl } from '../utils/config';
import { request, type ApiResponse } from '../utils/api';

export interface MojangBindResponse {
  uid: number;
  mbe: 0 | 1;
}

export async function enableMojangBind(): Promise<ApiResponse<MojangBindResponse>> {
  return request<MojangBindResponse>(`${BackendUrl}/user/mojang-bind-enable`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function disableMojangBind(): Promise<ApiResponse<MojangBindResponse>> {
  return request<MojangBindResponse>(`${BackendUrl}/user/mojang-bind-disable`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}

export interface ChangeEmailParams {
  new_email: string;
  totp_code?: string;
  email_code?: string;
  recovery_key?: string;
  webauthn?: {
    flow_id: string;
    credential: Record<string, unknown>;
  };
}

export async function sendChangeEmailCode(): Promise<ApiResponse> {
  return request(`${BackendUrl}/user/security/change-email/send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function changeEmail(params: ChangeEmailParams): Promise<ApiResponse> {
  return request(`${BackendUrl}/user/security/change-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}

export async function beginWebAuthnSudo(): Promise<ApiResponse<{ flow_id: string; options: any }>> {
  return request(`${BackendUrl}/user/security/change-email/webauthn-begin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}
