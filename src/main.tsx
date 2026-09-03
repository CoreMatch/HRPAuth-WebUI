import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initBackendUrl, BackendUrl } from './utils/config.ts'
import { initServiceRegistry } from './utils/serviceRegistry.ts'

declare global {
  interface Window {
    __BACKEND_URL__?: string;
  }
}

async function bootstrap() {
  await initBackendUrl();
  // 暴露后端地址供微服务 SDK 读取（避免 SDK 自行请求 /status）。
  window.__BACKEND_URL__ = BackendUrl;
  // 微服务注册与发现，失败静默降级，不阻塞应用启动。
  initServiceRegistry();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

bootstrap();
