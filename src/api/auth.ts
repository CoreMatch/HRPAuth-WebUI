import { BackendUrl } from '../utils/config';
import { request, type ApiResponse } from '../utils/api';

export interface LoginTicketResponse {
  totp_required: boolean;
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
