import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { loadConfig, getBackendUrl } from './utils/config.ts'

async function bootstrap() {
  await loadConfig();
  window.BACKEND_URL = getBackendUrl();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

bootstrap();
