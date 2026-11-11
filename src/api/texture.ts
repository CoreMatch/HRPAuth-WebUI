import { SkinlibUrl, BackendUrl } from '../utils/config';
import { request, type ApiResponse } from '../utils/api';
import type {
  TextureListRequest,
  TextureListResponse,
  TextureUploadRequest,
  TextureItem,
} from '../types/texture';

export async function uploadTexture(
  data: TextureUploadRequest
): Promise<ApiResponse<TextureItem>> {
  const url = `${SkinlibUrl}/texture/upload`;
  const formData = new FormData();
  formData.append('uid', data.uid.toString());
  formData.append('type', data.type);
  formData.append('name', data.name);
  if (data.model) formData.append('model', data.model);
  if (data.description) formData.append('description', data.description);
  if (data.tags) formData.append('tags', data.tags);
  formData.append('file', data.file);

  return request<TextureItem>(url, {
    method: 'POST',
    body: formData,
  });
}

export async function listTextures(
  params: TextureListRequest = {}
): Promise<ApiResponse<TextureListResponse>> {
  const query = new URLSearchParams();
  if (params.type) query.append('type', params.type);
  if (params.order) query.append('order', params.order);
  if (params.tag) query.append('tag', params.tag);
  if (params.page) query.append('page', params.page.toString());

  const url = `${SkinlibUrl}/texture/listpreview${query.toString() ? `?${query.toString()}` : ''}`;

  return request<TextureListResponse>(url, {
    method: 'GET',
  });
}

export async function pullTexture(hash: string): Promise<Blob | { success: false; message: string }> {
  try {
    const url = `${SkinlibUrl}/texture/pull/${hash}`;

    const resp = await fetch(url, {
      method: 'GET',
    });

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
  type: string,
  file: File,
  model?: string
): Promise<ApiResponse> {
  // 材质应用走 yggdrasil-api：上游只注册了 POST /texture/upload/:uuid
  // （multipart file/type/model，账号由 Bearer token 识别），所以先经
  // /texture/get 解析出当前账号的档案 ID 再上传。
  const getResp = await request<{ profiles?: Array<{ id: string }> }>(
    `${BackendUrl}/yggdrasil-api/texture/get`,
    { method: 'POST' }
  );
  const profileID = getResp.data?.profiles?.[0]?.id;
  if (!getResp.success || !profileID) {
    return {
      success: false,
      message: getResp.message || '无法获取游戏档案',
      code: getResp.code || 'profile_not_found',
    };
  }

  const url = `${BackendUrl}/yggdrasil-api/texture/upload/${profileID}`;
  const formData = new FormData();
  formData.append('type', type);
  formData.append('file', file);
  if (model) formData.append('model', model);

  return request(url, {
    method: 'POST',
    body: formData,
  });
}

export function getPreviewUrl(previewFile: string): string {
  return `${SkinlibUrl}/texture/preview/${previewFile}`;
}

export interface TextureDeleteRequest {
  type: 'skin' | 'cape';
  hash: string;
}

export async function deleteTexture(
  data: TextureDeleteRequest
): Promise<ApiResponse<TextureItem>> {
  const url = `${SkinlibUrl}/texture/delete`;
  const formData = new FormData();
  formData.append('type', data.type);
  formData.append('hash', data.hash);

  return request<TextureItem>(url, {
    method: 'POST',
    body: formData,
  });
}
