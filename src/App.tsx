import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Layout from './components/Layout';

const Home = lazy(() => import('./pages/Home'));
const Skinlib = lazy(() => import('./pages/Skinlib'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const DashboardDebug = lazy(() => import('./pages/DashboardDebug'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const ServiceEmbed = lazy(() => import('./pages/ServiceEmbed'));

function LoadingFallback() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif'
    }}>
      Loading...
    </div>
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
            <Route path="verifyemail" element={<VerifyEmail />} />
            <Route path="service/:name" element={<ServiceEmbed />} />
            <Route path="profile" element={<Navigate to="/dash" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
