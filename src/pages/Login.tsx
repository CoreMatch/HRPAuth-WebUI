import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { TextField, Button, Typography, Box, Alert, Checkbox, FormControlLabel, Stack, Link } from '@mui/material';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { validateEmail } from '../utils/email';
import {
  beginWebAuthnLogin,
  beginWebAuthnSecondFactor,
  finishWebAuthnLogin,
  finishWebAuthnSecondFactor,
  getLoginTicket,
  verifyTotp,
  sendEmail2faCode,
  verifyEmail2fa,
  verifyRecoveryKey,
} from '../api/auth';
import { completeLogin } from '../utils/auth';
import { useMeta } from '../hooks/useMeta';
import { authenticateWithWebAuthn, isWebAuthnSupported } from '../utils/webauthn';
import VerificationMethodPickerDialog, {
  getPreferredVerificationMethod,
  type VerificationMethodKey,
  type VerificationMethodOption,
} from '../components/VerificationMethodPickerDialog';

export default function Login() {
  useMeta('login');
  const { t } = useTranslation();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [email2faCode, setEmail2faCode] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [selectedSecondFactor, setSelectedSecondFactor] = useState<VerificationMethodKey | null>(null);
  const [secondFactorDialogOpen, setSecondFactorDialogOpen] = useState(false);
  const [totpAvailable, setTotpAvailable] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState(false);
  const [recoveryKeyAvailable, setRecoveryKeyAvailable] = useState(false);
  const [webauthnAvailable, setWebauthnAvailable] = useState(false);
  const [loginTicket, setLoginTicketVal] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [webauthnLoading, setWebauthnLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const webauthnSupported = isWebAuthnSupported();

  // If navigated from Register with a login_ticket (TOTP required after auto-register),
  // automatically enter TOTP mode.
  useEffect(() => {
    const state = location.state as { login_ticket?: string; email?: string } | null;
    if (state?.login_ticket && state?.email) {
      setEmail(state.email);
      setLoginTicketVal(state.login_ticket);
      setTotpAvailable(true);
      setSelectedSecondFactor('totp');
      setEmailAvailable(false);
      setRecoveryKeyAvailable(false);
      setWebauthnAvailable(false);
      setEmailCodeSent(false);
      // Clear state so a page refresh won't re-trigger this
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  const availableSecondFactors: VerificationMethodKey[] = [
    ...(webauthnAvailable ? ['webauthn' as const] : []),
    ...(totpAvailable ? ['totp' as const] : []),
    ...(emailAvailable ? ['email' as const] : []),
    ...(recoveryKeyAvailable ? ['recovery_key' as const] : []),
  ];

  const selectableSecondFactors: VerificationMethodKey[] = [
    ...(webauthnAvailable && webauthnSupported ? ['webauthn' as const] : []),
    ...(totpAvailable ? ['totp' as const] : []),
    ...(emailAvailable ? ['email' as const] : []),
    ...(recoveryKeyAvailable ? ['recovery_key' as const] : []),
  ];

  const activeSecondFactor = (
    selectedSecondFactor && availableSecondFactors.includes(selectedSecondFactor)
      ? selectedSecondFactor
      : getPreferredVerificationMethod(
        selectableSecondFactors.length > 0 ? selectableSecondFactors : availableSecondFactors
      )
  );

  const secondFactorOptions: VerificationMethodOption[] = [
    ...(webauthnAvailable && webauthnSupported ? [{
      key: 'webauthn' as const,
      title: t('login.usePasskeySecondFactorOption'),
      description: t('login.secondFactorPasskeyDescription'),
    }] : []),
    ...(totpAvailable ? [{
      key: 'totp' as const,
      title: t('login.useAuthenticatorSecondFactor'),
      description: t('login.secondFactorTotpDescription'),
    }] : []),
    ...(emailAvailable ? [{
      key: 'email' as const,
      title: t('login.useEmailSecondFactor'),
      description: t('login.secondFactorEmailDescription'),
    }] : []),
    ...(recoveryKeyAvailable ? [{
      key: 'recovery_key' as const,
      title: t('login.useRecoveryKeySecondFactor'),
      description: t('login.secondFactorRecoveryDescription'),
      emergency: true,
    }] : []),
  ];

  async function sendEmail2faCodeForTicket(ticket: string) {
    if (!ticket) return false;

    setSendingEmail(true);
    try {
      const res = await sendEmail2faCode(ticket);
      if (!res.success) {
        setError(res.message || t('login.errors.loginFailed'));
        return false;
      }

      setEmailCodeSent(true);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.errors.networkError'));
      return false;
    } finally {
      setSendingEmail(false);
    }
  }

  async function selectSecondFactor(method: VerificationMethodKey) {
    setSelectedSecondFactor(method);
    setError(null);

    if (method === 'email' && loginTicket && !emailCodeSent) {
      await sendEmail2faCodeForTicket(loginTicket);
    }
  }

  function validate() {
    setError(null);

    if (!email || !validateEmail(email)) {
      setError(t('login.errors.invalidEmail'));
      return false;
    }

    if (!loginTicket) {
      if (!password) {
        setError(t('login.errors.passwordRequired'));
        return false;
      }
    } else {
      if (activeSecondFactor === 'totp') {
        if (!totpCode || totpCode.length !== 6) {
          setError(t('login.errors.totpRequired'));
          return false;
        }
      } else if (activeSecondFactor === 'email') {
        if (!email2faCode || email2faCode.length !== 6) {
          setError(t('login.errors.emailCodeRequired'));
          return false;
        }
      } else if (activeSecondFactor === 'recovery_key') {
        if (!recoveryKey.trim()) {
          setError(t('login.errors.recoveryKeyRequired'));
          return false;
        }
      } else if (activeSecondFactor === 'webauthn') {
        setError(webauthnSupported ? t('login.webauthnSecondFactorRequired') : t('login.webauthnUnsupported'));
        return false;
      } else {
        setError(t('login.errors.loginFailed'));
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

  async function handleSendEmail2faCode() {
    await sendEmail2faCodeForTicket(loginTicket);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setError(null);

    try {
      if (!loginTicket) {
        const res = await getLoginTicket(email, password);
        if (!res.success) {
          setError(mapLoginError(res.message, res.code));
          setLoading(false);
          return;
        }

        const data = res.data;
        if (data?.totp_required || data?.email_required || data?.webauthn_required || data?.recovery_key_required) {
          const secondFactors = data.second_factors ?? [];
          
          const nextTotpAvailable = secondFactors.length > 0 
            ? secondFactors.includes('totp') 
            : Boolean(data.totp_required);
          
          const nextEmailAvailable = secondFactors.length > 0 
            ? secondFactors.includes('email') 
            : Boolean(data.email_required);
            
          const nextWebauthnAvailable = secondFactors.length > 0
            ? secondFactors.includes('webauthn')
            : Boolean(data.webauthn_required);

          const nextRecoveryKeyAvailable = secondFactors.length > 0
            ? secondFactors.includes('recovery_key')
            : Boolean(data.recovery_key_required);

          const ticket = data.login_ticket || '';
          const nextAvailableSecondFactors: VerificationMethodKey[] = [
            ...(nextWebauthnAvailable ? ['webauthn' as const] : []),
            ...(nextTotpAvailable ? ['totp' as const] : []),
            ...(nextEmailAvailable ? ['email' as const] : []),
            ...(nextRecoveryKeyAvailable ? ['recovery_key' as const] : []),
          ];
          const nextSelectableSecondFactors: VerificationMethodKey[] = [
            ...(nextWebauthnAvailable && webauthnSupported ? ['webauthn' as const] : []),
            ...(nextTotpAvailable ? ['totp' as const] : []),
            ...(nextEmailAvailable ? ['email' as const] : []),
            ...(nextRecoveryKeyAvailable ? ['recovery_key' as const] : []),
          ];
          const preferredSecondFactor = getPreferredVerificationMethod(
            nextSelectableSecondFactors.length > 0 ? nextSelectableSecondFactors : nextAvailableSecondFactors
          );

          setTotpAvailable(nextTotpAvailable);
          setEmailAvailable(nextEmailAvailable);
          setWebauthnAvailable(nextWebauthnAvailable);
          setRecoveryKeyAvailable(nextRecoveryKeyAvailable);
          setSelectedSecondFactor(preferredSecondFactor);
          setEmailCodeSent(false);
          setLoginTicketVal(ticket);

          if (preferredSecondFactor === 'email' && ticket) {
            const emailSent = await sendEmail2faCodeForTicket(ticket);
            if (!emailSent) {
              setLoading(false);
              return;
            }
          }
          
          setLoading(false);
        } else if (data?.access_token) {
          await handleLoginSuccess(data.access_token, data.refresh_token || '', data.uid || '', remember);
        }
      } else if (activeSecondFactor === 'totp') {
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
      } else if (activeSecondFactor === 'email') {
        const res = await verifyEmail2fa(loginTicket, email2faCode);
        if (!res.success) {
          setError(res.message || t('login.errors.codeIncorrect'));
          setLoading(false);
          return;
        }

        const data = res.data;
        if (data?.access_token) {
          await handleLoginSuccess(data.access_token, data.refresh_token, data.uid, remember);
        }
      } else if (activeSecondFactor === 'recovery_key') {
        const res = await verifyRecoveryKey(loginTicket, recoveryKey.trim().toUpperCase());
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

  const awaitingSecondFactor = Boolean(loginTicket) && (totpAvailable || webauthnAvailable || emailAvailable || recoveryKeyAvailable);
  const showSecondFactorSelector = awaitingSecondFactor && secondFactorOptions.length > 1;

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
                  required
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
            ) : (
              <>
                {activeSecondFactor === 'totp' && (
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
                    {showSecondFactorSelector && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {t('login.secondFactorTotpDescription')}
                      </Typography>
                    )}
                  </>
                )}

                {activeSecondFactor === 'email' && (
                  <>
                    <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                      <TextField
                        label={t('verifyEmail.codeLabel')}
                        type="text"
                        value={email2faCode}
                        onChange={(e) => setEmail2faCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="6-digit code"
                        required
                        fullWidth
                        disabled={loading || webauthnLoading || sendingEmail}
                        slotProps={{ htmlInput: { maxLength: 6 } }}
                      />
                      <Button
                        type="button"
                        variant="outlined"
                        onClick={handleSendEmail2faCode}
                        disabled={loading || webauthnLoading || sendingEmail}
                        sx={{ height: 56, minWidth: 100 }}
                      >
                        {sendingEmail ? t('common.loading') : t('verifyEmail.sendCode')}
                      </Button>
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {t('login.secondFactorEmailDescription')}
                    </Typography>
                  </>
                )}

                {activeSecondFactor === 'recovery_key' && (
                  <>
                    <TextField
                      label={t('login.recoveryKeyLabel')}
                      type="text"
                      value={recoveryKey}
                      onChange={(e) => setRecoveryKey(e.target.value.toUpperCase().slice(0, 19))}
                      placeholder={t('login.recoveryKeyPlaceholder')}
                      required
                      fullWidth
                      sx={{ mb: 2 }}
                      disabled={loading || webauthnLoading}
                      slotProps={{ htmlInput: { maxLength: 19 } }}
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {t('login.secondFactorRecoveryDescription')}
                    </Typography>
                  </>
                )}

                {activeSecondFactor === 'webauthn' && (
                  <Alert severity={webauthnSupported ? 'info' : 'error'} sx={{ mb: 2 }}>
                    {webauthnSupported ? t('login.webauthnSecondFactorReady') : t('login.webauthnUnsupported')}
                  </Alert>
                )}

                {showSecondFactorSelector && (
                  <Button
                    type="button"
                    variant="text"
                    onClick={() => setSecondFactorDialogOpen(true)}
                    disabled={loading || webauthnLoading || sendingEmail}
                    sx={{
                      mb: 2,
                      px: 0.5,
                      py: 1.25,
                      minHeight: 44,
                      textTransform: 'none',
                      fontWeight: 600,
                      fontSize: '1rem',
                      justifyContent: 'flex-start',
                      alignSelf: 'flex-start',
                    }}
                  >
                    {t('login.switchMethod')}
                  </Button>
                )}
              </>
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

            {(!awaitingSecondFactor || (activeSecondFactor && activeSecondFactor !== 'webauthn')) && (
              <Button
                variant="contained"
                type="submit"
                disabled={loading || webauthnLoading || sendingEmail}
                fullWidth
              >
                {loading ? t('common.pleaseWait') : (awaitingSecondFactor ? t('login.submitTotp') : t('login.submit'))}
              </Button>
            )}
          </form>

          {webauthnSupported && !awaitingSecondFactor && (
            <Button
              variant="outlined"
              onClick={handleWebAuthnPrimaryLogin}
              disabled={loading || webauthnLoading}
              fullWidth
            >
              {webauthnLoading ? t('common.pleaseWait') : t('login.usePasskey')}
            </Button>
          )}

          {webauthnSupported && activeSecondFactor === 'webauthn' && webauthnAvailable && loginTicket && (
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

      <VerificationMethodPickerDialog
        open={secondFactorDialogOpen}
        title={t('login.chooseSecondFactorDialogTitle')}
        description={t('login.secondFactorSelectorHint')}
        value={activeSecondFactor}
        options={secondFactorOptions}
        closeLabel={t('common.cancel')}
        currentLabel={t('login.currentMethodLabel')}
        revealEmergencyLabel={t('login.recoveryMethodGroup')}
        emergencyDescription={t('login.recoveryMethodHint')}
        onSelect={(method) => {
          void selectSecondFactor(method);
          setSecondFactorDialogOpen(false);
        }}
        onClose={() => setSecondFactorDialogOpen(false)}
      />
    </Box>
  );
}
