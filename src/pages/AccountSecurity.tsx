import { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, CircularProgress, Alert, Chip, Stack, TextField, Button, Dialog, DialogTitle, DialogContent, DialogActions, InputAdornment, FormControlLabel, Switch, Divider } from '@mui/material';
import Key from '@mui/icons-material/Key';
import Delete from '@mui/icons-material/Delete';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { dataCache } from '../utils/dataCache';
import { request } from '../utils/api';
import {
  createRecoveryKey,
  deleteWebAuthnCredential,
  listWebAuthnCredentials,
  regenerateRecoveryKey,
  requestAccountDeletion,
  revokeRecoveryKey,
  setupTotp,
  toggleTotp,
  toggleWebAuthnSecondFactor,
  type RecoveryKeyVerificationRequest,
  type WebAuthnCredentialRecord,
  verifyTotp,
  toggleEmail2fa,
  getTwoFactorStatus,
  beginWebAuthnRegistration,
  finishWebAuthnRegistration,
} from '../api/auth';
import {
  beginWebAuthnSudo,
} from '../api/user';
import { clearAuthCookies, getUserEmail, getAuthToken, getUid, getTotpEnabled, setTotpEnabled } from '../utils/cookie';
import { BackendUrl } from '../utils/config';
import { authenticateWithWebAuthn, isWebAuthnSupported, registerWithWebAuthn } from '../utils/webauthn';
import VerificationMethodPickerDialog, {
  getPreferredVerificationMethod,
  type VerificationMethodKey,
  type VerificationMethodOption,
} from '../components/VerificationMethodPickerDialog';

interface UserInfo {
  email: string;
  username: string;
  avatar?: string;
  verified?: boolean;
  totp_enabled: boolean;
  webauthn_2fa_enabled?: boolean;
  email_2fa_enabled?: boolean;
  recovery_key_enabled?: boolean;
  uid?: number;
}

interface ActionFeedback {
  severity: 'success' | 'error';
  message: string;
}

interface PendingWebAuthnRegistration {
  flowId: string;
  options: any; // Using any for options to match the flexible structure from API
}

