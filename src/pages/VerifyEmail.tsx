import { useState, useEffect } from 'react';
import { TextField, Button, Typography, Box, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { validateEmail } from '../utils/email';
import { setCookie } from '../utils/cookie';
import { getBackendUrl } from '../utils/config';

export default function VerifyEmail() {
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [emailError, setEmailError] = useState(false);
  const [codeError, setCodeError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  function validateEmailInput() {
    setError(null);
    setEmailError(false);

    if (!email || !validateEmail(email)) {
      setError('请输入有效的邮箱地址 Please input valid email address');
      setEmailError(true);
      return false;
    }

    return true;
  }

  function validateCode() {
    setError(null);
    setCodeError(false);

    if (!verificationCode || verificationCode.trim().length === 0) {
      setError('请输入邮箱验证码 Please enter email verification code');
      setCodeError(true);
      return false;
    }

    return true;
  }

  async function sendVerificationCode() {
    if (!validateEmailInput()) return;

    setSendingCode(true);
    setError(null);

    try {
      const base = getBackendUrl();
      const url = base + '/email-verification';
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send-verification-code', email }),
      });

      const text = await response.text();
      let result;

      try {
        result = JSON.parse(text);
      } catch {
        setError(text);
        return;
      }

      if (result.success) {
        setCountdown(60);
        setSuccess('验证码已发送，请查收邮件');
        setError(null);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('网络错误：' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSendingCode(false);
    }
  }

  async function verifyCode() {
    if (!validateEmailInput() || !validateCode()) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const base = getBackendUrl();
      const url = base + '/email-verification';
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify-code', email, code: verificationCode }),
      });

      const text = await response.text();
      let result;

      try {
        result = JSON.parse(text);
      } catch {
        setError(text);
        return;
      }

      if (result.success) {
        setSuccess('邮箱验证成功！');
        // 更新verified cookie为true
        const farFuture = new Date();
        farFuture.setFullYear(farFuture.getFullYear() + 10);
        setCookie('verified', 'true', {
          expires: farFuture,
          path: '/',
          sameSite: 'lax',
          secure: window.location.protocol === 'https'
        });
        setTimeout(() => navigate('/dash'), 1500);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('网络错误：' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{ maxWidth: 480 }}>
      <Typography variant="h4" gutterBottom>
        Verify Email 邮箱验证
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Box sx={{ mb: 2 }}>
        <TextField
          label="E-mail 邮箱"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          fullWidth
          error={emailError}
          disabled={loading || sendingCode}
        />
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          label="Email Code 邮箱验证码"
          type="text"
          value={verificationCode}
          onChange={(e) => setVerificationCode(e.target.value)}
          required
          fullWidth
          error={codeError}
          disabled={loading}
        />
        <Button
          variant="outlined"
          onClick={sendVerificationCode}
          disabled={loading || sendingCode || countdown > 0}
          sx={{ whiteSpace: 'nowrap', minWidth: 120 }}
        >
          {sendingCode ? '发送中...' : countdown > 0 ? `${countdown}s` : '发送验证码'}
        </Button>
      </Box>

      <Button
        variant="contained"
        onClick={verifyCode}
        disabled={loading}
        fullWidth
        sx={{ mb: 2 }}
      >
        {loading ? '验证中...' : '验证邮箱'}
      </Button>

      <Typography variant="body2" color="text.secondary">
        验证码有效期为10分钟，请及时查收邮件并输入验证码。
      </Typography>
    </Box>
  );
}
