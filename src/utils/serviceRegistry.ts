import { BackendUrl } from './config';
import { discoverServices, type ServiceSummary } from '../api/services';
import type { ServiceSDK } from '../types/service-sdk';

/**
 * 前端 SPA 微服务注册表。
 * 生命周期：应用启动时拉取服务列表 -> 周期性刷新 -> 注入各服务 SDK。
 * 全程静默降级：任何失败只写 console 日志，不影响应用启动与正常运行。
 */

/** 前端识别的区域集合，前端据此解释服务的 frontend_areas。 */
export const FRONTEND_AREAS = [
  'webui-home',
  'webui-skinlib',
  'webui-dash',
  'webui-service',
  'webui-login',
  'webui-register',
  'webui-verifyemail',
] as const;

export type FrontendArea = (typeof FRONTEND_AREAS)[number];

/** 服务发现刷新周期（毫秒）。 */
const DISCOVERY_INTERVAL_MS = 60_000;

let discoveryTimer: number | null = null;
let discoveredServices: ServiceSummary[] = [];

/** 当前发现到的微服务列表（每次刷新后更新）。 */
export function getDiscoveredServices(): ServiceSummary[] {
  return discoveredServices;
}

/** 按前端区域读取当前已发现的微服务。 */
export function getDiscoveredServicesByArea(area: FrontendArea): ServiceSummary[] {
  return discoveredServices.filter((svc) => svc.frontend_areas.includes(area));
}

/** 判断某个微服务是否声明了指定前端区域。 */
export function isServiceAvailableInArea(name: string, area: FrontendArea): boolean {
  const service = discoveredServices.find((svc) => svc.name === name);
  return service?.frontend_areas.includes(area) ?? false;
}

/** SDK 全局对象键名约定：window[`${serviceName}-sdk`]。 */
function sdkGlobalKey(name: string): string {
  return `${name}-sdk`;
}

/**
 * 读取已加载微服务的 SDK 全局对象（见 src/types/service-sdk.d.ts 的约定）。
 * 返回 undefined 表示该 SDK 未加载或未按约定暴露全局对象。
 */
export function getServiceSDK<T extends ServiceSDK = ServiceSDK>(name: string): T | undefined {
  const sdk = (window as unknown as Record<string, unknown>)[sdkGlobalKey(name)];
  return (typeof sdk === 'object' && sdk !== null ? sdk : undefined) as T | undefined;
}

type SDKLoadedListener = (name: string) => void;
const sdkLoadedListeners = new Set<SDKLoadedListener>();

/** 手动触发 SDK 加载完成通知（供 Debug 页面手动加载 SDK 后使用）。 */
export function notifySDKLoaded(name: string): void {
  for (const listener of sdkLoadedListeners) {
    listener(name);
  }
}

/** 订阅某服务 SDK 加载完成事件，返回取消订阅函数。
 *  立即对已加载的 SDK 做补偿通知——避免 initServiceRegistry 在 React 挂载前
 *  已完成加载、listener 订阅时为时已晚的竞态问题。 */
export function onSDKLoaded(listener: SDKLoadedListener): () => void {
  sdkLoadedListeners.add(listener);
  // 补偿：对已发现且 SDK 全局对象已存在的服务立即通知。
  for (const svc of discoveredServices) {
    if (getServiceSDK(svc.name)) {
      listener(svc.name);
    }
  }
  return () => {
    sdkLoadedListeners.delete(listener);
  };
}

function loadSDK(name: string): void {
  // 按契约，SDK 一律经后端 relay 端点加载（GET /services/sdk/:name）。
  // discovery 中的 sdk_url 是微服务的内网地址，浏览器不可直接访问。
  const url = `${BackendUrl}/services/sdk/${encodeURIComponent(name)}`;
  const existing = document.querySelector<HTMLScriptElement>(`script[data-service-sdk="${name}"]`);
  if (existing) {
    if (existing.getAttribute('src') === url) {
      return;
    }
    existing.remove();
  }
  const script = document.createElement('script');
  script.src = url;
  script.dataset.serviceSdk = name;
  script.async = true;
  script.onload = () => {
    console.log(`[Services] SDK 加载成功: ${name}`);
    for (const listener of sdkLoadedListeners) {
      listener(name);
    }
  };
  script.onerror = () => {
    console.warn(`[Services] SDK 加载失败: ${name} (${url})`);
    script.remove(); // 失败后移除，下轮心跳可重试
  };
  document.head.appendChild(script);
}

async function discoverAndLoadSDKs(): Promise<void> {
  const res = await discoverServices();
  if (!res.success) {
    console.warn(`[Services] 服务发现失败: ${res.message} (${res.code ?? 'unknown'})`);
    return;
  }
  discoveredServices = (res.data ?? []).filter((svc) =>
    svc.frontend_areas.some((area): area is FrontendArea =>
      (FRONTEND_AREAS as readonly string[]).includes(area)
    )
  );
  for (const svc of discoveredServices) {
    loadSDK(svc.name);
  }
}

/**
 * 初始化微服务注册表（幂等）。
 * 契约更新后，前端不再通过 /services/presence 注册自身，只作为 SDK 消费方公开拉取服务列表。
 * 立即发现一次，之后按 DISCOVERY_INTERVAL_MS 周期刷新。
 * 调用方无需 await；失败静默降级。
 */
export function initServiceRegistry(): void {
  if (discoveryTimer !== null) {
    return;
  }

  void discoverAndLoadSDKs();

  discoveryTimer = window.setInterval(() => {
    void discoverAndLoadSDKs();
  }, DISCOVERY_INTERVAL_MS);
}
