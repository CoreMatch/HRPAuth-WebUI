import { BackendUrl } from './config';
import { getUid } from './cookie';
import { registerPresence, discoverServices, type ServiceSummary } from '../api/services';

/**
 * 前端 SPA 微服务注册表。
 * 生命周期：应用启动时注册自身 -> 周期性心跳刷新 -> 发现相关微服务 -> 注入各服务 SDK。
 * 全程静默降级：任何失败只写 console 日志，不影响应用启动与正常运行。
 */

/** 每个页面实例生成一次随机 3 位后缀，避免多标签页共享同名注册。 */
const RANDOM_DIGITS = Math.floor(Math.random() * 1000).toString().padStart(3, '0');

/** 是否已登录：presence 只在登录后注册。 */
function isLoggedIn(): boolean {
  const uid = getUid();
  return uid !== null && uid.trim() !== '';
}

/**
 * 前端自身在 HRPAuth 中注册的服务名。
 * 格式：{uid}-hrpauth-webui-{3 位随机数}，仅登录后调用。
 */
function getServiceName(): string {
  return `${getUid()}-hrpauth-webui-${RANDOM_DIGITS}`;
}

/** 前端声明的区域，与页面路由一一对应。微服务只有声明了重叠区域才会被发现。 */
export const FRONTEND_AREAS = [
  'webui-home',
  'webui-skinlib',
  'webui-dash',
  'webui-login',
  'webui-register',
  'webui-verifyemail',
] as const;

/** 心跳 TTL（秒）：后端过期前需刷新，记录才会保留。 */
const HEARTBEAT_TTL_SECONDS = 120;

/** 心跳刷新周期（毫秒）。 */
const HEARTBEAT_INTERVAL_MS = 60_000;

let heartbeatTimer: number | null = null;
let discoveredServices: ServiceSummary[] = [];

/** 当前发现到的微服务列表（每次心跳后更新）。 */
export function getDiscoveredServices(): ServiceSummary[] {
  return discoveredServices;
}

async function sendHeartbeat(): Promise<void> {
  if (!isLoggedIn()) {
    return; // 未登录不注册 presence
  }
  const res = await registerPresence({
    name: getServiceName(),
    ttl_seconds: HEARTBEAT_TTL_SECONDS,
    scope: {
      name: 'hrpauth-webui',
      frontend_areas: [...FRONTEND_AREAS],
    },
    security_level: 0,
  });
  if (!res.success) {
    console.warn(`[Services] presence 心跳失败: ${res.message} (${res.code ?? 'unknown'})`);
  }
}

function loadSDK(name: string): void {
  const url = `${BackendUrl}/services/sdk/${encodeURIComponent(name)}`;
  if (document.querySelector(`script[data-service-sdk="${name}"]`)) {
    return; // 已注入，避免重复加载
  }
  const script = document.createElement('script');
  script.src = url;
  script.dataset.serviceSdk = name;
  script.async = true;
  script.onload = () => console.log(`[Services] SDK 加载成功: ${name}`);
  script.onerror = () => console.warn(`[Services] SDK 加载失败: ${name}`);
  document.head.appendChild(script);
}

async function discoverAndLoadSDKs(): Promise<void> {
  if (!isLoggedIn()) {
    discoveredServices = []; // 未登录不发现服务
    return;
  }
  const res = await discoverServices(getServiceName());
  if (!res.success) {
    console.warn(`[Services] 服务发现失败: ${res.message} (${res.code ?? 'unknown'})`);
    return;
  }
  discoveredServices = res.data ?? [];
  for (const svc of discoveredServices) {
    loadSDK(svc.name);
  }
}

/**
 * 初始化微服务注册表（幂等）。
 * 立即注册并发现一次，之后按 HEARTBEAT_INTERVAL_MS 周期刷新心跳与发现。
 * 调用方无需 await；失败静默降级。
 */
export function initServiceRegistry(): void {
  if (heartbeatTimer !== null) {
    return;
  }

  void sendHeartbeat().then(discoverAndLoadSDKs);

  heartbeatTimer = window.setInterval(() => {
    void sendHeartbeat().then(discoverAndLoadSDKs);
  }, HEARTBEAT_INTERVAL_MS);
}
