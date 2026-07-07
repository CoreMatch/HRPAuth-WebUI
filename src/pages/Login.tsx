import { useState } from 'react';
import { TextField, Button, Typography, Box, Alert, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { validateEmail } from '../utils/email';
import { setAuthCookies } from '../utils/cookie';
import type { LoginResponse } from '../global';
import { useMeta } from '../hooks/useMeta';

type LoginMethod = 'password' | 'totp';

export default function Login() {
  useMeta('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('password');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  function validate() {
    setError(null);

    if (!email || !validateEmail(email)) {
      setError('Please input valid email address 请输入有效的邮箱地址。');
      return false;
    }

    if (loginMethod === 'password') {
      if (!password) {
        setError('Please input password 请输入密码。');
        return false;
      }
    } else {
      if (!totpCode || totpCode.length !== 6) {
        setError('Please input 6-digit TOTP code 请输入6位TOTP验证码。');
        return false;
      }
      if (!/^\d{6}$/.test(totpCode)) {
        setError('TOTP code must be 6 digits TOTP验证码必须为6位数字。');
        return false;
      }
    }

    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setError(null);

    try {
      const base = (window as Window & { BACKEND_URL?: string }).BACKEND_URL?.replace(/\/$/, '') || '';
      const url = loginMethod === 'password' ? base + '/login' : base + '/totp/verify';

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const bodyData = loginMethod === 'password' 
        ? { email, password }
        : { email, passcode: totpCode };

      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(bodyData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await resp.json().catch(() => ({
        success: false,
        message: '服务器返回无法解析的响应',
      }));

      if (!resp.ok || data.success === false) {
        setError(data.message || 'Please login again 请重新登录');
      } else if (data.success === true) {
        let token: string;
        let uid: string;
        let totpEnabled: boolean | null = null;

        if (loginMethod === 'password') {
          const loginData = data as LoginResponse;
          token = loginData.token;
          uid = loginData.uid;
          totpEnabled = Boolean(loginData.totp);
        } else {
          const totpData = data as { success: true; email: string; rt: string };
          token = totpData.rt;
          uid = '';
        }

        try {
          const userUrl = base + '/user';
          
          const userResp = await fetch(userUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ remember_token: token, uid, email }),
          });
          
          const userData = await userResp.json().catch(() => ({
            success: false,
            message: '服务器返回无法解析的响应',
          }));
          
          const verified = userResp.ok && userData.success && userData.data ? userData.data.verified : undefined;
          const userId = userResp.ok && userData.success && userData.data ? userData.data.uid : uid;
          let finalTotp: boolean | undefined;
          if (totpEnabled !== null) {
            finalTotp = totpEnabled;
          } else if (userResp.ok && userData.success && userData.data && userData.data.totp_enabled !== undefined) {
            finalTotp = Boolean(userData.data.totp_enabled);
          }
          setAuthCookies(email, token, userId, verified, finalTotp);
        } catch {
          setAuthCookies(email, token, uid, undefined, totpEnabled ?? undefined);
        }
        
        setSuccess(true);
        setTimeout(() => navigate('/dash'), 700);
      } else {
        setError('未知响应');
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          setError('请求超时，请检查网络连接后重试');
        } else if (err.message.includes('Failed to fetch')) {
          setError('网络错误：无法连接到后端服务器');
        } else {
          setError(`登录失败：${err.message}`);
        }
      } else {
        setError('网络错误：无法连接到后端');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{ maxWidth: 480 }}>
      <Typography variant="h4" gutterBottom>
        登录
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success ? (
        <Alert severity="success">
          登录成功，正在跳转…
        </Alert>
      ) : (
        <form onSubmit={handleSubmit}>
          <ToggleButtonGroup
            value={loginMethod}
            exclusive
            onChange={(_, newValue) => {
              if (newValue !== null) {
                setLoginMethod(newValue);
              }
            }}
            sx={{ mb: 2, width: '100%' }}
          >
            <ToggleButton value="password" sx={{ flex: 1 }}>
              密码登录
            </ToggleButton>
            <ToggleButton value="totp" sx={{ flex: 1 }}>
              TOTP 验证码登录
            </ToggleButton>
          </ToggleButtonGroup>

          <TextField
            label="E-mail 邮箱"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
            sx={{ mb: 2 }}
            disabled={loading}
          />

          {loginMethod === 'password' ? (
            <TextField
              label="Password 密码"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
              sx={{ mb: 2 }}
              disabled={loading}
            />
          ) : (
            <TextField
              label="TOTP 验证码"
              type="text"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="请输入6位数字验证码"
              required
              fullWidth
              sx={{ mb: 2 }}
              disabled={loading}
              inputProps={{ maxLength: 6 }}
            />
          )}

          <Button
            variant="contained"
            type="submit"
            disabled={loading}
          >
            {loading ? '请稍候...' : '登录'}
          </Button>
        </form>
      )}
    </Box>
  );
}
