import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import Layout from './components/Layout';
import { sdkRouteElements } from './generated/sdk-routes';

const Home = lazy(() => import('./pages/Home'));
const Skinlib = lazy(() => import('./pages/Skinlib'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const DashboardDebug = lazy(() => import('./pages/DashboardDebug'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));

function LoadingFallback() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        px: 3,
      }}
    >
      <Box sx={{ textAlign: 'center' }}>
        <CircularProgress color="secondary" size={36} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Loading...
        </Typography>
      </Box>
    </Box>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="skinlib" element={<Skinlib />} />
            <Route path="dash" element={<Dashboard />} />
            <Route path="dashdebug" element={<DashboardDebug />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
            <Route path="verifyemail" element={<VerifyEmail />} />
            {/* 构建期注入的 SDK 路由（占位为空）；同样处于 Suspense 内，懒加载组件可正常显示 fallback。 */}
            {sdkRouteElements}
            <Route path="profile" element={<Navigate to="/dash" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
