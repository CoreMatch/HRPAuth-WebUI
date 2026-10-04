import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { TextField, Button, Typography, Box, Alert, Checkbox, FormControlLabel, Stack, Link } from '@mui/material';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { validateEmail } from '../utils/email';
import { beginWebAuthnLogin, beginWebAuthnSecondFactor, finishWebAuthnLogin, finishWebAuthnSecondFactor, getLoginTicket, verifyTotp } from '../api/auth';
import { completeLogin } from '../utils/auth';
import { useMeta } from '../hooks/useMeta';
import { authenticateWithWebAuthn, isWebAuthnSupported } from '../utils/webauthn';

export default function Login() {
  useMeta('login');
  const { t } = useTranslation();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [showTotp, setShowTotp] = useState(false);
  const [totpAvailable, setTotpAvailable] = useState(false);
  const [webauthnRequired, setWebauthnRequired] = useState(false);
  const [webauthnAvailable, setWebauthnAvailable] = useState(false);
  const [loginTicket, setLoginTicketVal] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [webauthnLoading, setWebauthnLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  // If navigated from Register with a login_ticket (TOTP required after auto-register),
  // automatically enter TOTP mode.
  useEffect(() => {
    const state = location.state as { login_ticket?: string; email?: string } | null;
    if (state?.login_ticket && state?.email) {
      setEmail(state.email);
      setLoginTicketVal(state.login_ticket);
      setTotpAvailable(true);
      setShowTotp(true);
      setWebauthnRequired(false);
      setWebauthnAvailable(false);
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

  function mapLoginError(message?: string, code?: string) {
    if (message === 'Failed to inspect WebAuthn credentials') {
      return t('login.errors.webauthnInspectionFailed');
    }
    if (code === 'webauthn_verification_failed') {
      return t('login.errors.webauthnFailed');
    }
    if (code === 'webauthn_not_configured') {
      return t('login.errors.webauthnNotConfigured');
    }
    return message || t('login.errors.loginFailed');
  }

  async function handleWebAuthnPrimaryLogin() {
    setWebauthnLoading(true);
    setError(null);

    try {
      const res = await beginWebAuthnLogin(validateEmail(email) ? email : undefined);
      const flowId = res.data?.flow_id;
      const options = res.data?.options;

      if (!res.success || !flowId || !options) {
        setError(mapLoginError(res.message, res.code));
        return;
      }

      const credential = await authenticateWithWebAuthn(options);
      const finishRes = await finishWebAuthnLogin(flowId, credential);

      if (!finishRes.success) {
        setError(mapLoginError(finishRes.message, finishRes.code));
        return;
      }

      const data = finishRes.data;
      if (data?.access_token) {
        await handleLoginSuccess(data.access_token, data.refresh_token, data.uid, remember);
      } else {
        setError(t('login.errors.loginFailed'));
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'WebAuthn is not supported in this browser') {
        setError(t('login.errors.webauthnFailed'));
      } else {
        setError(err instanceof Error ? err.message : t('login.errors.webauthnFailed'));
      }
    } finally {
      setWebauthnLoading(false);
    }
  }

  async function handleWebAuthnSecondFactorLogin() {
    if (!loginTicket) {
      setError(t('login.errors.loginFailed'));
      return;
    }

    setWebauthnLoading(true);
    setError(null);

    try {
      const res = await beginWebAuthnSecondFactor(loginTicket);
      const flowId = res.data?.flow_id;
      const options = res.data?.options;

      if (!res.success || !flowId || !options) {
        setError(mapLoginError(res.message, res.code));
        return;
      }

      const credential = await authenticateWithWebAuthn(options);
      const finishRes = await finishWebAuthnSecondFactor(flowId, credential);

      if (!finishRes.success) {
        setError(mapLoginError(finishRes.message, finishRes.code));
        return;
      }

      const data = finishRes.data;
      if (data?.access_token) {
        await handleLoginSuccess(data.access_token, data.refresh_token, data.uid, remember);
      } else {
        setError(t('login.errors.loginFailed'));
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'WebAuthn is not supported in this browser') {
        setError(t('login.errors.webauthnFailed'));
      } else {
        setError(err instanceof Error ? err.message : t('login.errors.webauthnFailed'));
      }
    } finally {
      setWebauthnLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setError(null);

    try {
      if (!showTotp) {
        const res = await getLoginTicket(email, password);
        if (!res.success) {
          setError(mapLoginError(res.message, res.code));
          setLoading(false);
          return;
        }

        const data = res.data;
        if (data?.totp_required) {
          const secondFactors = data.second_factors ?? [];
          const nextTotpAvailable = secondFactors.length > 0 ? secondFactors.includes('totp') : true;
          const nextWebauthnAvailable = secondFactors.length > 0
            ? secondFactors.includes('webauthn')
            : Boolean(data.webauthn_required);

          setTotpAvailable(nextTotpAvailable);
          setWebauthnAvailable(nextWebauthnAvailable);
          setShowTotp(true);
          setWebauthnRequired(nextWebauthnAvailable);
          setLoginTicketVal(data.login_ticket || '');
          setLoading(false);
        } else if (data?.webauthn_required) {
          setTotpAvailable(false);
          setWebauthnAvailable(true);
          setShowTotp(false);
          setWebauthnRequired(true);
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

  const awaitingSecondFactor = Boolean(loginTicket) && (totpAvailable || webauthnAvailable);
  const showSecondFactorSelector = awaitingSecondFactor && totpAvailable && webauthnAvailable;

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
        <Stack spacing={2}>
          <form onSubmit={handleSubmit}>
            {showSecondFactorSelector && (
              <Stack spacing={1.5} sx={{ mb: 2 }}>
                <Typography variant="subtitle2">
                  {t('login.secondFactorTitle')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('login.secondFactorSelectorHint')}
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <Button
                    type="button"
                    variant={showTotp ? 'contained' : 'outlined'}
                    onClick={() => {
                      setShowTotp(true);
                      setError(null);
                    }}
                    disabled={loading || webauthnLoading}
                    fullWidth
                  >
                    {t('login.useAuthenticatorSecondFactor')}
                  </Button>
                  <Button
                    type="button"
                    variant={!showTotp ? 'contained' : 'outlined'}
                    onClick={() => {
                      setShowTotp(false);
                      setError(null);
                    }}
                    disabled={loading || webauthnLoading}
                    fullWidth
                  >
                    {t('login.usePasskeySecondFactorOption')}
                  </Button>
                </Stack>
              </Stack>
            )}

            {!awaitingSecondFactor ? (
              <>
                <TextField
                  label={t('login.emailLabel')}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  fullWidth
                  sx={{ mb: 2 }}
                  disabled={loading || webauthnLoading}
                />
                <TextField
                  label={t('login.passwordLabel')}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required={!webauthnRequired}
                  fullWidth
                  sx={{ mb: 2 }}
                  disabled={loading || webauthnLoading}
                />
                <Box sx={{ textAlign: 'right', mb: 2, mt: -1 }}>
                  <Link component={RouterLink} to="/forgot-password" variant="body2">
                    {t('login.forgotPassword')}
                  </Link>
                </Box>
              </>
            ) : showTotp ? (
              <>
                <TextField
                  label={t('login.totpLabel')}
                  type="text"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder={t('login.totpPlaceholder')}
                  required
                  fullWidth
                  sx={{ mb: 2 }}
                  disabled={loading || webauthnLoading}
                  slotProps={{ htmlInput: { maxLength: 6 } }}
                />
                {webauthnAvailable && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {t('login.webauthnAlternative')}
                  </Typography>
                )}
              </>
            ) : (
              <Alert severity="info" sx={{ mb: 2 }}>
                {t('login.webauthnSecondFactorRequired')}
              </Alert>
            )}

            <FormControlLabel
              control={
                <Checkbox
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  disabled={loading || webauthnLoading}
                />
              }
              label={t('login.remember')}
              sx={{ mb: 2 }}
            />

            {(!awaitingSecondFactor || showTotp) && (
              <Button
                variant="contained"
                type="submit"
                disabled={loading || webauthnLoading}
                fullWidth
              >
                {loading ? t('common.pleaseWait') : (showTotp ? t('login.submitTotp') : t('login.submit'))}
              </Button>
            )}
          </form>

          {isWebAuthnSupported() && !awaitingSecondFactor && (
            <Button
              variant="outlined"
              onClick={handleWebAuthnPrimaryLogin}
              disabled={loading || webauthnLoading}
              fullWidth
            >
              {webauthnLoading ? t('common.pleaseWait') : t('login.usePasskey')}
            </Button>
          )}

          {isWebAuthnSupported() && webauthnAvailable && loginTicket && !showTotp && (
            <Button
              variant="outlined"
              onClick={handleWebAuthnSecondFactorLogin}
              disabled={loading || webauthnLoading}
              fullWidth
            >
              {webauthnLoading ? t('common.pleaseWait') : t('login.usePasskeySecondFactor')}
            </Button>
          )}
        </Stack>
      )}
    </Box>
  );
}
