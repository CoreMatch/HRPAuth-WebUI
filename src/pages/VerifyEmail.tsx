import { useState, useEffect } from 'react';
import { TextField, Button, Typography, Box, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { request } from '../utils/api';
import { validateEmail } from '../utils/email';
import { setCookie } from '../utils/cookie';
import { BackendUrl } from '../utils/config';
import { useMeta } from '../hooks/useMeta';

export default function VerifyEmail() {
  useMeta('verifyemail');
  const { t } = useTranslation();
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
      setError(t('verifyEmail.errors.invalidEmail'));
      setEmailError(true);
      return false;
    }

    return true;
  }

  function validateCode() {
    setError(null);
    setCodeError(false);

    if (!verificationCode || verificationCode.trim().length === 0) {
      setError(t('verifyEmail.errors.codeRequired'));
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
      const result = await request(`${BackendUrl}/email-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send-verification-code', email }),
      });

      if (result.success) {
        setCountdown(60);
        setSuccess(t('verifyEmail.sent'));
        setError(null);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(t('common.networkError') + ': ' + (err instanceof Error ? err.message : String(err)));
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
      const result = await request(`${BackendUrl}/email-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify-code', email, code: verificationCode }),
      });

      if (result.success) {
        setSuccess(t('verifyEmail.success'));
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
      setError(t('common.networkError') + ': ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{ maxWidth: 480 }}>
      <Typography variant="h4" gutterBottom>
        {t('verifyEmail.title')}
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
          label={t('verifyEmail.emailLabel')}
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
          label={t('verifyEmail.codeLabel')}
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
          {sendingCode ? t('verifyEmail.sendingCode') : countdown > 0 ? `${countdown}s` : t('verifyEmail.sendCode')}
        </Button>
      </Box>

      <Button
        variant="contained"
        onClick={verifyCode}
        disabled={loading}
        fullWidth
        sx={{ mb: 2 }}
      >
        {loading ? t('verifyEmail.verifying') : t('verifyEmail.verifyButton')}
      </Button>

      <Typography variant="body2" color="text.secondary">
        {t('verifyEmail.expiryHint')}
      </Typography>
    </Box>
  );
}