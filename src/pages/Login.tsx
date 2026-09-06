import { useState, useEffect } from 'react';
import { TextField, Button, Typography, Box, Alert, Checkbox, FormControlLabel } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { validateEmail } from '../utils/email';
import { getLoginTicket, verifyTotp } from '../api/auth';
import { completeLogin } from '../utils/auth';
import { useMeta } from '../hooks/useMeta';

export default function Login() {
  useMeta('login');
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [showTotp, setShowTotp] = useState(false);
  const [loginTicket, setLoginTicketVal] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  // If navigated from Register with a login_ticket (TOTP required after auto-register),
  // automatically enter TOTP mode.
  useEffect(() => {
    const state = location.state as { login_ticket?: string; email?: string } | null;
    if (state?.login_ticket && state?.email) {
      setEmail(state.email);
      setLoginTicketVal(state.login_ticket);
      setShowTotp(true);
      // Clear state so a page refresh won't re-trigger this
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  function validate() {
    setError(null);

    if (!email || !validateEmail(email)) {
      setError('请输入有效的邮箱地址。');
      return false;
    }

    if (!showTotp) {
      if (!password) {
        setError('请输入密码。');
        return false;
      }
    } else {
      if (!totpCode || totpCode.length !== 6) {
        setError('请输入6位TOTP验证码。');
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
      if (!showTotp) {
        const res = await getLoginTicket(email, password);
        if (!res.success) {
          setError(res.message || '登录失败');
          setLoading(false);
          return;
        }

        const data = res.data;
        if (data?.totp_required) {
          setShowTotp(true);
          setLoginTicketVal(data.login_ticket || '');
          setLoading(false);
        } else if (data?.access_token) {
          await handleLoginSuccess(data.access_token, data.refresh_token || '', data.uid || '', remember);
        }
      } else {
        const res = await verifyTotp(loginTicket, totpCode);
        if (!res.success) {
          setError(res.message || '验证码错误');
          setLoading(false);
          return;
        }

        const data = res.data;
        if (data?.access_token) {
          await handleLoginSuccess(data.access_token, data.refresh_token, data.uid, remember);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络错误');
      setLoading(false);
    }
  }

  async function handleLoginSuccess(accessToken: string, refreshToken: string, uid: string, rememberMe: boolean) {
    await completeLogin(accessToken, refreshToken, uid, email, rememberMe);
    setSuccess(true);
    setTimeout(() => navigate('/dash'), 700);
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
          {!showTotp ? (
            <>
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
            </>
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

          <FormControlLabel
            control={
              <Checkbox
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                disabled={loading}
              />
            }
            label="记住登录"
            sx={{ mb: 2 }}
          />

          <Button
            variant="contained"
            type="submit"
            disabled={loading}
            fullWidth
          >
            {loading ? '请稍候...' : (showTotp ? '验证并登录' : '登录')}
          </Button>
        </form>
      )}
    </Box>
  );
}
