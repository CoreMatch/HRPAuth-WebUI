import { BackendUrl } from './config';

export interface SendEmailRequest {
  to: string;
  subject: string;
  message: string;
}

export interface SendEmailResponse {
  success: boolean;
  message: string;
  data: {
    to: string;
    subject: string;
  };
}

export async function sendTestEmail(data: SendEmailRequest): Promise<SendEmailResponse> {
  try {
    const base = BackendUrl;
    const url = base + '/email-verification';

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: 'send-test-email', ...data }),
    });

    const responseData = await resp.json().catch(() => ({
      success: false,
      message: '服务器返回无法解析的响应',
      data: { to: data.to, subject: data.subject },
    }));

    if (!resp.ok || responseData.success === false) {
      return {
        success: false,
        message: responseData.message || '发送邮件失败',
        data: { to: data.to, subject: data.subject },
      };
    }

    return responseData;
  } catch (error) {
    return {
      success: false,
      message: '网络错误：无法连接到后端。',
      data: { to: data.to, subject: data.subject },
    };
  }
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}