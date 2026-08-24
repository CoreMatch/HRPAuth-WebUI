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
