import { BackendUrl } from '../utils/config';
import { request, type ApiResponse } from '../utils/api';

/**
 * HRPAuth 微服务扩展层 API。
 * 契约定义见 HA-Contract/docs/dev/HRPAuth/microservices.md。
 * 前端 SPA 作为参与者，通过 presence 注册自身、发现相关服务并加载其 SDK。
 */

export interface PresenceScope {
  name: string;
  frontend_areas: string[];
}

export interface PresenceRequest {
  name: string;
  /** 自定存在时间（秒）；<= 0 或省略表示永不过期 */
  ttl_seconds?: number;
  scope?: PresenceScope;
  sdk_url?: string;
  /** 鉴权级别：0 无须 / 1 用户级 / 2 运维级，默认 0 */
  security_level?: number;
  interacts_with?: string[];
}

export interface PresenceData {
  service: string;
  first_seen: string;
  last_seen: string;
  expires_at: string | null;
}

export interface ServiceSummary {
  name: string;
  scope_name: string;
  sdk_url?: string;
}

export interface RouteRule {
  scope: string;
  /** 精确路径或 * 前缀通配 */
  paths: string[];
  pre_url?: string;
  post_url?: string;
}

export interface RouteData {
  service: string;
  count: number;
}

export interface RelayRule {
  /** 主服务对外路径前缀 */
  dest: string;
  /** 微服务地址；剩余路径会拼接在其后 */
  source: string;
}

export interface RelayData {
  service: string;
  count: number;
}

/**
 * 注册/刷新微服务心跳（bonjour 握手）。
 */
export function registerPresence(req: PresenceRequest): Promise<ApiResponse<PresenceData>> {
  return request<PresenceData>(`${BackendUrl}/services/presence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
}

/**
 * 拉取与指定前端区域重叠的微服务列表。
 * 公开接口，无需鉴权；name 为已注册的前端服务名。
 */
export function discoverServices(name: string): Promise<ApiResponse<ServiceSummary[]>> {
  return request<ServiceSummary[]>(`${BackendUrl}/services/list?name=${encodeURIComponent(name)}`, {
    method: 'GET',
  });
}

/**
 * 注册/更新路由规则（pre/post 编排）。要求服务已通过 presence 注册。
 */
export function registerRoutes(name: string, rules: RouteRule[]): Promise<ApiResponse<RouteData>> {
  return request<RouteData>(`${BackendUrl}/services/route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, rules }),
  });
}

/**
 * 注册 relay 转发规则。要求服务已通过 presence 注册。
 */
export function registerRelay(name: string, relays: RelayRule[]): Promise<ApiResponse<RelayData>> {
  return request<RelayData>(`${BackendUrl}/services/relay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, relays }),
  });
}

/**
 * 删除某服务的 relay 规则。
 */
export function deleteRelay(name: string, dest: string): Promise<ApiResponse> {
  return request(`${BackendUrl}/services/relay`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, dest }),
  });
}

/**
 * 列出 relay 规则；name 非空时仅返回该服务的。
 */
export function listRelays(name?: string): Promise<ApiResponse<RelayRule[]>> {
  const query = name ? `?name=${encodeURIComponent(name)}` : '';
  return request<RelayRule[]>(`${BackendUrl}/services/relay${query}`, {
    method: 'GET',
  });
}
