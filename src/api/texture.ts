import { SkinlibUrl, BackendUrl } from '../utils/config';
import type { 
  TextureListRequest, 
  TextureListResponse, 
  TextureUploadRequest, 
  TextureApiResult,
  TextureItem
} from '../types/texture';

export async function uploadTexture(
  data: TextureUploadRequest
): Promise<TextureApiResult<{ success: true; message: string; data: TextureItem }>> {
  try {
    const url = `${SkinlibUrl}/texture/upload`;
    const formData = new FormData();
    formData.append('uid', data.uid.toString());
    formData.append('type', data.type);
    formData.append('name', data.name);
    if (data.model) formData.append('model', data.model);
    if (data.description) formData.append('description', data.description);
    if (data.tags) formData.append('tags', data.tags);
    formData.append('file', data.file);
    // remember_token is sent via Authorization header to follow skinlib-api.md best practices

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${data.remember_token}`,
      },
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const body = await resp.json().catch(() => null);

    if (!resp.ok) {
      return {
        success: false,
        message: body?.message || `上传失败 (${resp.status})`,
      };
    }

    return body;
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '网络错误',
    };
  }
}

export async function listTextures(
  params: TextureListRequest = {}
): Promise<TextureApiResult<TextureListResponse>> {
  try {
    const query = new URLSearchParams();
    if (params.type) query.append('type', params.type);
    if (params.order) query.append('order', params.order);
    if (params.tag) query.append('tag', params.tag);
    if (params.page) query.append('page', params.page.toString());

    const url = `${SkinlibUrl}/texture/listpreview${query.toString() ? `?${query.toString()}` : ''}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const resp = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const body = await resp.json().catch(() => null);

    if (!resp.ok) {
      return {
        success: false,
        message: body?.message || `获取列表失败 (${resp.status})`,
      };
    }

    return body;
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '网络错误',
    };
  }
}

export async function pullTexture(hash: string): Promise<Blob | { success: false; message: string }> {
  try {
    const url = `${SkinlibUrl}/texture/pull/${hash}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const resp = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!resp.ok) {
      const body = await resp.json().catch(() => null);
      return {
        success: false,
        message: body?.message || `拉取材质失败 (${resp.status})`,
      };
    }

    return await resp.blob();
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '网络错误',
    };
  }
}

export async function applyTextureToUser(
  token: string,
  type: string,
  file: File,
  model?: string,
  uid?: number
): Promise<{ success: boolean; message: string }> {
  try {
    const url = `${BackendUrl}/texture/upload`;
    const formData = new FormData();
    formData.append('remember_token', token);
    formData.append('texture_type', type);
    formData.append('file', file);
    if (model) formData.append('model', model);
    if (uid) formData.append('uid', uid.toString());

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const resp = await fetch(url, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const body = await resp.json().catch(() => null);

    if (!resp.ok) {
      return {
        success: false,
        message: body?.message || `应用材质失败 (${resp.status})`,
      };
    }

    return body;
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '网络错误',
    };
  }
}

export function getPreviewUrl(previewFile: string): string {
  return `${SkinlibUrl}/texture/preview/${previewFile}`;
}