export default function AccountSecurity() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [email2faEnabled, setEmail2faEnabled] = useState(false);
  const [email2faLoading, setEmail2faLoading] = useState(false);

  const [totpDialogOpen, setTotpDialogOpen] = useState(false);
  const [totpKey, setTotpKey] = useState<string | null>(null);
  const [totpLoading, setTotpLoading] = useState(false);
  const [totpError, setTotpError] = useState<string | null>(null);
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [setupSuccess, setSetupSuccess] = useState(false);
  const [disableTotpDialogOpen, setDisableTotpDialogOpen] = useState(false);
  const [twoFactorFeedback, setTwoFactorFeedback] = useState<ActionFeedback | null>(null);

  const [recoveryKeyEnabled, setRecoveryKeyEnabled] = useState(false);
  const [recoveryKeyLoading, setRecoveryKeyLoading] = useState(false);
  const [recoveryKeyDialogOpen, setRecoveryKeyDialogOpen] = useState(false);
  const [recoveryKeyDialogMode, setRecoveryKeyDialogMode] = useState<'display' | 'regenerate' | 'revoke'>('display');
  const [generatedRecoveryKey, setGeneratedRecoveryKey] = useState('');
  const [recoveryKeyTotpCode, setRecoveryKeyTotpCode] = useState('');
  const [recoveryKeyEmailCode, setRecoveryKeyEmailCode] = useState('');
  const [recoveryKeyVerificationValue, setRecoveryKeyVerificationValue] = useState('');
  const [selectedRecoveryKeyMethod, setSelectedRecoveryKeyMethod] = useState<VerificationMethodKey | null>(null);
  const [recoveryKeyMethodDialogOpen, setRecoveryKeyMethodDialogOpen] = useState(false);
  const [recoveryKeyDialogError, setRecoveryKeyDialogError] = useState<string | null>(null);
  const [recoveryKeySendingEmailCode, setRecoveryKeySendingEmailCode] = useState(false);
  const [recoveryKeyEmailCodeSent, setRecoveryKeyEmailCodeSent] = useState(false);

  const [webauthnCredentials, setWebauthnCredentials] = useState<WebAuthnCredentialRecord[]>([]);
  const [webauthn2faEnabled, setWebauthn2faEnabled] = useState(false);
  const [webauthnBackendAvailable, setWebauthnBackendAvailable] = useState(true);
  const [webauthnLoading, setWebauthnLoading] = useState(false);
  const [webauthnFeedback, setWebauthnFeedback] = useState<ActionFeedback | null>(null);
  const [webauthnDialogOpen, setWebauthnDialogOpen] = useState(false);
  const [webauthnName, setWebauthnName] = useState('');
  const [webauthnNameError, setWebauthnNameError] = useState<string | null>(null);
  const [pendingWebAuthnRegistration, setPendingWebAuthnRegistration] = useState<PendingWebAuthnRegistration | null>(null);
  const [credentialToDelete, setCredentialToDelete] = useState<WebAuthnCredentialRecord | null>(null);

  const [changeEmailDialogOpen, setChangeEmailDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [changeEmailTotpCode, setChangeEmailTotpCode] = useState('');
  const [changeEmailRecoveryKey, setChangeEmailRecoveryKey] = useState('');
  const [selectedChangeEmailMethod, setSelectedChangeEmailMethod] = useState<VerificationMethodKey | null>(null);
  const [changeEmailMethodDialogOpen, setChangeEmailMethodDialogOpen] = useState(false);
  const [changeEmailLoading, setChangeEmailLoading] = useState(false);
  const [changeEmailError, setChangeEmailError] = useState<string | null>(null);
  const [changeEmailSuccess, setChangeEmailSuccess] = useState(false);
  const [sendingEmailCode, setSendingEmailCode] = useState(false);
  const [changeEmailCodeSent, setChangeEmailCodeSent] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletePasswordError, setDeletePasswordError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const webauthnClientSupported = typeof window !== 'undefined' && window.isSecureContext && isWebAuthnSupported();
  const webauthnSudoAvailable = webauthnClientSupported && webauthnCredentials.length > 0;

  const recoveryKeyMethodOptions: VerificationMethodOption[] = [
    ...(webauthnSudoAvailable ? [{
      key: 'webauthn' as const,
      title: t('profile.pointWebAuthn'),
    }] : []),
    ...(userInfo?.totp_enabled ? [{
      key: 'totp' as const,
      title: t('profile.pointTotp'),
    }] : []),
    {
      key: 'email' as const,
      title: t('profile.pointEmailCode'),
    },
    ...(recoveryKeyEnabled ? [{
      key: 'recovery_key' as const,
      title: t('profile.pointRecoveryKey'),
      emergency: true,
    }] : []),
  ];

  const changeEmailMethodOptions: VerificationMethodOption[] = [
    ...(webauthnSudoAvailable ? [{
      key: 'webauthn' as const,
      title: t('profile.pointWebAuthn'),
    }] : []),
    ...(userInfo?.totp_enabled ? [{
      key: 'totp' as const,
      title: t('profile.pointTotp'),
    }] : []),
    {
      key: 'email' as const,
      title: t('profile.pointEmailCode'),
    },
    ...(recoveryKeyEnabled ? [{
      key: 'recovery_key' as const,
      title: t('profile.pointRecoveryKey'),
      emergency: true,
    }] : []),
  ];

  const parseEnabledFlag = (value: unknown): boolean | undefined => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    return undefined;
  };

  const readRecoveryKeyEnabledFromValue = (value: unknown): boolean | undefined => {
    if (!value || typeof value !== 'object') return undefined;
    const record = value as any;
    return parseEnabledFlag(record.data?.recovery_key_enabled ?? record.recovery_key_enabled);
  };

  const readWebAuthnEnabledFromValue = (value: unknown): boolean | undefined => {
    if (!value || typeof value !== 'object') return undefined;
    const record = value as any;
    return parseEnabledFlag(
      record.data?.webauthn_2fa_enabled
      ?? record.data?.enabled
      ?? record.webauthn_2fa_enabled
      ?? record.enabled
    );
  };

  const readWebAuthnAvailabilityFromValue = (value: unknown): boolean | undefined => {
    if (!value || typeof value !== 'object') return undefined;
    const record = value as any;
    if (typeof record.data?.available === 'boolean') return record.data.available;
    if (typeof record.available === 'boolean') return record.available;
    return undefined;
  };

  const normalizeWebAuthnCredentials = (value: unknown): WebAuthnCredentialRecord[] => {
    const records = Array.isArray(value)
      ? value
      : value && typeof value === 'object' && Array.isArray((value as any).credentials)
        ? (value as any).credentials
        : [];

    const normalized: WebAuthnCredentialRecord[] = [];
    records.forEach((item: any) => {
      if (!item || typeof item !== 'object') return;
      const id = typeof item.id === 'number' ? item.id : Number(item.id);
      if (!Number.isFinite(id) || id <= 0) return;
      normalized.push({
        id,
        name: typeof item.name === 'string' ? item.name : undefined,
        created_at: typeof item.created_at === 'string' ? item.created_at : undefined,
        updated_at: typeof item.updated_at === 'string' ? item.updated_at : undefined,
        last_used_at: typeof item.last_used_at === 'string' || item.last_used_at === null
          ? item.last_used_at as string | null
          : undefined,
      });
    });
    return normalized;
  };

  const applyWebAuthnState = (value: unknown, fallbackEnabled?: boolean) => {
    const credentials = normalizeWebAuthnCredentials(value);
    const enabled = readWebAuthnEnabledFromValue(value) ?? fallbackEnabled ?? false;
    const available = readWebAuthnAvailabilityFromValue(value) ?? true;
    setWebauthnCredentials(credentials);
    setWebauthn2faEnabled(enabled);
    setWebauthnBackendAvailable(available);
    setUserInfo((prev) => (prev ? { ...prev, webauthn_2fa_enabled: enabled } : prev));
    return { credentials, enabled, available };
  };

  const refreshTwoFactorStatus = async (uid?: string) => {
    try {
      const resp = await getTwoFactorStatus(uid);
      if (resp.success && resp.data) {
        const {
          totp_enabled,
          webauthn_2fa_enabled,
          recovery_key_enabled,
          email_2fa_enabled,
        } = resp.data;
        setTotpEnabled(totp_enabled);
        setWebauthn2faEnabled(webauthn_2fa_enabled);
        setRecoveryKeyEnabled(recovery_key_enabled);
        setEmail2faEnabled(email_2fa_enabled);
        setUserInfo((prev) => prev ? { ...prev, ...resp.data } : null);
        return resp.data;
      }
    } catch (e) {
      console.error('Failed to refresh 2FA status', e);
    }
    return null;
  };

  const refreshWebAuthnStatus = async (fallbackEnabled?: boolean) => {
    try {
      const resp = await listWebAuthnCredentials();
      if (resp.success) {
        applyWebAuthnState(resp.data, fallbackEnabled);
      } else {
        applyWebAuthnState([], fallbackEnabled);
      }
    } catch {
      applyWebAuthnState([], fallbackEnabled);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      const email = getUserEmail();
      const token = getAuthToken();
      const uid = getUid();

      if (!token) {
        setError(t('profile.notLoggedIn'));
        setLoading(false);
        return;
      }

      const cachedUser = dataCache.getUser();
      const cachedTwoFactor = dataCache.getTwoFactorStatus();
      const cachedCreds = dataCache.getWebauthnCredentials();

      if (cachedUser) {
        const totpEnabledFromCache = cachedTwoFactor?.totp_enabled ?? getTotpEnabled() ?? false;
        const webauthnEnabledFromCache = cachedTwoFactor?.webauthn_2fa_enabled ?? readWebAuthnEnabledFromValue(cachedUser) ?? false;
        const recoveryKeyEnabledFromCache = cachedTwoFactor?.recovery_key_enabled ?? readRecoveryKeyEnabledFromValue(cachedUser) ?? false;
        const email2faEnabledFromCache = cachedTwoFactor?.email_2fa_enabled ?? false;

        applyWebAuthnState(cachedCreds || [], webauthnEnabledFromCache);
        setRecoveryKeyEnabled(recoveryKeyEnabledFromCache);
        setEmail2faEnabled(email2faEnabledFromCache);

        setUserInfo({
          email: cachedUser.email || email || '',
          username: cachedUser.username || (email ? email.split('@')[0] : 'User'),
          avatar: cachedUser.avatar,
          verified: Boolean(cachedUser.verified),
          totp_enabled: totpEnabledFromCache,
          webauthn_2fa_enabled: webauthnEnabledFromCache,
          recovery_key_enabled: recoveryKeyEnabledFromCache,
          email_2fa_enabled: email2faEnabledFromCache,
          uid: cachedUser.uid,
        });
        setLoading(false);
      }

      try {
        const [userResp, twoFactorData, webauthnResp] = await Promise.all([
          request(`${BackendUrl}/user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid, email }),
          }),
          refreshTwoFactorStatus(uid || undefined),
          listWebAuthnCredentials(),
        ]);

        if (userResp.success && userResp.data) {
          dataCache.setUser(userResp.data);
          const currentTwoFactor = twoFactorData || {
            totp_enabled: getTotpEnabled() ?? false,
            webauthn_2fa_enabled: readWebAuthnEnabledFromValue(userResp.data) ?? false,
            recovery_key_enabled: readRecoveryKeyEnabledFromValue(userResp.data) ?? false,
            email_2fa_enabled: false,
          };
          setUserInfo({
            email: userResp.data.email || email || '',
            username: userResp.data.username || (email ? email.split('@')[0] : 'User'),
            avatar: userResp.data.avatar,
            verified: Boolean(userResp.data.verified),
            totp_enabled: currentTwoFactor.totp_enabled,
            webauthn_2fa_enabled: currentTwoFactor.webauthn_2fa_enabled,
            recovery_key_enabled: currentTwoFactor.recovery_key_enabled,
            email_2fa_enabled: currentTwoFactor.email_2fa_enabled,
            uid: userResp.data.uid,
          });
          setRecoveryKeyEnabled(currentTwoFactor.recovery_key_enabled);
          setEmail2faEnabled(currentTwoFactor.email_2fa_enabled);
        }

        if (webauthnResp.success) {
          dataCache.setWebauthnCredentials(webauthnResp.data);
          const currentWebAuthnEnabled = twoFactorData?.webauthn_2fa_enabled ?? false;
          applyWebAuthnState(webauthnResp.data, currentWebAuthnEnabled);
        }
      } catch (err) {
        console.error('Failed to fetch profile data', err);
        if (!cachedUser) setError(t('common.serverError'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [t]);

  const handleToggleEmail2fa = async (enabled: boolean) => {
    setEmail2faLoading(true);
    setTwoFactorFeedback(null);
    try {
      const resp = await toggleEmail2fa(enabled);
      if (resp.success) {
        await refreshTwoFactorStatus();
        setTwoFactorFeedback({
          severity: 'success',
          message: enabled ? t('profile.email2faEnabledSuccess') : t('profile.email2faDisabledSuccess'),
        });
      } else {
        setTwoFactorFeedback({
          severity: 'error',
          message: resp.message || t('profile.totpToggleFailed'),
        });
      }
    } catch {
      setTwoFactorFeedback({ severity: 'error', message: t('common.serverError') });
    } finally {
      setEmail2faLoading(false);
    }
  };

  const closeRecoveryKeyDialog = () => {
    if (recoveryKeyLoading || recoveryKeySendingEmailCode) return;
    setRecoveryKeyDialogOpen(false);
    setRecoveryKeyMethodDialogOpen(false);
    setRecoveryKeyDialogError(null);
    setRecoveryKeyTotpCode('');
    setRecoveryKeyEmailCode('');
    setRecoveryKeyVerificationValue('');
    setGeneratedRecoveryKey('');
    setSelectedRecoveryKeyMethod(null);
    setRecoveryKeyEmailCodeSent(false);
  };

  const handleCreateRecoveryKey = async () => {
    setRecoveryKeyLoading(true);
    setTwoFactorFeedback(null);
    try {
      const resp = await createRecoveryKey();
      if (resp.success && resp.data?.recovery_key) {
        await refreshTwoFactorStatus();
        setGeneratedRecoveryKey(resp.data.recovery_key);
        setRecoveryKeyDialogMode('display');
        setRecoveryKeyDialogError(null);
        setRecoveryKeyDialogOpen(true);
      } else {
        if (resp.code === 'recovery_key_already_configured') await refreshTwoFactorStatus();
        setTwoFactorFeedback({
          severity: 'error',
          message: resp.message || t('profile.recoveryKeyCreateFailed'),
        });
      }
    } catch {
      setTwoFactorFeedback({ severity: 'error', message: t('common.serverError') });
    } finally {
      setRecoveryKeyLoading(false);
    }
  };

  const openRecoveryKeyVerificationDialog = (mode: 'regenerate' | 'revoke') => {
    setRecoveryKeyDialogMode(mode);
    setGeneratedRecoveryKey('');
    setRecoveryKeyTotpCode('');
    setRecoveryKeyEmailCode('');
    setRecoveryKeyVerificationValue('');
    setRecoveryKeyDialogError(null);
    setSelectedRecoveryKeyMethod(getPreferredVerificationMethod(recoveryKeyMethodOptions.map((option) => option.key)));
    setRecoveryKeyMethodDialogOpen(false);
    setRecoveryKeyEmailCodeSent(false);
    setRecoveryKeyDialogOpen(true);
  };

  const buildRecoveryKeyPayload = (
    method: VerificationMethodKey,
    webauthn?: RecoveryKeyVerificationRequest['webauthn']
  ): RecoveryKeyVerificationRequest => ({
    totp_code: method === 'totp' ? (recoveryKeyTotpCode || undefined) : undefined,
    email_code: method === 'email' ? (recoveryKeyEmailCode || undefined) : undefined,
    recovery_key: method === 'recovery_key' ? (recoveryKeyVerificationValue.trim().toUpperCase() || undefined) : undefined,
    webauthn: method === 'webauthn' ? webauthn : undefined,
  });

  const getSelectedRecoveryKeyPayload = () => {
    if (selectedRecoveryKeyMethod === 'totp') {
      if (!recoveryKeyTotpCode || recoveryKeyTotpCode.length !== 6) {
        setRecoveryKeyDialogError(t('login.errors.totpRequired'));
        return null;
      }
      return buildRecoveryKeyPayload('totp');
    }
    if (selectedRecoveryKeyMethod === 'email') {
      if (!recoveryKeyEmailCode || recoveryKeyEmailCode.length !== 6) {
        setRecoveryKeyDialogError(t('login.errors.emailCodeRequired'));
        return null;
      }
      return buildRecoveryKeyPayload('email');
    }
    if (selectedRecoveryKeyMethod === 'recovery_key') {
      if (!recoveryKeyVerificationValue.trim()) {
        setRecoveryKeyDialogError(t('login.errors.recoveryKeyRequired'));
        return null;
      }
      return buildRecoveryKeyPayload('recovery_key');
    }
    if (selectedRecoveryKeyMethod === 'webauthn') return buildRecoveryKeyPayload('webauthn');
    setRecoveryKeyDialogError(t('profile.recoveryKeyFactorRequired'));
    return null;
  };

  const selectRecoveryKeyMethod = async (method: VerificationMethodKey) => {
    setSelectedRecoveryKeyMethod(method);
    setRecoveryKeyDialogError(null);
    if (method === 'email' && !recoveryKeyEmailCodeSent) await handleSendRecoveryKeyEmailCode();
  };

  const performRecoveryKeyAction = async (payload: RecoveryKeyVerificationRequest) => {
    if (recoveryKeyDialogMode === 'regenerate') {
      const resp = await regenerateRecoveryKey(payload);
      if (resp.success && resp.data?.recovery_key) {
        await refreshTwoFactorStatus();
        setGeneratedRecoveryKey(resp.data.recovery_key);
        setRecoveryKeyDialogMode('display');
        setRecoveryKeyTotpCode('');
        setRecoveryKeyEmailCode('');
        setRecoveryKeyVerificationValue('');
        setTwoFactorFeedback({ severity: 'success', message: t('profile.recoveryKeyRegenerated') });
      } else {
        if (resp.code === 'recovery_key_not_configured') await refreshTwoFactorStatus();
        setRecoveryKeyDialogError(resp.message || t('profile.recoveryKeyRegenerateFailed'));
      }
      return;
    }
    const resp = await revokeRecoveryKey(payload);
    if (resp.success) {
      await refreshTwoFactorStatus();
      closeRecoveryKeyDialog();
      setTwoFactorFeedback({ severity: 'success', message: t('profile.recoveryKeyRevoked') });
    } else {
      if (resp.code === 'recovery_key_not_configured') await refreshTwoFactorStatus();
      setRecoveryKeyDialogError(resp.message || t('profile.recoveryKeyRevokeFailed'));
    }
  };

  const handleSubmitRecoveryKeyAction = async () => {
    if (selectedRecoveryKeyMethod === 'webauthn') {
      await handleRecoveryKeyWebAuthnAction();
      return;
    }
    const payload = getSelectedRecoveryKeyPayload();
    if (!payload) return;
    setRecoveryKeyLoading(true);
    setRecoveryKeyDialogError(null);
    setTwoFactorFeedback(null);
    try {
      await performRecoveryKeyAction(payload);
    } catch {
      setRecoveryKeyDialogError(t('common.serverError'));
    } finally {
      setRecoveryKeyLoading(false);
    }
  };

  const handleSendRecoveryKeyEmailCode = async () => {
    setRecoveryKeySendingEmailCode(true);
    setRecoveryKeyDialogError(null);
    try {
      const resp = await request(`${BackendUrl}/change-email/send-code`, { method: 'POST' });
      if (!resp.success) {
        setRecoveryKeyDialogError(resp.message || t('profile.recoveryKeySendEmailCodeFailed'));
        return;
      }
      setRecoveryKeyEmailCodeSent(true);
      setTwoFactorFeedback({ severity: 'success', message: t('profile.recoveryKeyEmailCodeSent') });
    } catch {
      setRecoveryKeyDialogError(t('common.serverError'));
    } finally {
      setRecoveryKeySendingEmailCode(false);
    }
  };

  const handleRecoveryKeyWebAuthnAction = async () => {
    setRecoveryKeyLoading(true);
    setRecoveryKeyDialogError(null);
    setTwoFactorFeedback(null);
    try {
      const beginResp = await beginWebAuthnSudo();
      if (!beginResp.success || !beginResp.data) {
        setRecoveryKeyDialogError(beginResp.message || t('profile.webauthnOperationFailed'));
        return;
      }
      const credential = await authenticateWithWebAuthn(beginResp.data.options);
      await performRecoveryKeyAction(buildRecoveryKeyPayload('webauthn', {
        flow_id: beginResp.data.flow_id,
        credential,
      }));
    } catch (err: any) {
      setRecoveryKeyDialogError(err?.message || t('profile.webauthnOperationFailed'));
    } finally {
      setRecoveryKeyLoading(false);
    }
  };

  const openChangeEmailDialog = () => {
    setNewEmail('');
    setEmailCode('');
    setChangeEmailTotpCode('');
    setChangeEmailRecoveryKey('');
    setChangeEmailError(null);
    setChangeEmailSuccess(false);
    setChangeEmailCodeSent(false);
    setSelectedChangeEmailMethod(getPreferredVerificationMethod(changeEmailMethodOptions.map((option) => option.key)));
    setChangeEmailMethodDialogOpen(false);
    setChangeEmailDialogOpen(true);
  };

  const closeChangeEmailDialog = () => {
    if (changeEmailLoading) return;
    setChangeEmailMethodDialogOpen(false);
    setChangeEmailDialogOpen(false);
  };

  const selectChangeEmailMethod = async (method: VerificationMethodKey) => {
    setSelectedChangeEmailMethod(method);
    setChangeEmailError(null);
    if (method === 'email' && !changeEmailCodeSent) await handleSendChangeEmailCode();
  };

  const handleSendChangeEmailCode = async () => {
    setSendingEmailCode(true);
    setChangeEmailError(null);
    try {
      const resp = await request(`${BackendUrl}/change-email/send-code`, { method: 'POST' });
      if (resp.success) {
        setChangeEmailCodeSent(true);
        setChangeEmailError(null);
      } else {
        setChangeEmailError(resp.message || t('profile.saveFailed'));
      }
    } catch {
      setChangeEmailError(t('common.serverError'));
    } finally {
      setSendingEmailCode(false);
    }
  };

  const handleBeginWebAuthnSudo = async () => {
    setChangeEmailLoading(true);
    setChangeEmailError(null);
    try {
      const beginResp = await beginWebAuthnSudo();
      if (beginResp.success && beginResp.data) {
        const credential = await authenticateWithWebAuthn(beginResp.data.options);
        const params = {
          new_email: newEmail,
          webauthn: {
            flow_id: beginResp.data.flow_id,
            credential,
          },
        };
        const resp = await request(`${BackendUrl}/change-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        });
        if (resp.success) {
          setChangeEmailSuccess(true);
          setTimeout(() => {
            setChangeEmailDialogOpen(false);
            setChangeEmailSuccess(false);
            clearAuthCookies();
            navigate('/login');
          }, 2000);
        } else {
          setChangeEmailError(resp.message || t('profile.saveFailed'));
        }
      }
    } catch (err: any) {
      setChangeEmailError(err.message || t('profile.webauthnOperationFailed'));
    } finally {
      setChangeEmailLoading(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!newEmail) {
      setChangeEmailError(t('register.errors.invalidEmail'));
      return;
    }
    if (selectedChangeEmailMethod === 'webauthn') {
      await handleBeginWebAuthnSudo();
      return;
    }
    let params: any = null;
    if (selectedChangeEmailMethod === 'email') {
      if (!emailCode || emailCode.length !== 6) {
        setChangeEmailError(t('login.errors.emailCodeRequired'));
        return;
      }
      params = { new_email: newEmail, email_code: emailCode };
    } else if (selectedChangeEmailMethod === 'totp') {
      if (!changeEmailTotpCode || changeEmailTotpCode.length !== 6) {
        setChangeEmailError(t('login.errors.totpRequired'));
        return;
      }
      params = { new_email: newEmail, totp_code: changeEmailTotpCode };
    } else if (selectedChangeEmailMethod === 'recovery_key') {
      if (!changeEmailRecoveryKey.trim()) {
        setChangeEmailError(t('login.errors.recoveryKeyRequired'));
        return;
      }
      params = {
        new_email: newEmail,
        recovery_key: changeEmailRecoveryKey.trim().toUpperCase(),
      };
    } else {
      setChangeEmailError(t('profile.changeEmailInsufficientAuth'));
      return;
    }

    setChangeEmailLoading(true);
    setChangeEmailError(null);
    try {
      const resp = await request(`${BackendUrl}/change-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (resp.success) {
        setChangeEmailSuccess(true);
        setTimeout(() => {
          setChangeEmailDialogOpen(false);
          setChangeEmailSuccess(false);
          clearAuthCookies();
          navigate('/login');
        }, 2000);
      } else {
        setChangeEmailError(resp.message || t('profile.saveFailed'));
      }
    } catch {
      setChangeEmailError(t('common.serverError'));
    } finally {
      setChangeEmailLoading(false);
    }
  };

  const handleOpenTotpDialog = async () => {
    const email = getUserEmail();
    if (!email) {
      setTwoFactorFeedback({ severity: 'error', message: t('profile.notLoggedInError') });
      return;
    }
    setTotpLoading(true);
    setTwoFactorFeedback(null);
    setTotpError(null);
    setTotpKey(null);
    setPasscode('');
    setPasscodeError(null);
    setSetupSuccess(false);
    try {
      const resp = await setupTotp(email);
      const nextTotpKey = resp.data?.totpkey ?? (resp as any).totpkey;
      if (resp.success && nextTotpKey) {
        setTotpKey(nextTotpKey);
        setTotpDialogOpen(true);
      } else {
        setTwoFactorFeedback({ severity: 'error', message: resp.message || t('profile.totpSetupFailed') });
      }
    } catch {
      setTwoFactorFeedback({ severity: 'error', message: t('common.serverError') });
    } finally {
      setTotpLoading(false);
    }
  };

  const handleCloseTotpDialog = () => {
    setTotpDialogOpen(false);
    setTotpKey(null);
    setPasscode('');
    setPasscodeError(null);
    setTotpError(null);
    setSetupSuccess(false);
  };

  const handleEnableTotp = async () => {
    const email = getUserEmail();
    if (!email) {
      setTwoFactorFeedback({ severity: 'error', message: t('profile.notLoggedInError') });
      return;
    }
    setTotpLoading(true);
    setTwoFactorFeedback(null);
    try {
      const resp = await toggleTotp(true);
      if (resp.success) {
        await refreshTwoFactorStatus();
        setTwoFactorFeedback({ severity: 'success', message: t('profile.totpEnabledSuccess') });
        return;
      }
      if (resp.code === 'totp_not_configured') {
        await handleOpenTotpDialog();
        return;
      }
      setTwoFactorFeedback({ severity: 'error', message: resp.message || t('profile.totpToggleFailed') });
    } catch {
      setTwoFactorFeedback({ severity: 'error', message: t('common.serverError') });
    } finally {
      setTotpLoading(false);
    }
  };

  const handleDisableTotp = async () => {
    setTotpLoading(true);
    setTwoFactorFeedback(null);
    try {
      const resp = await toggleTotp(false);
      if (resp.success) {
        await refreshTwoFactorStatus();
        setDisableTotpDialogOpen(false);
        setTwoFactorFeedback({ severity: 'success', message: t('profile.totpDisabledSuccess') });
      } else {
        setTwoFactorFeedback({ severity: 'error', message: resp.message || t('profile.totpToggleFailed') });
      }
    } catch {
      setTwoFactorFeedback({ severity: 'error', message: t('common.serverError') });
    } finally {
      setTotpLoading(false);
    }
  };

  const handleVerifyPasscode = async () => {
    if (!passcode || passcode.length !== 6 || !/^\d+$/.test(passcode)) {
      setPasscodeError(t('profile.passcodeInvalid'));
      return;
    }
    const email = getUserEmail();
    if (!email) {
      setPasscodeError(t('profile.userInfoFailed'));
      return;
    }
    setVerifying(true);
    setPasscodeError(null);
    try {
      const resp = await verifyTotp(email, passcode, true);
      if (resp.success) {
        setSetupSuccess(true);
        await refreshTwoFactorStatus();
        setTwoFactorFeedback({ severity: 'success', message: t('profile.totpEnabledSuccess') });
        setTimeout(() => handleCloseTotpDialog(), 1500);
      } else {
        setPasscodeError(resp.message || t('profile.verifyFailed'));
      }
    } catch {
      setPasscodeError(t('common.serverError'));
    } finally {
      setVerifying(false);
    }
  };

  const generateOtpAuthUri = (secret: string, email: string): string => {
    const issuer = 'HRPAuth';
    const encodedIssuer = encodeURIComponent(issuer);
    const encodedAccount = encodeURIComponent(email);
    return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return t('profile.webauthnNeverUsed');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  const getWebAuthnAvailabilityError = () => {
    if (typeof window === 'undefined' || !window.isSecureContext) return t('profile.webauthnSecureContextRequired');
    if (!isWebAuthnSupported()) return t('profile.webauthnUnsupported');
    if (!webauthnBackendAvailable) return t('profile.webauthnBackendNotConfigured');
    return null;
  };

  const handleOpenWebAuthnDialog = () => {
    setWebauthnDialogOpen(true);
    setWebauthnName('');
    setWebauthnNameError(null);
    setPendingWebAuthnRegistration(null);
  };

  const handleCloseWebAuthnDialog = () => {
    if (webauthnLoading) return;
    setWebauthnDialogOpen(false);
    setWebauthnName('');
    setWebauthnNameError(null);
    setPendingWebAuthnRegistration(null);
  };

  const handleRegisterWebAuthn = async () => {
    const trimmedName = webauthnName.trim();
    if (trimmedName.length > 64) {
      setWebauthnNameError(t('profile.webauthnNameTooLong'));
      return;
    }
    const availabilityError = getWebAuthnAvailabilityError();
    if (availabilityError) {
      setWebauthnFeedback({ severity: 'error', message: availabilityError });
      return;
    }
    setWebauthnLoading(true);
    setWebauthnFeedback(null);
    setWebauthnNameError(null);
    try {
      if (!pendingWebAuthnRegistration) {
        const beginResp = await beginWebAuthnRegistration(trimmedName || undefined);
        const flowId = beginResp.data?.flow_id;
        const options = beginResp.data?.options;
        if (!beginResp.success || !flowId || !options) {
          if (beginResp.code === 'webauthn_not_configured') setWebauthnBackendAvailable(false);
          setWebauthnFeedback({ severity: 'error', message: beginResp.message || t('profile.webauthnOperationFailed') });
          return;
        }
        setPendingWebAuthnRegistration({ flowId, options });
        setWebauthnFeedback({ severity: 'success', message: t('profile.webauthnReadyForPrompt') });
        return;
      }
      const credential = await registerWithWebAuthn(pendingWebAuthnRegistration.options);
      const finishResp = await finishWebAuthnRegistration(pendingWebAuthnRegistration.flowId, credential);
      if (!finishResp.success) {
        if (finishResp.code === 'webauthn_not_configured') setWebauthnBackendAvailable(false);
        setWebauthnFeedback({ severity: 'error', message: finishResp.message || t('profile.webauthnOperationFailed') });
        return;
      }
      await Promise.all([refreshTwoFactorStatus(), refreshWebAuthnStatus()]);
      setWebauthnDialogOpen(false);
      setWebauthnName('');
      setPendingWebAuthnRegistration(null);
      setWebauthnFeedback({ severity: 'success', message: t('profile.webauthnRegisterSuccess') });
    } catch (err: any) {
      let message = t('profile.webauthnRegisterFailed');
      if (err instanceof DOMException && err.name === 'SecurityError') message = t('profile.webauthnSecurityError');
      else if (err instanceof DOMException && err.name === 'NotAllowedError') message = t('profile.webauthnNotAllowedError');
      else if (err instanceof Error && err.message === 'WebAuthn is not supported in this browser') message = t('profile.webauthnUnsupported');
      else if (err instanceof Error) message = err.message;
      setWebauthnFeedback({ severity: 'error', message });
    } finally {
      setWebauthnLoading(false);
    }
  };

  const handleToggleWebAuthn2fa = async (enabled: boolean) => {
    setWebauthnLoading(true);
    setWebauthnFeedback(null);
    try {
      const resp = await toggleWebAuthnSecondFactor(enabled);
      if (!resp.success) {
        setWebauthnFeedback({ severity: 'error', message: resp.message || t('profile.webauthnOperationFailed') });
        return;
      }
      await refreshTwoFactorStatus();
      setWebauthnFeedback({
        severity: 'success',
        message: enabled ? t('profile.webauthnSecondFactorEnabled') : t('profile.webauthnSecondFactorDisabled'),
      });
    } catch {
      setWebauthnFeedback({ severity: 'error', message: t('profile.webauthnOperationFailed') });
    } finally {
      setWebauthnLoading(false);
    }
  };

  const handleDeleteWebAuthnCredential = async () => {
    if (!credentialToDelete) return;
    setWebauthnLoading(true);
    setWebauthnFeedback(null);
    try {
      const resp = await deleteWebAuthnCredential(credentialToDelete.id);
      if (!resp.success) {
        setWebauthnFeedback({ severity: 'error', message: resp.message || t('profile.webauthnCredentialDeleteFailed') });
        return;
      }
      await Promise.all([refreshTwoFactorStatus(), refreshWebAuthnStatus()]);
      setCredentialToDelete(null);
      setWebauthnFeedback({ severity: 'success', message: t('profile.webauthnCredentialDeleteSuccess') });
    } catch {
      setWebauthnFeedback({ severity: 'error', message: t('profile.webauthnCredentialDeleteFailed') });
    } finally {
      setWebauthnLoading(false);
    }
  };

  const handleOpenDeleteDialog = () => {
    setDeleteDialogOpen(true);
    setDeletePassword('');
    setDeletePasswordError(null);
  };

  const handleCloseDeleteDialog = () => {
    if (deleteLoading) return;
    setDeleteDialogOpen(false);
    setDeletePassword('');
    setDeletePasswordError(null);
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setDeletePasswordError(t('profile.deletePasswordRequired'));
      return;
    }
    setDeleteLoading(true);
    setDeletePasswordError(null);
    try {
      const resp = await requestAccountDeletion(deletePassword);
      if (resp.success) {
        clearAuthCookies();
        navigate('/login', { replace: true });
      } else {
        setDeletePasswordError(resp.message || t('profile.deleteAccountFailed'));
      }
    } catch {
      setDeletePasswordError(t('common.serverError'));
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!userInfo) return null;

  const webauthnAvailabilityError = getWebAuthnAvailabilityError();
  const webauthnRegistrationReady = !webauthnAvailabilityError;
  const webauthnCredentialSummary = webauthnCredentials.length > 0
    ? t('profile.webauthnCredentialCount', { count: webauthnCredentials.length })
    : t('profile.webauthnNotRegistered');
  const webauthnPrimaryActionLabel = webauthnCredentials.length > 0
    ? t('profile.webauthnManage')
    : t('profile.webauthnRegister');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Card sx={{ maxWidth: 600 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('profile.accountCredentialsTitle') || '账号凭据'}
          </Typography>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  {t('profile.currentEmailLabel')}
                </Typography>
                <Typography variant="body1">
                  {userInfo.email}
                </Typography>
              </Box>
              <Button
                variant="outlined"
                size="small"
                onClick={openChangeEmailDialog}
              >
                {t('profile.changeEmailTitle')}
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ maxWidth: 600 }}>
        <CardContent>
          <Stack spacing={3}>
            <Box>
              <Typography variant="h6" gutterBottom>
                {t('profile.twoFactorSectionTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('profile.twoFactorSectionSubtitle')}
              </Typography>
            </Box>

            <Box>
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {t('profile.totpTitle')}
                    </Typography>
                    <Chip
                      label={userInfo.totp_enabled ? t('profile.statusEnabled') : t('profile.statusDisabled')}
                      color={userInfo.totp_enabled ? 'success' : 'default'}
                      size="small"
                      variant="outlined"
                    />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {userInfo.totp_enabled ? t('profile.totpEnabled') : t('profile.totpDisabled')}
                  </Typography>
                </Box>
                {userInfo.totp_enabled ? (
                  <Stack direction="column" spacing={1} alignItems="flex-end">
                    <Button variant="outlined" size="small" startIcon={<Key />} onClick={handleOpenTotpDialog} disabled={totpLoading}>
                      {totpLoading ? t('profile.totpLoading') : t('profile.totpReset')}
                    </Button>
                    <Button color="warning" variant="text" size="small" onClick={() => setDisableTotpDialogOpen(true)} disabled={totpLoading}>
                      {t('profile.totpDisable')}
                    </Button>
                  </Stack>
                ) : (
                  <Button variant="contained" startIcon={<Key />} onClick={handleEnableTotp} disabled={totpLoading}>
                    {totpLoading ? t('profile.totpLoading') : t('profile.totpEnable')}
                  </Button>
                )}
              </Stack>
            </Box>

            <Divider />

            <Box>
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {t('profile.email2faTitle')}
                    </Typography>
                    <Chip
                      label={email2faEnabled ? t('profile.statusEnabled') : t('profile.statusDisabled')}
                      color={email2faEnabled ? 'success' : 'default'}
                      size="small"
                      variant="outlined"
                    />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {t('profile.email2faSubtitle')}
                  </Typography>
                </Box>
                <FormControlLabel
                  control={<Switch size="small" checked={email2faEnabled} onChange={(e) => handleToggleEmail2fa(e.target.checked)} disabled={email2faLoading} />}
                  label=""
                  sx={{ mr: 0 }}
                />
              </Stack>
            </Box>

            <Divider />

            <Box>
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {t('profile.recoveryKeyTitle')}
                    </Typography>
                    <Chip
                      label={recoveryKeyEnabled ? t('profile.statusEnabled') : t('profile.statusDisabled')}
                      color={recoveryKeyEnabled ? 'success' : 'default'}
                      size="small"
                      variant="outlined"
                    />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {recoveryKeyEnabled ? t('profile.recoveryKeyEnabled') : t('profile.recoveryKeyDisabled')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                    {t('profile.recoveryKeyHint')}
                  </Typography>
                </Box>
                {recoveryKeyEnabled ? (
                  <Stack direction="column" spacing={1} alignItems="flex-end">
                    <Button variant="outlined" size="small" startIcon={<Key />} onClick={() => openRecoveryKeyVerificationDialog('regenerate')} disabled={recoveryKeyLoading}>
                      {recoveryKeyLoading ? t('profile.totpLoading') : t('profile.recoveryKeyRegenerate')}
                    </Button>
                    <Button color="warning" variant="text" size="small" onClick={() => openRecoveryKeyVerificationDialog('revoke')} disabled={recoveryKeyLoading}>
                      {t('profile.recoveryKeyRevoke')}
                    </Button>
                  </Stack>
                ) : (
                  <Button variant="contained" startIcon={<Key />} onClick={handleCreateRecoveryKey} disabled={recoveryKeyLoading}>
                    {recoveryKeyLoading ? t('profile.totpLoading') : t('profile.recoveryKeyCreate')}
                  </Button>
                )}
              </Stack>
            </Box>

            <Divider />

            <Box>
              <Box sx={{ mb: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {t('profile.webauthnTitle')}
                  </Typography>
                  <Chip
                    label={webauthnCredentialSummary}
                    color={webauthnCredentials.length > 0 ? 'success' : 'default'}
                    size="small"
                    variant="outlined"
                  />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {webauthnClientSupported ? t('profile.webauthnSubtitle') : t('profile.webauthnUnsupportedHint')}
                </Typography>
              </Box>
              <Stack direction="column" spacing={2}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Button variant="outlined" size="small" startIcon={<Key />} onClick={handleOpenWebAuthnDialog} disabled={webauthnLoading || !webauthnRegistrationReady}>
                    {webauthnLoading ? t('profile.totpLoading') : webauthnPrimaryActionLabel}
                  </Button>
                  <FormControlLabel
                    control={<Switch size="small" checked={webauthn2faEnabled} onChange={(e) => handleToggleWebAuthn2fa(e.target.checked)} disabled={webauthnLoading || webauthnCredentials.length === 0} />}
                    label={<Typography variant="body2">{t('profile.webauthnSecondFactorLabel')}</Typography>}
                  />
                </Box>
                {webauthnCredentials.length === 0 && (
                  <Typography variant="caption" color="text.secondary">
                    {t('profile.webauthnSecondFactorDisabledHint')}
                  </Typography>
                )}
              </Stack>
            </Box>

            {(twoFactorFeedback || webauthnFeedback || webauthnAvailabilityError) && (
              <Stack spacing={1}>
                {twoFactorFeedback && <Alert severity={twoFactorFeedback.severity}>{twoFactorFeedback.message}</Alert>}
                {webauthnAvailabilityError && <Alert severity="info">{webauthnAvailabilityError}</Alert>}
                {webauthnFeedback && <Alert severity={webauthnFeedback.severity}>{webauthnFeedback.message}</Alert>}
              </Stack>
            )}

            {webauthnCredentials.length > 0 && (
              <Stack spacing={1.5}>
                <Typography variant="subtitle2">{t('profile.webauthnCredentialsTitle')}</Typography>
                {webauthnCredentials.map((credential) => (
                  <Box key={credential.id} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{credential.name || t('profile.webauthnUnnamedCredential')}</Typography>
                        <Typography variant="caption" color="text.secondary" display="block">{t('profile.webauthnCreatedAt', { value: formatDateTime(credential.created_at) })}</Typography>
                        <Typography variant="caption" color="text.secondary" display="block">{t('profile.webauthnLastUsedAt', { value: formatDateTime(credential.last_used_at) })}</Typography>
                      </Box>
                      <Button color="error" variant="text" size="small" startIcon={<Delete />} onClick={() => setCredentialToDelete(credential)} disabled={webauthnLoading}>
                        {t('profile.webauthnDeleteCredential')}
                      </Button>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ maxWidth: 600, mt: 2 }}>
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6" gutterBottom>{t('profile.deleteAccountTitle')}</Typography>
              <Typography variant="body2" color="text.secondary">{t('profile.deleteAccountSubtitle')}</Typography>
            </Box>
            <Alert severity="warning">{t('profile.deleteAccountWarning')}</Alert>
            <Box>
              <Button color="error" variant="outlined" startIcon={<Delete />} onClick={handleOpenDeleteDialog}>
                {t('profile.deleteAccountAction')}
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Dialog open={webauthnDialogOpen} onClose={handleCloseWebAuthnDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{t('profile.webauthnRegisterDialogTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {webauthnFeedback && <Alert severity={webauthnFeedback.severity}>{webauthnFeedback.message}</Alert>}
            <Typography variant="body2" color="text.secondary">{t('profile.webauthnRegisterHint')}</Typography>
            <TextField
              label={t('profile.webauthnNameLabel')}
              value={webauthnName}
              onChange={(e) => {
                setWebauthnName(e.target.value);
                if (webauthnNameError) setWebauthnNameError(null);
                if (pendingWebAuthnRegistration) setPendingWebAuthnRegistration(null);
              }}
              placeholder={t('profile.webauthnNamePlaceholder')}
              error={!!webauthnNameError}
              helperText={webauthnNameError || t('profile.webauthnNameHelper')}
              fullWidth
              disabled={webauthnLoading}
            />
            {pendingWebAuthnRegistration && <Alert severity="info">{t('profile.webauthnReadyForPromptHint')}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseWebAuthnDialog} disabled={webauthnLoading}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleRegisterWebAuthn} disabled={webauthnLoading}>
            {webauthnLoading ? t('profile.totpLoading') : (pendingWebAuthnRegistration ? t('profile.webauthnTriggerPrompt') : t('profile.webauthnPrepareRegister'))}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(credentialToDelete)} onClose={() => (webauthnLoading ? undefined : setCredentialToDelete(null))} maxWidth="xs" fullWidth>
        <DialogTitle>{t('profile.webauthnDeleteDialogTitle')}</DialogTitle>
        <DialogContent>
          <Typography sx={{ mt: 1 }}>
            {t('profile.webauthnDeleteDialogDescription', { name: credentialToDelete?.name || t('profile.webauthnUnnamedCredential') })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCredentialToDelete(null)} disabled={webauthnLoading}>{t('common.cancel')}</Button>
          <Button color="error" variant="contained" onClick={handleDeleteWebAuthnCredential} disabled={webauthnLoading}>
            {webauthnLoading ? t('profile.totpLoading') : t('profile.webauthnDeleteCredential')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={totpDialogOpen} onClose={handleCloseTotpDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{t('profile.setupDialogTitle')}</DialogTitle>
        <DialogContent>
          {setupSuccess ? <Alert severity="success" sx={{ mt: 2 }}>{t('profile.setupSuccess')}</Alert> : (
            <>
              {totpError && <Alert severity="error" sx={{ mb: 2 }}>{totpError}</Alert>}
              {totpKey && (
                <>
                  <Typography variant="body1" sx={{ mb: 2 }}>{t('profile.scanHint')}</Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                    <QRCodeSVG value={generateOtpAuthUri(totpKey, userInfo?.email || '')} size={200} level="M" />
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
                    {t('profile.manualKeyHint')} <strong>{totpKey}</strong>
                  </Typography>
                  <TextField
                    label={t('profile.passcodeLabel')}
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    fullWidth
                    margin="dense"
                    error={!!passcodeError}
                    helperText={passcodeError}
                    slotProps={{ input: { endAdornment: <InputAdornment position="end"><Typography variant="caption" color="text.secondary">{passcode.length}/6</Typography></InputAdornment> } }}
                  />
                </>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseTotpDialog}>{t('profile.cancel')}</Button>
          {!setupSuccess && totpKey && (
            <Button variant="contained" onClick={handleVerifyPasscode} disabled={verifying || passcode.length !== 6}>
              {verifying ? t('profile.verifying') : t('profile.verify')}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={disableTotpDialogOpen} onClose={() => setDisableTotpDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('profile.disableTotpDialogTitle')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{t('profile.disableTotpDialogDescription')}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDisableTotpDialogOpen(false)} disabled={totpLoading}>{t('profile.cancel')}</Button>
          <Button color="warning" variant="contained" onClick={handleDisableTotp} disabled={totpLoading}>
            {totpLoading ? t('profile.totpLoading') : t('profile.totpDisable')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={recoveryKeyDialogOpen} onClose={closeRecoveryKeyDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {recoveryKeyDialogMode === 'display' ? t('profile.recoveryKeyDialogTitle') : (recoveryKeyDialogMode === 'regenerate' ? t('profile.recoveryKeyRegenerateDialogTitle') : t('profile.recoveryKeyRevokeDialogTitle'))}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {recoveryKeyDialogMode === 'display' ? (
              <>
                <Alert severity="success">{t('profile.recoveryKeyDisplaySuccess')}</Alert>
                <Typography variant="body2" color="text.secondary">{t('profile.recoveryKeyDisplayHint')}</Typography>
                <TextField label={t('profile.recoveryKeyLabel')} value={generatedRecoveryKey} fullWidth slotProps={{ input: { readOnly: true } }} />
              </>
            ) : (
              <>
                {recoveryKeyDialogError && <Alert severity="error">{recoveryKeyDialogError}</Alert>}
                <Typography variant="body2" color="text.secondary">
                  {recoveryKeyDialogMode === 'regenerate' ? t('profile.recoveryKeyRegenerateHint') : t('profile.recoveryKeyRevokeHint')}
                </Typography>
                {selectedRecoveryKeyMethod === 'totp' && <TextField label={t('profile.totpTitle')} value={recoveryKeyTotpCode} onChange={(e) => setRecoveryKeyTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder={t('login.totpPlaceholder')} fullWidth disabled={recoveryKeyLoading} helperText={t('profile.recoveryKeyMethodTotpDescription')} />}
                {selectedRecoveryKeyMethod === 'email' && (
                  <Stack direction="row" spacing={1}>
                    <TextField label={t('profile.emailCodeLabel')} value={recoveryKeyEmailCode} onChange={(e) => setRecoveryKeyEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder={t('profile.emailCodePlaceholder')} fullWidth disabled={recoveryKeyLoading || recoveryKeySendingEmailCode} helperText={t('profile.recoveryKeyMethodEmailDescription')} />
                    <Button type="button" variant="outlined" onClick={handleSendRecoveryKeyEmailCode} disabled={recoveryKeyLoading || recoveryKeySendingEmailCode} sx={{ height: 56 }}>{recoveryKeySendingEmailCode ? t('common.loading') : t('profile.sendCodeToCurrentEmail')}</Button>
                  </Stack>
                )}
                {selectedRecoveryKeyMethod === 'recovery_key' && <TextField label={t('profile.recoveryKeyCurrentLabel')} value={recoveryKeyVerificationValue} onChange={(e) => setRecoveryKeyVerificationValue(e.target.value.toUpperCase().slice(0, 19))} placeholder={t('profile.recoveryKeyPlaceholder')} fullWidth disabled={recoveryKeyLoading} helperText={t('profile.recoveryKeyMethodRecoveryDescription')} />}
                {selectedRecoveryKeyMethod === 'webauthn' && <Alert severity="info">{t('profile.recoveryKeyMethodPasskeyDescription')}</Alert>}
                {recoveryKeyMethodOptions.length > 1 && (
                  <Button type="button" variant="text" onClick={() => setRecoveryKeyMethodDialogOpen(true)} disabled={recoveryKeyLoading || recoveryKeySendingEmailCode} sx={{ mt: 0.5, px: 0.5, py: 1.25, minHeight: 44, textTransform: 'none', fontWeight: 600, fontSize: '1rem', justifyContent: 'flex-start', alignSelf: 'flex-start' }}>{t('profile.switchVerificationMethod')}</Button>
                )}
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRecoveryKeyDialog} disabled={recoveryKeyLoading || recoveryKeySendingEmailCode}>{t('common.cancel')}</Button>
          {recoveryKeyDialogMode !== 'display' && (
            <Button variant="contained" color={recoveryKeyDialogMode === 'revoke' ? 'warning' : 'primary'} onClick={handleSubmitRecoveryKeyAction} disabled={recoveryKeyLoading || recoveryKeySendingEmailCode}>
              {recoveryKeyLoading ? t('common.pleaseWait') : (recoveryKeyDialogMode === 'regenerate' ? t('profile.recoveryKeyRegenerate') : t('profile.recoveryKeyRevoke'))}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{t('profile.deleteAccountDialogTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="warning">{t('profile.deleteAccountDialogWarning')}</Alert>
            <Typography variant="body2" color="text.secondary">{t('profile.deleteAccountDialogDescription')}</Typography>
            <TextField type="password" label={t('profile.deletePasswordLabel')} value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} fullWidth autoComplete="current-password" error={!!deletePasswordError} helperText={deletePasswordError} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog} disabled={deleteLoading}>{t('profile.cancel')}</Button>
          <Button color="error" variant="contained" onClick={handleDeleteAccount} disabled={deleteLoading}>
            {deleteLoading ? t('common.pleaseWait') : t('profile.deleteAccountConfirm')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={changeEmailDialogOpen} onClose={closeChangeEmailDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{t('profile.changeEmailTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {changeEmailSuccess ? (
              <Alert severity="success">
                {t('profile.changeEmailSuccess')}
              </Alert>
            ) : (
              <>
                {changeEmailError && (
                  <Alert severity="error">
                    {changeEmailError}
                  </Alert>
                )}

                <TextField
                  label={t('profile.newEmailLabel')}
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder={t('profile.newEmailPlaceholder')}
                  fullWidth
                  disabled={changeEmailLoading}
                />

                <Divider />

                {selectedChangeEmailMethod === 'email' && (
                  <Stack direction="row" spacing={1}>
                    <TextField
                      label={t('profile.emailCodeLabel')}
                      value={emailCode}
                      onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder={t('profile.emailCodePlaceholder')}
                      fullWidth
                      disabled={changeEmailLoading || sendingEmailCode}
                      helperText={t('profile.changeEmailMethodEmailDescription')}
                    />
                    <Button
                      type="button"
                      variant="outlined"
                      onClick={handleSendChangeEmailCode}
                      disabled={sendingEmailCode || changeEmailLoading}
                      sx={{ height: 56 }}
                    >
                      {sendingEmailCode ? t('common.loading') : t('profile.sendCodeToCurrentEmail')}
                    </Button>
                  </Stack>
                )}

                {selectedChangeEmailMethod === 'totp' && (
                  <TextField
                    label={t('profile.totpTitle')}
                    value={changeEmailTotpCode}
                    onChange={(e) => setChangeEmailTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder={t('login.totpPlaceholder')}
                    fullWidth
                    disabled={changeEmailLoading}
                    helperText={t('profile.changeEmailMethodTotpDescription')}
                  />
                )}

                {selectedChangeEmailMethod === 'recovery_key' && (
                  <TextField
                    label={t('profile.recoveryKeyLabel')}
                    value={changeEmailRecoveryKey}
                    onChange={(e) => setChangeEmailRecoveryKey(e.target.value.toUpperCase().slice(0, 19))}
                    placeholder={t('profile.recoveryKeyPlaceholder')}
                    fullWidth
                    disabled={changeEmailLoading}
                    helperText={t('profile.changeEmailMethodRecoveryDescription')}
                  />
                )}

                {selectedChangeEmailMethod === 'webauthn' && (
                  <Alert severity="info">
                    {t('profile.changeEmailMethodPasskeyDescription')}
                  </Alert>
                )}

                {changeEmailMethodOptions.length > 1 && (
                  <Button
                    type="button"
                    variant="text"
                    onClick={() => setChangeEmailMethodDialogOpen(true)}
                    disabled={changeEmailLoading || sendingEmailCode}
                    sx={{
                      mt: 0.5,
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
                    {t('profile.switchVerificationMethod')}
                  </Button>
                )}
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeChangeEmailDialog} disabled={changeEmailLoading}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleChangeEmail}
            disabled={changeEmailLoading || changeEmailSuccess}
          >
            {changeEmailLoading ? t('common.loading') : t('profile.changeEmailAction')}
          </Button>
        </DialogActions>
      </Dialog>

      <VerificationMethodPickerDialog
        open={changeEmailMethodDialogOpen}
        title={t('profile.chooseVerificationMethodDialogTitle')}
        value={selectedChangeEmailMethod}
        options={changeEmailMethodOptions}
        closeLabel={t('common.cancel')}
        onSelect={(method) => {
          void selectChangeEmailMethod(method);
          setChangeEmailMethodDialogOpen(false);
        }}
        onClose={() => setChangeEmailMethodDialogOpen(false)}
      />

      <VerificationMethodPickerDialog
        open={recoveryKeyMethodDialogOpen}
        title={t('profile.chooseVerificationMethodDialogTitle')}
        value={selectedRecoveryKeyMethod}
        options={recoveryKeyMethodOptions}
        closeLabel={t('common.cancel')}
        onSelect={(method) => {
          void selectRecoveryKeyMethod(method);
          setRecoveryKeyMethodDialogOpen(false);
        }}
        onClose={() => setRecoveryKeyMethodDialogOpen(false)}
      />
    </Box>
  );
}
