import { useState, useRef } from 'react';
import type { FormEvent } from 'react';
import { TextField, Button, Typography, Box, Alert, Stack, Link } from '@mui/material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { validateEmail } from '../utils/email';
import { forgotPassword, resetPassword } from '../api/auth';
import { useMeta } from '../hooks/useMeta';
import Captcha, { type CaptchaRef } from '../components/Captcha';

export default function ForgotPassword() {
  useMeta('forgotpassword');
  const { t } = useTranslation();
  const navigate = useNavigate();
  const captchaRef = useRef<CaptchaRef>(null);

  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSendCode(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email || !validateEmail(email)) {
      setError(t('forgotPassword.errors.invalidEmail'));
      return;
    }

    const captchaToken = captchaRef.current?.getToken();
    const isCaptchaEnabled = captchaRef.current?.isEnabled();

    if (isCaptchaEnabled && !captchaCode) {
      setError(t('forgotPassword.errors.captchaRequired'));
      return;
    }

    setLoading(true);
    try {
      const res = await forgotPassword(email, captchaToken || '', captchaCode);
      if (res.success) {
        setSuccess(t('forgotPassword.sentSuccess'));
        setStep(2);
      } else {
        setError(res.message || t('forgotPassword.errors.sendFailed'));
        captchaRef.current?.refresh();
        setCaptchaCode('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('forgotPassword.errors.sendFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!recoveryCode || recoveryCode.length !== 4) {
      setError(t('forgotPassword.errors.codeInvalid'));
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setError(t('forgotPassword.errors.passwordTooShort'));
      return;
    }

    setLoading(true);
    try {
      const res = await resetPassword(email, recoveryCode, newPassword);
      if (res.success) {
        setSuccess(t('forgotPassword.resetSuccess'));
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setError(res.message || t('forgotPassword.errors.resetFailed'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('forgotPassword.errors.resetFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{ maxWidth: 480 }}>
      <Typography variant="h4" gutterBottom>
        {t('forgotPassword.title')}
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

      <Stack spacing={2}>
        {step === 1 ? (
          <form onSubmit={handleSendCode}>
            <TextField
              label={t('forgotPassword.emailLabel')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('forgotPassword.emailPlaceholder')}
              required
              fullWidth
              sx={{ mb: 2 }}
              disabled={loading}
            />
            
            <Captcha
              ref={captchaRef}
              value={captchaCode}
              onChange={setCaptchaCode}
            />

            <Button
              variant="contained"
              type="submit"
              disabled={loading}
              fullWidth
            >
              {loading ? t('forgotPassword.sending') : t('forgotPassword.submitSend')}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword}>
            <TextField
              label={t('forgotPassword.emailLabel')}
              value={email}
              disabled
              fullWidth
              sx={{ mb: 2 }}
            />
            
            <TextField
              label={t('forgotPassword.codeLabel')}
              value={recoveryCode}
              onChange={(e) => setRecoveryCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder={t('forgotPassword.codePlaceholder')}
              required
              fullWidth
              sx={{ mb: 2 }}
              disabled={loading}
              slotProps={{ htmlInput: { maxLength: 4 } }}
            />

            <TextField
              label={t('forgotPassword.newPasswordLabel')}
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('forgotPassword.newPasswordPlaceholder')}
              required
              fullWidth
              sx={{ mb: 2 }}
              disabled={loading}
            />

            <Button
              variant="contained"
              type="submit"
              disabled={loading}
              fullWidth
            >
              {loading ? t('forgotPassword.resetting') : t('forgotPassword.submitReset')}
            </Button>
            
            <Button
              variant="text"
              onClick={() => setStep(1)}
              sx={{ mt: 1 }}
              fullWidth
            >
              {t('common.cancel')}
            </Button>
          </form>
        )}

        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Link component={RouterLink} to="/login" variant="body2">
            {t('forgotPassword.backToLogin')}
          </Link>
        </Box>
      </Stack>
    </Box>
  );
}
