import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, ThemeProvider } from '@mui/material';
import './index.css';
import './i18n';
import App from './App.tsx';
import { appTheme } from './theme.ts';
import { initBackendUrl, BackendUrl } from './utils/config.ts';

declare global {
  interface Window {
    __BACKEND_URL__?: string;
  }
}

async function bootstrap() {
  await initBackendUrl();
  // 暴露后端地址供页面内嵌逻辑读取。
  window.__BACKEND_URL__ = BackendUrl;

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </StrictMode>,
  );
}

bootstrap();
