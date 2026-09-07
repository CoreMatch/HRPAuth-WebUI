import { useState, useEffect } from 'react';
import { TextField, Button, Typography, Box, Alert, Checkbox, FormControlLabel } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { validateEmail } from '../utils/email';
import { getLoginTicket, verifyTotp } from '../api/auth';
import { completeLogin } from '../utils/auth';
import { useMeta } from '../hooks/useMeta';

export default function Login() {
  useMeta('login');
  const { t } = useTranslation();
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
      setError(t('login.errors.invalidEmail'));
      return false;
    }

    if (!showTotp) {
      if (!password) {
        setError(t('login.errors.passwordRequired'));
        return false;
      }
    } else {
      if (!totpCode || totpCode.length !== 6) {
        setError(t('login.errors.totpRequired'));
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
          setError(res.message || t('login.errors.loginFailed'));
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
          setError(res.message || t('login.errors.codeIncorrect'));
          setLoading(false);
          return;
        }

        const data = res.data;
        if (data?.access_token) {
          await handleLoginSuccess(data.access_token, data.refresh_token, data.uid, remember);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.errors.networkError'));
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
        {t('login.title')}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success ? (
        <Alert severity="success">
          {t('login.successRedirecting')}
        </Alert>
      ) : (
        <form onSubmit={handleSubmit}>
          {!showTotp ? (
            <>
              <TextField
                label={t('login.emailLabel')}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                fullWidth
                sx={{ mb: 2 }}
                disabled={loading}
              />
              <TextField
                label={t('login.passwordLabel')}
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
              label={t('login.totpLabel')}
              type="text"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder={t('login.totpPlaceholder')}
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
            label={t('login.remember')}
            sx={{ mb: 2 }}
          />

          <Button
            variant="contained"
            type="submit"
            disabled={loading}
            fullWidth
          >
            {loading ? t('common.pleaseWait') : (showTotp ? t('login.submitTotp') : t('login.submit'))}
          </Button>
        </form>
      )}
    </Box>
  );
}