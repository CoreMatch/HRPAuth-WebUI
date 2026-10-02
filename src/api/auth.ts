import { BackendUrl } from '../utils/config';
import { request, type ApiResponse } from '../utils/api';

export interface LoginTicketResponse {
  totp_required: boolean;
  webauthn_required?: boolean;
  second_factors?: Array<'totp' | 'webauthn'>;
  login_ticket?: string;
  expires_in?: number;
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  uid?: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  uid: string;
}

export interface TotpStatusResponse {
  enabled?: boolean | number;
}

export interface WebAuthnBeginResponse {
  flow_id?: string;
  options?: Record<string, unknown>;
}

export interface WebAuthnCredentialRecord {
  id: number;
  name?: string;
  created_at?: string;
  updated_at?: string;
  last_used_at?: string | null;
}

export interface WebAuthnCredentialListResponse {
  credentials?: WebAuthnCredentialRecord[];
  enabled?: boolean | number;
}

export async function getLoginTicket(email: string, password: string): Promise<ApiResponse<LoginTicketResponse>> {
  const url = `${BackendUrl}/oauth/login-ticket`;
  return request<LoginTicketResponse>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

export async function verifyTotp(
  identifier: string,
  passcode: string,
  isSetup: boolean = false
): Promise<ApiResponse<LoginResponse>> {
  const url = `${BackendUrl}/totp/verify`;
  const body = isSetup
    ? { email: identifier, passcode }
    : { login_ticket: identifier, passcode };

  return request<LoginResponse>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function logout(): Promise<ApiResponse> {
  const url = `${BackendUrl}/logout`;
  return request(url, { method: 'GET' });
}

export async function getTotpStatus(): Promise<ApiResponse<TotpStatusResponse>> {
  const url = `${BackendUrl}/totp/hasbeenenabled`;
  return request<TotpStatusResponse>(url, {
    method: 'POST',
  });
}

export async function setupTotp(email: string): Promise<ApiResponse<{ totpkey?: string }>> {
  const url = `${BackendUrl}/totp/setup`;
  return request<{ totpkey?: string }>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

export async function toggleTotp(enabled: boolean): Promise<ApiResponse<TotpStatusResponse>> {
  const url = `${BackendUrl}/totp/toggle`;
  return request<TotpStatusResponse>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
}

export async function requestAccountDeletion(password: string): Promise<ApiResponse> {
  const url = `${BackendUrl}/user`;
  return request(url, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
}

export async function beginWebAuthnLogin(email?: string): Promise<ApiResponse<WebAuthnBeginResponse>> {
  const url = `${BackendUrl}/webauthn/login/begin`;
  return request<WebAuthnBeginResponse>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(email ? { email } : {}),
  });
}

export async function finishWebAuthnLogin(
  flowId: string,
  credential: Record<string, unknown>
): Promise<ApiResponse<LoginResponse>> {
  const url = `${BackendUrl}/webauthn/login/finish`;
  return request<LoginResponse>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flow_id: flowId, credential }),
  });
}

export async function beginWebAuthnSecondFactor(loginTicket: string): Promise<ApiResponse<WebAuthnBeginResponse>> {
  const url = `${BackendUrl}/webauthn/2fa/begin`;
  return request<WebAuthnBeginResponse>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login_ticket: loginTicket }),
  });
}

export async function finishWebAuthnSecondFactor(
  flowId: string,
  credential: Record<string, unknown>
): Promise<ApiResponse<LoginResponse>> {
  const url = `${BackendUrl}/webauthn/2fa/finish`;
  return request<LoginResponse>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flow_id: flowId, credential }),
  });
}

export async function beginWebAuthnRegistration(
  name?: string,
  attachment?: 'platform' | 'cross-platform'
): Promise<ApiResponse<WebAuthnBeginResponse>> {
  const url = `${BackendUrl}/webauthn/register/begin`;
  const body = JSON.stringify({
    ...(name ? { name } : {}),
    ...(attachment ? { attachment } : {}),
  });

  return request<WebAuthnBeginResponse>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

export async function finishWebAuthnRegistration(
  flowId: string,
  credential: Record<string, unknown>
): Promise<ApiResponse> {
  const url = `${BackendUrl}/webauthn/register/finish`;
  return request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flow_id: flowId, credential }),
  });
}

export async function listWebAuthnCredentials(): Promise<ApiResponse<WebAuthnCredentialListResponse | WebAuthnCredentialRecord[]>> {
  const url = `${BackendUrl}/webauthn/credentials`;
  return request<WebAuthnCredentialListResponse | WebAuthnCredentialRecord[]>(url, {
    method: 'GET',
  });
}

export async function deleteWebAuthnCredential(id: number): Promise<ApiResponse> {
  const url = `${BackendUrl}/webauthn/credentials/${id}`;
  return request(url, {
    method: 'DELETE',
  });
}

export async function toggleWebAuthnSecondFactor(enabled: boolean): Promise<ApiResponse<WebAuthnCredentialListResponse>> {
  const url = `${BackendUrl}/webauthn/2fa/toggle`;
  return request<WebAuthnCredentialListResponse>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
}
