import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initBackendUrl } from './utils/config.ts'
import { initServiceRegistry } from './utils/serviceRegistry.ts'

async function bootstrap() {
  await initBackendUrl();
  // 微服务注册与发现，失败静默降级，不阻塞应用启动。
  initServiceRegistry();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

bootstrap();
