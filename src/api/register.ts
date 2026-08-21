import { BackendUrl } from '../utils/config';
import { request, type ApiResponse } from '../utils/api';
import type { RegisterRequest, RegisterResponse } from '../types/register';

export async function register(
  data: Omit<RegisterRequest, 'password2'>
): Promise<ApiResponse<RegisterResponse>> {
  const url = `${BackendUrl}/register`;

  return request<RegisterResponse>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}
