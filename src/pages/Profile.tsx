import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import type { ChangeEvent } from 'react';
import { Box, Typography, Card, CardContent, Avatar, CircularProgress, Alert, Chip, Stack, Link, TextField, Button, Dialog, DialogTitle, DialogContent, DialogActions, InputAdornment, FormControlLabel, Switch, Divider } from '@mui/material';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Warning from '@mui/icons-material/Warning';
import Edit from '@mui/icons-material/Edit';
import Save from '@mui/icons-material/Save';
import Key from '@mui/icons-material/Key';
import CloudUpload from '@mui/icons-material/CloudUpload';
import Delete from '@mui/icons-material/Delete';
import Photo from '@mui/icons-material/Photo';
import { QRCodeSVG } from 'qrcode.react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { dataCache } from '../utils/dataCache';
const SkinViewer3D = lazy(() => import('../components/SkinViewer3D'));
import { request } from '../utils/api';
import {
  beginWebAuthnRegistration,
  createRecoveryKey,
  deleteWebAuthnCredential,
  finishWebAuthnRegistration,
  listWebAuthnCredentials,
  regenerateRecoveryKey,
  requestAccountDeletion,
  revokeRecoveryKey,
  setupTotp,
  toggleTotp,
  toggleWebAuthnSecondFactor,
  type RecoveryKeyVerificationRequest,
  type WebAuthnCredentialRecord,
  type WebAuthnPublicKeyOptions,
  verifyTotp,
  toggleEmail2fa,
  getTwoFactorStatus,
} from '../api/auth';
import {
  sendChangeEmailCode,
  changeEmail,
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

type TextureType = 'skin' | 'cape';

interface TextureManageDialogProps {
  open: boolean;
  onClose: () => void;
  token: string;
  onUpdated?: () => void;
}

interface TextureInfo {
  texture_type: string;
  url: string;
  model?: string;
}

interface ActionFeedback {
  severity: 'success' | 'error';
  message: string;
}

interface PendingWebAuthnRegistration {
  flowId: string;
  options: WebAuthnPublicKeyOptions;
}

function reportWebAuthnDebug(
  hypothesisId: string,
  location: string,
  msg: string,
  data: Record<string, unknown> = {}
) {
  fetch('http://127.0.0.1:7777/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'webauthn-bind-flow',
      runId: 'pre-fix',
      hypothesisId,
      location,
      msg: `[DEBUG] ${msg}`,
      data,
      ts: Date.now(),
    }),
  }).catch(() => {});
}

function reportProfile2faDebug(
  hypothesisId: string,
  location: string,
  msg: string,
  data: Record<string, unknown> = {}
) {
  fetch('http://127.0.0.1:7777/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'profile-2fa-status',
      runId: 'pre-fix',
      hypothesisId,
      location,
      msg: `[DEBUG] ${msg}`,
      data,
      ts: Date.now(),
    }),
  }).catch(() => {});
}

/**
 * 修正纹理 URL。
 * 后端返回的绝对 URL 可能指向内部域名或错误的协议（如生产环境下返回 http 而非 https），
 * 导致浏览器拦截或无法访问。
 * 此函数将其统一修正为相对于当前配置的 BackendUrl。
 */
function normalizeTextureUrl(url: string): string {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    // 开发环境下，改为同源相对路径以支持 Vite 代理
    if (import.meta.env.DEV) {
      return parsed.pathname;
    }
    // 生产环境下，尝试将其修正为相对于当前 BackendUrl 的地址
    if (BackendUrl && BackendUrl.startsWith('http')) {
      const backendOrigin = new URL(BackendUrl).origin;
      return url.replace(parsed.origin, backendOrigin);
    }
    // 如果 BackendUrl 未配置或为相对路径，则退而求其次使用 pathname 尝试同源加载
    return parsed.pathname;
  } catch {
    return url;
  }
}

function TextureManageDialog({ open, onClose, token, onUpdated }: TextureManageDialogProps) {
  const { t } = useTranslation();
  const [skinCurrentUrl, setSkinCurrentUrl] = useState<string | null>(null);
  const [capeCurrentUrl, setCapeCurrentUrl] = useState<string | null>(null);
  const [skinLocalPreview, setSkinLocalPreview] = useState<string | null>(null);
  const [capeLocalPreview, setCapeLocalPreview] = useState<string | null>(null);
  const [skinFile, setSkinFile] = useState<File | null>(null);
  const [capeFile, setCapeFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<TextureType | null>(null);
  const [deleting, setDeleting] = useState<TextureType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ type: TextureType; action: 'upload' | 'delete' } | null>(null);
  const [confirmDeleteType, setConfirmDeleteType] = useState<TextureType | null>(null);

  const skinFileInputRef = useRef<HTMLInputElement>(null);
  const capeFileInputRef = useRef<HTMLInputElement>(null);

  const fetchTextures = async () => {
    try {
      const response = await request(`${BackendUrl}/texture/get`, {
        method: 'POST',
      });

      if (response.success && response.data && response.data.textures) {
        const skinTexture = response.data.textures.find((t: TextureInfo) => t.texture_type === 'skin');
        const capeTexture = response.data.textures.find((t: TextureInfo) => t.texture_type === 'cape');
        setSkinCurrentUrl(skinTexture?.url ? `${normalizeTextureUrl(skinTexture.url)}?${Date.now()}` : null);
        setCapeCurrentUrl(capeTexture?.url ? `${normalizeTextureUrl(capeTexture.url)}?${Date.now()}` : null);
      } else {
        setSkinCurrentUrl(null);
        setCapeCurrentUrl(null);
      }
    } catch {
      setSkinCurrentUrl(null);
      setCapeCurrentUrl(null);
    }
  };

  useEffect(() => {
    if (!open) {
      setSkinLocalPreview(null);
      setCapeLocalPreview(null);
      setSkinFile(null);
      setCapeFile(null);
      setError(null);
      setSuccess(null);
      setConfirmDeleteType(null);
      if (skinFileInputRef.current) skinFileInputRef.current.value = '';
      if (capeFileInputRef.current) capeFileInputRef.current.value = '';
      return;
    }
    fetchTextures();
  }, [open, token]);

  const handleFileSelect = (
    event: ChangeEvent<HTMLInputElement>,
    type: TextureType
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/png')) {
      setError(t('profile.textureDialog.errors.pngOnly'));
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError(t('profile.textureDialog.errors.tooLarge'));
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      if (img.width > 8192 || img.height > 8192) {
        setError(t('profile.textureDialog.errors.tooWide'));
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (type === 'skin') {
          setSkinLocalPreview(dataUrl);
          setSkinFile(file);
        } else {
          setCapeLocalPreview(dataUrl);
          setCapeFile(file);
        }
        setError(null);
      };
      reader.readAsDataURL(file);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setError(t('profile.textureDialog.errors.pngOnly'));
    };
    img.src = objectUrl;
  };

  const handleUpload = async (type: TextureType) => {
    const file = type === 'skin' ? skinFile : capeFile;
    if (!file) {
      setError(t('profile.textureDialog.errors.selectFile', { type: t(type === 'skin' ? 'profile.textureDialog.skin' : 'profile.textureDialog.cape') }));
      return;
    }

    setUploading(type);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('texture_type', type);
      formData.append('file', file);

      const response = await request(`${BackendUrl}/texture/upload`, {
        method: 'POST',
        body: formData,
      });

      if (response.success) {
        setSuccess({ type, action: 'upload' });
        if (type === 'skin') {
          setSkinFile(null);
          setSkinLocalPreview(null);
          if (skinFileInputRef.current) skinFileInputRef.current.value = '';
        } else {
          setCapeFile(null);
          setCapeLocalPreview(null);
          if (capeFileInputRef.current) capeFileInputRef.current.value = '';
        }
        await fetchTextures();
        onUpdated?.();
      } else {
        setError(response.message || t('profile.textureDialog.errors.uploadFailed'));
      }
    } catch {
      setError(t('common.serverError'));
    } finally {
      setUploading(null);
    }
  };

  const handleDelete = async (type: TextureType) => {
    setDeleting(type);
    setError(null);

    try {
      const response = await request(`${BackendUrl}/texture/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texture_type: type,
        }),
      });

      if (response.success) {
        setSuccess({ type, action: 'delete' });
        if (type === 'skin') {
          setSkinCurrentUrl(null);
        } else {
          setCapeCurrentUrl(null);
        }
        onUpdated?.();
      } else {
        setError(response.message || t('profile.textureDialog.errors.deleteFailed'));
      }
    } catch {
      setError(t('common.serverError'));
    } finally {
      setDeleting(null);
      setConfirmDeleteType(null);
    }
  };

  const skinPreviewUrl = skinLocalPreview || skinCurrentUrl;
  const capePreviewUrl = capeLocalPreview || capeCurrentUrl;
  const hasPreview = !!skinPreviewUrl || !!capePreviewUrl;
  const isLoading = uploading !== null || deleting !== null;

  const renderUploadSection = (type: TextureType) => {
    const label = t(type === 'skin' ? 'profile.textureDialog.skin' : 'profile.textureDialog.cape');
    const file = type === 'skin' ? skinFile : capeFile;
    const currentUrl = type === 'skin' ? skinCurrentUrl : capeCurrentUrl;
    const fileInputRef = type === 'skin' ? skinFileInputRef : capeFileInputRef;
    const isUploading = uploading === type;
    const isDeleting = deleting === type;

    return (
      <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
        <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 600 }}>
          {label}
        </Typography>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png"
          onChange={(e) => handleFileSelect(e, type)}
          style={{ display: 'none' }}
          id={`${type}-upload`}
        />
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1}>
            <label htmlFor={`${type}-upload`} style={{ flex: 1 }}>
              <Button
                variant="outlined"
                component="span"
                startIcon={<CloudUpload />}
                fullWidth
                disabled={isLoading}
              >
                {t('profile.textureDialog.chooseFile')}
              </Button>
            </label>
            {file && (
              <Button
                variant="contained"
                onClick={() => handleUpload(type)}
                disabled={isLoading}
                sx={{ minWidth: 100 }}
              >
                {isUploading ? t('profile.textureDialog.uploading') : t('profile.textureDialog.upload')}
              </Button>
            )}
          </Stack>
          {currentUrl && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<Delete />}
              onClick={() => setConfirmDeleteType(type)}
              disabled={isLoading}
            >
              {isDeleting ? t('profile.textureDialog.deleting') : t('profile.textureDialog.delete') + ' ' + label}
            </Button>
          )}
          {file && (
            <Typography variant="caption" color="text.secondary">
              {t('profile.textureDialog.selected', { name: file.name })}
            </Typography>
          )}
        </Stack>
      </Box>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{t('profile.textureDialog.title')}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {success && !confirmDeleteType && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {t(success.action === 'upload' ? 'profile.textureDialog.uploadedSuccess' : 'profile.textureDialog.deletedSuccess', {
              type: t(success.type === 'skin' ? 'profile.textureDialog.skin' : 'profile.textureDialog.cape'),
            })}
          </Alert>
        )}

        {confirmDeleteType ? (
          <Box sx={{ mt: 2 }}>
            <Alert severity="warning" sx={{ mb: 2 }}>
              {t('profile.textureDialog.deleteConfirm', {
                type: t(confirmDeleteType === 'skin' ? 'profile.textureDialog.skin' : 'profile.textureDialog.cape'),
              })}
            </Alert>
            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button onClick={() => setConfirmDeleteType(null)} disabled={isLoading}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={() => handleDelete(confirmDeleteType)}
                disabled={isLoading}
              >
                {deleting ? t('profile.textureDialog.deleting') : t('common.confirm') + t('common.delete')}
              </Button>
            </Stack>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 4, mt: 2, flexDirection: { xs: 'column', md: 'row' } }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {t('profile.textureDialog.preview')}
              </Typography>
              {hasPreview ? (
                <Box sx={{ position: 'relative', width: 200, height: 400, margin: '0 auto' }}>
                  <Suspense fallback={<CircularProgress sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />}>
                    <SkinViewer3D
                      skinUrl={skinPreviewUrl}
                      capeUrl={capePreviewUrl}
                      width={200}
                      height={400}
                    />
                  </Suspense>
                </Box>
              ) : (
                <Box sx={{
                  width: 200,
                  height: 400,
                  margin: '0 auto',
                  backgroundColor: '#e0e0e0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 1,
                }}>
                  <Photo sx={{ width: 48, height: 48, color: '#999' }} />
                </Box>
              )}
            </Box>
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {renderUploadSection('skin')}
              {renderUploadSection('cape')}
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('profile.textureDialog.close')}</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function Profile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [email2faEnabled, setEmail2faEnabled] = useState(false);
  const [email2faLoading, setEmail2faLoading] = useState(false);

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

  const [textureDialogOpen, setTextureDialogOpen] = useState(false);
  const [skinUrl, setSkinUrl] = useState<string | null>(null);
  const [capeUrl, setCapeUrl] = useState<string | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletePasswordError, setDeletePasswordError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const webauthnClientSupported = typeof window !== 'undefined' && window.isSecureContext && isWebAuthnSupported();
  const webauthnSudoAvailable = webauthnClientSupported && webauthnCredentials.length > 0;

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

  const fetchTextures = async () => {
    // 优先使用缓存
    const cachedTextures = dataCache.getTextures();
    if (cachedTextures) {
      const skinTexture = cachedTextures.find(
        (t: TextureInfo) => t.texture_type === 'skin'
      );
      const capeTexture = cachedTextures.find(
        (t: TextureInfo) => t.texture_type === 'cape'
      );
      const cacheBust = Date.now();
      setSkinUrl(skinTexture?.url ? `${normalizeTextureUrl(skinTexture.url)}?${cacheBust}` : null);
      setCapeUrl(capeTexture?.url ? `${normalizeTextureUrl(capeTexture.url)}?${cacheBust}` : null);
      return;
    }

    try {
      const response = await request(`${BackendUrl}/texture/get`, {
        method: 'POST',
      });

      if (response.success && response.data && Array.isArray(response.data.textures)) {
        dataCache.setTextures(response.data.textures);
        const skinTexture = response.data.textures.find(
          (t: TextureInfo) => t.texture_type === 'skin'
        );
        const capeTexture = response.data.textures.find(
          (t: TextureInfo) => t.texture_type === 'cape'
        );
        const cacheBust = Date.now();
        setSkinUrl(skinTexture?.url ? `${normalizeTextureUrl(skinTexture.url)}?${cacheBust}` : null);
        setCapeUrl(capeTexture?.url ? `${normalizeTextureUrl(capeTexture.url)}?${cacheBust}` : null);
        return;
      }
      setSkinUrl(null);
      setCapeUrl(null);
    } catch {
      setSkinUrl(null);
      setCapeUrl(null);
    }
  };

  useEffect(() => {
    fetchTextures();
  }, []);

  const parseEnabledFlag = (value: unknown): boolean | undefined => {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    return undefined;
  };

  const readRecoveryKeyEnabledFromValue = (value: unknown): boolean | undefined => {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    const record = value as {
      recovery_key_enabled?: boolean | number;
      data?: {
        recovery_key_enabled?: boolean | number;
      };
    };

    return parseEnabledFlag(record.data?.recovery_key_enabled ?? record.recovery_key_enabled);
  };

  const readWebAuthnEnabledFromValue = (value: unknown): boolean | undefined => {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    const record = value as {
      enabled?: boolean | number;
      webauthn_2fa_enabled?: boolean | number;
      data?: {
        enabled?: boolean | number;
        webauthn_2fa_enabled?: boolean | number;
      };
    };

    return parseEnabledFlag(
      record.data?.webauthn_2fa_enabled
      ?? record.data?.enabled
      ?? record.webauthn_2fa_enabled
      ?? record.enabled
    );
  };

  const readWebAuthnAvailabilityFromValue = (value: unknown): boolean | undefined => {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    const record = value as {
      available?: boolean;
      data?: {
        available?: boolean;
      };
    };

    if (typeof record.data?.available === 'boolean') {
      return record.data.available;
    }
    if (typeof record.available === 'boolean') {
      return record.available;
    }

    return undefined;
  };

  const normalizeWebAuthnCredentials = (value: unknown): WebAuthnCredentialRecord[] => {
    const records = Array.isArray(value)
      ? value
      : value && typeof value === 'object' && Array.isArray((value as { credentials?: unknown[] }).credentials)
        ? (value as { credentials: unknown[] }).credentials
        : [];

    const normalized: WebAuthnCredentialRecord[] = [];

    records.forEach((item) => {
      if (!item || typeof item !== 'object') {
        return;
      }

      const record = item as Record<string, unknown>;
      const id = typeof record.id === 'number' ? record.id : Number(record.id);
      if (!Number.isFinite(id) || id <= 0) {
        return;
      }

      normalized.push({
        id,
        name: typeof record.name === 'string' ? record.name : undefined,
        created_at: typeof record.created_at === 'string' ? record.created_at : undefined,
        updated_at: typeof record.updated_at === 'string' ? record.updated_at : undefined,
        last_used_at: typeof record.last_used_at === 'string' || record.last_used_at === null
          ? record.last_used_at as string | null
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
      // #region debug-point A:refresh-two-factor-response
      reportProfile2faDebug('A', 'Profile.tsx:refreshTwoFactorStatus:response', 'Received two-factor status response', {
        uid: uid ?? null,
        success: resp.success,
        code: resp.code ?? null,
        message: resp.message,
        hasData: Boolean(resp.data),
        data: resp.data ?? null,
      });
      // #endregion
      if (resp.success && resp.data) {
        const {
          totp_enabled,
          webauthn_2fa_enabled,
          recovery_key_enabled,
          email_2fa_enabled,
        } = resp.data;

        // #region debug-point B:refresh-two-factor-apply
        reportProfile2faDebug('B', 'Profile.tsx:refreshTwoFactorStatus:apply', 'Applying two-factor status into React state', {
          totp_enabled,
          webauthn_2fa_enabled,
          recovery_key_enabled,
          email_2fa_enabled,
        });
        // #endregion
        setTotpEnabled(totp_enabled);
        setWebauthn2faEnabled(webauthn_2fa_enabled);
        setRecoveryKeyEnabled(recovery_key_enabled);
        setEmail2faEnabled(email_2fa_enabled);

        setUserInfo((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            totp_enabled,
            webauthn_2fa_enabled,
            recovery_key_enabled,
            email_2fa_enabled,
          };
        });
        return resp.data;
      }
    } catch (e) {
      console.error('Failed to refresh 2FA status', e);
    }
    return null;
  };

  const refreshWebAuthnStatus = async (fallbackEnabled?: boolean) => {
    // #region debug-point D:refresh-webauthn-status-start
    reportWebAuthnDebug('D', 'Profile.tsx:refreshWebAuthnStatus:start', 'Refreshing WebAuthn status', {
      fallbackEnabled: fallbackEnabled ?? null,
    });
    // #endregion
    try {
      const resp = await listWebAuthnCredentials();
      // #region debug-point D:refresh-webauthn-status-response
      reportWebAuthnDebug('D', 'Profile.tsx:refreshWebAuthnStatus:response', 'Received WebAuthn credential list response', {
        success: resp.success,
        code: resp.code ?? null,
        message: resp.message,
        hasData: Boolean(resp.data),
        dataType: Array.isArray(resp.data) ? 'array' : typeof resp.data,
      });
      // #endregion
      if (resp.success) {
        applyWebAuthnState(resp.data, fallbackEnabled);
      } else {
        applyWebAuthnState([], fallbackEnabled);
      }
    } catch {
      // #region debug-point D:refresh-webauthn-status-error
      reportWebAuthnDebug('D', 'Profile.tsx:refreshWebAuthnStatus:error', 'Refreshing WebAuthn status threw an exception');
      // #endregion
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

      // 1. 先尝试从缓存初始化 UI
      const cachedUser = dataCache.getUser();
      const cachedTwoFactor = dataCache.getTwoFactorStatus();
      const cachedCreds = dataCache.getWebauthnCredentials();

      if (cachedUser) {
        const totpEnabledFromCache = cachedTwoFactor?.totp_enabled ?? getTotpEnabled() ?? false;
        const webauthnEnabledFromCache = cachedTwoFactor?.webauthn_2fa_enabled ?? readWebAuthnEnabledFromValue(cachedUser) ?? false;
        const recoveryKeyEnabledFromCache = cachedTwoFactor?.recovery_key_enabled ?? readRecoveryKeyEnabledFromValue(cachedUser) ?? false;
        const email2faEnabledFromCache = cachedTwoFactor?.email_2fa_enabled ?? false;

        // #region debug-point C:cached-two-factor-hydration
        reportProfile2faDebug('C', 'Profile.tsx:fetchData:cacheHydration', 'Hydrating profile from cached data', {
          cachedUserUid: cachedUser.uid ?? null,
          hasCachedTwoFactor: Boolean(cachedTwoFactor),
          cachedTwoFactor: cachedTwoFactor ?? null,
          totpEnabledFromCache,
          webauthnEnabledFromCache,
          recoveryKeyEnabledFromCache,
          email2faEnabledFromCache,
          cachedCredentialCount: Array.isArray(cachedCreds)
            ? cachedCreds.length
            : cachedCreds && typeof cachedCreds === 'object' && Array.isArray((cachedCreds as { credentials?: unknown[] }).credentials)
              ? (cachedCreds as { credentials: unknown[] }).credentials.length
              : null,
        });
        // #endregion
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

      // 2. 后台并行刷新所有数据
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
          
          // 如果 refreshTwoFactorStatus 成功，twoFactorData 将包含最新数据
          // 如果失败（null），我们使用兜底逻辑
          const currentTwoFactor = twoFactorData || {
            totp_enabled: getTotpEnabled() ?? false,
            webauthn_2fa_enabled: readWebAuthnEnabledFromValue(userResp.data) ?? false,
            recovery_key_enabled: readRecoveryKeyEnabledFromValue(userResp.data) ?? false,
            email_2fa_enabled: false,
            webauthn_credentials: 0,
          };

          // #region debug-point B:fetch-data-final-state
          reportProfile2faDebug('B', 'Profile.tsx:fetchData:finalState', 'Composed final two-factor state for profile UI', {
            userUid: userResp.data.uid ?? null,
            twoFactorSource: twoFactorData ? 'api' : 'fallback',
            twoFactorData: twoFactorData ?? null,
            fallbackRecoveryKeyEnabled: readRecoveryKeyEnabledFromValue(userResp.data) ?? null,
            finalState: currentTwoFactor,
          });
          // #endregion
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

          // 同步更新独立状态
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
        if (!cachedUser) {
          setError(t('common.serverError'));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [t]);

  useEffect(() => {
    // #region debug-point B:rendered-two-factor-state
    reportProfile2faDebug('B', 'Profile.tsx:stateObserver', 'Observed rendered two-factor state', {
      userInfoRecoveryKeyEnabled: userInfo?.recovery_key_enabled ?? null,
      recoveryKeyEnabled,
      email2faEnabled,
      webauthn2faEnabled,
      totpEnabled: userInfo?.totp_enabled ?? null,
    });
    // #endregion
  }, [userInfo?.recovery_key_enabled, userInfo?.totp_enabled, recoveryKeyEnabled, email2faEnabled, webauthn2faEnabled]);

  const handleSaveUsername = async () => {
    if (!newUsername.trim()) {
      setSaveError(t('profile.usernameEmpty'));
      return;
    }

    if (newUsername.length < 3 || newUsername.length > 16) {
      setSaveError(t('profile.usernameLength'));
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
      setSaveError(t('profile.usernameInvalid'));
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const resp = await request(`${BackendUrl}/change-username`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: newUsername }),
      });

      if (resp.success) {
        const updatedUsername = resp.data?.username || newUsername;
        setUserInfo(prev => prev ? { ...prev, username: updatedUsername } : null);
        setSaveSuccess(true);
        setEditMode(false);
        setNewUsername('');
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setSaveError(resp.message || t('profile.saveFailed'));
      }
    } catch {
      setSaveError(t('common.serverError'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setNewUsername('');
    setSaveError(null);
    setSaveSuccess(false);
  };

  const handleToggleEmail2fa = async (enabled: boolean) => {
    setEmail2faLoading(true);
    setTwoFactorFeedback(null);

    try {
      const resp = await toggleEmail2fa(enabled);
      if (resp.success) {
        const uid = getUid();
        await refreshTwoFactorStatus(uid || undefined);
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
      setTwoFactorFeedback({
        severity: 'error',
        message: t('common.serverError'),
      });
    } finally {
      setEmail2faLoading(false);
    }
  };

  const closeRecoveryKeyDialog = () => {
    if (recoveryKeyLoading || recoveryKeySendingEmailCode) {
      return;
    }

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
        if (resp.code === 'recovery_key_already_configured') {
          await refreshTwoFactorStatus();
        }
        setTwoFactorFeedback({
          severity: 'error',
          message: resp.message || t('profile.recoveryKeyCreateFailed'),
        });
      }
    } catch {
      setTwoFactorFeedback({
        severity: 'error',
        message: t('common.serverError'),
      });
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
    if (changeEmailLoading) {
      return;
    }

    setChangeEmailMethodDialogOpen(false);
    setChangeEmailDialogOpen(false);
  };

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

    if (selectedRecoveryKeyMethod === 'webauthn') {
      return buildRecoveryKeyPayload('webauthn');
    }

    setRecoveryKeyDialogError(t('profile.recoveryKeyFactorRequired'));
    return null;
  };

  const selectRecoveryKeyMethod = async (method: VerificationMethodKey) => {
    setSelectedRecoveryKeyMethod(method);
    setRecoveryKeyDialogError(null);

    if (method === 'email' && !recoveryKeyEmailCodeSent) {
      await handleSendRecoveryKeyEmailCode();
    }
  };

  const selectChangeEmailMethod = async (method: VerificationMethodKey) => {
    setSelectedChangeEmailMethod(method);
    setChangeEmailError(null);

    if (method === 'email' && !changeEmailCodeSent) {
      await handleSendChangeEmailCode();
    }
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
        setTwoFactorFeedback({
          severity: 'success',
          message: t('profile.recoveryKeyRegenerated'),
        });
      } else {
        if (resp.code === 'recovery_key_not_configured') {
          await refreshTwoFactorStatus();
        }
        setRecoveryKeyDialogError(resp.message || t('profile.recoveryKeyRegenerateFailed'));
      }
      return;
    }

    const resp = await revokeRecoveryKey(payload);
    if (resp.success) {
      await refreshTwoFactorStatus();
      closeRecoveryKeyDialog();
      setTwoFactorFeedback({
        severity: 'success',
        message: t('profile.recoveryKeyRevoked'),
      });
    } else {
      if (resp.code === 'recovery_key_not_configured') {
        await refreshTwoFactorStatus();
      }
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
      const resp = await sendChangeEmailCode();
      if (!resp.success) {
        setRecoveryKeyDialogError(resp.message || t('profile.recoveryKeySendEmailCodeFailed'));
        return;
      }

      setRecoveryKeyEmailCodeSent(true);
      setTwoFactorFeedback({
        severity: 'success',
        message: t('profile.recoveryKeyEmailCodeSent'),
      });
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

  const handleSendChangeEmailCode = async () => {
    setSendingEmailCode(true);
    setChangeEmailError(null);
    try {
      const resp = await sendChangeEmailCode();
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
        const resp = await changeEmail(params);
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

    let params: {
      new_email: string;
      email_code?: string;
      totp_code?: string;
      recovery_key?: string;
    } | null = null;

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
      const resp = await changeEmail(params);
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
    const token = getAuthToken();

    if (!email || !token) {
      setTwoFactorFeedback({
        severity: 'error',
        message: t('profile.notLoggedInError'),
      });
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
      const nextTotpKey = resp.data?.totpkey ?? (resp as typeof resp & { totpkey?: string }).totpkey;

      if (resp.success && nextTotpKey) {
        setTotpKey(nextTotpKey);
        setTotpDialogOpen(true);
      } else {
        setTwoFactorFeedback({
          severity: 'error',
          message: resp.message || t('profile.totpSetupFailed'),
        });
      }
    } catch {
      setTwoFactorFeedback({
        severity: 'error',
        message: t('common.serverError'),
      });
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
    const token = getAuthToken();

    if (!email || !token) {
      setTwoFactorFeedback({
        severity: 'error',
        message: t('profile.notLoggedInError'),
      });
      return;
    }

    setTotpLoading(true);
    setTwoFactorFeedback(null);

    try {
      const resp = await toggleTotp(true);
      if (resp.success) {
        await refreshTwoFactorStatus();
        setTwoFactorFeedback({
          severity: 'success',
          message: t('profile.totpEnabledSuccess'),
        });
        return;
      }

      if (resp.code === 'totp_not_configured') {
        await handleOpenTotpDialog();
        return;
      }

      setTwoFactorFeedback({
        severity: 'error',
        message: resp.message || t('profile.totpToggleFailed'),
      });
    } catch {
      setTwoFactorFeedback({
        severity: 'error',
        message: t('common.serverError'),
      });
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
        setTwoFactorFeedback({
          severity: 'success',
          message: t('profile.totpDisabledSuccess'),
        });
      } else {
        setTwoFactorFeedback({
          severity: 'error',
          message: resp.message || t('profile.totpToggleFailed'),
        });
      }
    } catch {
      setTwoFactorFeedback({
        severity: 'error',
        message: t('common.serverError'),
      });
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
        setTwoFactorFeedback({
          severity: 'success',
          message: t('profile.totpEnabledSuccess'),
        });
        setTimeout(() => {
          handleCloseTotpDialog();
        }, 1500);
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

  const mapWebAuthnError = (message?: string, code?: string, context: 'register' | 'toggle' | 'delete' | 'generic' = 'generic') => {
    if (code === 'oauth_login_required') {
      return t('profile.notLoggedInError');
    }
    if (code === 'webauthn_verification_failed') {
      return t('profile.webauthnRegisterFailed');
    }
    if (code === 'webauthn_credential_not_found') {
      return t('profile.webauthnCredentialDeleteFailed');
    }
    if (code === 'webauthn_not_configured') {
      return context === 'register'
        ? t('profile.webauthnBackendNotConfigured')
        : t('profile.webauthnSecondFactorDisabledHint');
    }
    return message || t('profile.webauthnOperationFailed');
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) {
      return t('profile.webauthnNeverUsed');
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString();
  };

  const getWebAuthnAvailabilityError = () => {
    if (typeof window === 'undefined' || !window.isSecureContext) {
      return t('profile.webauthnSecureContextRequired');
    }

    if (!isWebAuthnSupported()) {
      return t('profile.webauthnUnsupported');
    }

    if (!webauthnBackendAvailable) {
      return t('profile.webauthnBackendNotConfigured');
    }

    return null;
  };

  const handleOpenWebAuthnDialog = () => {
    // #region debug-point C:open-dialog
    reportWebAuthnDebug('C', 'Profile.tsx:handleOpenWebAuthnDialog', 'Opened WebAuthn dialog', {
      credentialCount: webauthnCredentials.length,
      webauthn2faEnabled,
    });
    // #endregion
    setWebauthnDialogOpen(true);
    setWebauthnName('');
    setWebauthnNameError(null);
    setPendingWebAuthnRegistration(null);
  };

  const handleCloseWebAuthnDialog = () => {
    if (webauthnLoading) {
      return;
    }
    setWebauthnDialogOpen(false);
    setWebauthnName('');
    setWebauthnNameError(null);
    setPendingWebAuthnRegistration(null);
  };

  const handleRegisterWebAuthn = async () => {
    const trimmedName = webauthnName.trim();
    // #region debug-point A:register-click
    reportWebAuthnDebug('A', 'Profile.tsx:handleRegisterWebAuthn:click', 'Clicked WebAuthn registration action', {
      hasPendingRegistration: Boolean(pendingWebAuthnRegistration),
      nameLength: trimmedName.length,
      isSecureContext: typeof window !== 'undefined' ? window.isSecureContext : false,
      webauthnSupported: isWebAuthnSupported(),
    });
    // #endregion
    if (trimmedName.length > 64) {
      setWebauthnNameError(t('profile.webauthnNameTooLong'));
      return;
    }

    const availabilityError = getWebAuthnAvailabilityError();
    if (availabilityError) {
      setWebauthnFeedback({
        severity: 'error',
        message: availabilityError,
      });
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

        // #region debug-point A:register-begin-response
        reportWebAuthnDebug('A', 'Profile.tsx:handleRegisterWebAuthn:beginResp', 'Received WebAuthn register begin response', {
          success: beginResp.success,
          code: beginResp.code ?? null,
          message: beginResp.message,
          hasData: Boolean(beginResp.data),
          hasFlowId: Boolean(flowId),
          hasOptions: Boolean(options),
          dataKeys: beginResp.data ? Object.keys(beginResp.data) : [],
        });
        // #endregion

        if (!beginResp.success || !flowId || !options) {
          if (beginResp.code === 'webauthn_not_configured') {
            setWebauthnBackendAvailable(false);
          }
          setWebauthnFeedback({
            severity: 'error',
            message: mapWebAuthnError(beginResp.message, beginResp.code, 'register'),
          });
          return;
        }

        setPendingWebAuthnRegistration({ flowId, options });
        // #region debug-point B:pending-registration-set
        reportWebAuthnDebug('B', 'Profile.tsx:handleRegisterWebAuthn:setPending', 'Stored pending WebAuthn registration', {
          flowIdLength: flowId.length,
          optionKeys: Object.keys(options),
        });
        // #endregion
        setWebauthnFeedback({
          severity: 'success',
          message: t('profile.webauthnReadyForPrompt'),
        });
        return;
      }

      // #region debug-point B:before-credentials-create
      reportWebAuthnDebug('B', 'Profile.tsx:handleRegisterWebAuthn:beforeCreate', 'About to invoke navigator.credentials.create', {
        flowIdLength: pendingWebAuthnRegistration.flowId.length,
        optionKeys: Object.keys(pendingWebAuthnRegistration.options),
      });
      // #endregion
      const credential = await registerWithWebAuthn(pendingWebAuthnRegistration.options);
      const finishResp = await finishWebAuthnRegistration(pendingWebAuthnRegistration.flowId, credential);

      // #region debug-point B:register-finish-response
      reportWebAuthnDebug('B', 'Profile.tsx:handleRegisterWebAuthn:finishResp', 'Received WebAuthn register finish response', {
        success: finishResp.success,
        code: finishResp.code ?? null,
        message: finishResp.message,
      });
      // #endregion

      if (!finishResp.success) {
        if (finishResp.code === 'webauthn_not_configured') {
          setWebauthnBackendAvailable(false);
        }
        setWebauthnFeedback({
          severity: 'error',
          message: mapWebAuthnError(finishResp.message, finishResp.code, 'register'),
        });
        return;
      }

      await Promise.all([
        refreshTwoFactorStatus(),
        refreshWebAuthnStatus(),
      ]);
      setWebauthnDialogOpen(false);
      setWebauthnName('');
      setPendingWebAuthnRegistration(null);
      setWebauthnFeedback({
        severity: 'success',
        message: t('profile.webauthnRegisterSuccess'),
      });
    } catch (err) {
      let message = t('profile.webauthnRegisterFailed');
      if (err instanceof DOMException && err.name === 'SecurityError') {
        message = t('profile.webauthnSecurityError');
      } else if (err instanceof DOMException && err.name === 'NotAllowedError') {
        message = t('profile.webauthnNotAllowedError');
      } else if (err instanceof Error && err.message === 'WebAuthn is not supported in this browser') {
        message = t('profile.webauthnUnsupported');
      } else if (err instanceof Error) {
        message = err.message;
      }

      setWebauthnFeedback({
        severity: 'error',
        message,
      });
      // #region debug-point B:register-catch
      reportWebAuthnDebug('B', 'Profile.tsx:handleRegisterWebAuthn:catch', 'WebAuthn registration action threw an exception', {
        errorName: err instanceof Error ? err.name : null,
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      // #endregion
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
        setWebauthnFeedback({
          severity: 'error',
          message: mapWebAuthnError(resp.message, resp.code, 'toggle'),
        });
        return;
      }

      await refreshTwoFactorStatus();
      setWebauthnFeedback({
        severity: 'success',
        message: enabled ? t('profile.webauthnSecondFactorEnabled') : t('profile.webauthnSecondFactorDisabled'),
      });
    } catch {
      setWebauthnFeedback({
        severity: 'error',
        message: t('profile.webauthnOperationFailed'),
      });
    } finally {
      setWebauthnLoading(false);
    }
  };

  const handleDeleteWebAuthnCredential = async () => {
    if (!credentialToDelete) {
      return;
    }

    setWebauthnLoading(true);
    setWebauthnFeedback(null);

    try {
      const resp = await deleteWebAuthnCredential(credentialToDelete.id);
      if (!resp.success) {
        setWebauthnFeedback({
          severity: 'error',
          message: mapWebAuthnError(resp.message, resp.code, 'delete'),
        });
        return;
      }

      await Promise.all([
        refreshTwoFactorStatus(),
        refreshWebAuthnStatus(),
      ]);
      setCredentialToDelete(null);
      setWebauthnFeedback({
        severity: 'success',
        message: t('profile.webauthnCredentialDeleteSuccess'),
      });
    } catch {
      setWebauthnFeedback({
        severity: 'error',
        message: t('profile.webauthnCredentialDeleteFailed'),
      });
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
    if (deleteLoading) {
      return;
    }
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

  if (error) {
    return (
      <Alert severity="error">
        {error}
        <Box sx={{ mt: 1 }}>
          <Link component={RouterLink} to="/verifyemail" color="primary">
            {t('profile.verifyEmailNow')}
          </Link>
        </Box>
      </Alert>
    );
  }

  if (!userInfo) {
    return null;
  }

  const userInitial = userInfo.username ? userInfo.username.charAt(0).toUpperCase() : 'U';
  const webauthnAvailabilityError = getWebAuthnAvailabilityError();
  const webauthnRegistrationReady = !webauthnAvailabilityError;
  const webauthnCredentialSummary = webauthnCredentials.length > 0
    ? t('profile.webauthnCredentialCount', { count: webauthnCredentials.length })
    : t('profile.webauthnNotRegistered');
  const webauthnPrimaryActionLabel = webauthnCredentials.length > 0
    ? t('profile.webauthnManage')
    : t('profile.webauthnRegister');

  return (
    <Box>
      {!userInfo.verified && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('profile.notVerifiedWarning')}
          <Box sx={{ mt: 1 }}>
            <Link component={RouterLink} to="/verifyemail" color="primary">
              {t('profile.verifyEmailNow')}
            </Link>
          </Box>
        </Alert>
      )}

      <Card sx={{ maxWidth: 500, mt: 2 }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          {userInfo.avatar ? (
            <Avatar
              src={userInfo.avatar}
              alt={userInfo.username}
              sx={{ width: 80, height: 80 }}
            />
          ) : (
            <Avatar sx={{ width: 80, height: 80, bgcolor: 'secondary.main', fontSize: '2rem' }}>
              {userInitial}
            </Avatar>
          )}

          <Box sx={{ flex: 1 }}>
            {editMode ? (
              <Box sx={{ mb: 2 }}>
                <TextField
                  label={t('profile.newUsernameLabel')}
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder={t('profile.newUsernamePlaceholder')}
                  fullWidth
                  margin="dense"
                  error={!!saveError}
                  helperText={saveError}
                />
                <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                  <Button
                    variant="contained"
                    startIcon={<Save />}
                    onClick={handleSaveUsername}
                    disabled={saving}
                  >
                    {saving ? t('profile.saving') : t('profile.save')}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={handleCancelEdit}
                    disabled={saving}
                  >
                    {t('profile.cancel')}
                  </Button>
                </Stack>
              </Box>
            ) : (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="h5" gutterBottom>
                    {userInfo.username}
                  </Typography>
                  <Button
                    startIcon={<Edit />}
                    onClick={() => setEditMode(true)}
                    size="small"
                    color="primary"
                  >
                    {t('profile.edit')}
                  </Button>
                </Box>
                {saveSuccess && (
                  <Alert severity="success" sx={{ mt: 1, mb: 2 }}>
                    {t('profile.saveSuccess')}
                  </Alert>
                )}
              </>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body1" color="text.secondary">
                {userInfo.email}
              </Typography>
              <Button
                startIcon={<Edit />}
                onClick={openChangeEmailDialog}
                size="small"
                color="primary"
              >
                {t('profile.edit')}
              </Button>
            </Box>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Chip
                icon={userInfo.verified ? <CheckCircle /> : <Warning />}
                label={userInfo.verified ? t('profile.emailVerified') : t('profile.emailNotVerified')}
                color={userInfo.verified ? 'success' : 'warning'}
                size="small"
                variant="outlined"
              />
            </Stack>
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ maxWidth: 500, mt: 2 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Box>
              <Typography variant="h6" gutterBottom>
                {t('profile.skinCapeTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('profile.skinCapeSubtitle')}
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<CloudUpload />}
              onClick={() => setTextureDialogOpen(true)}
            >
              {t('profile.manage')}
            </Button>
          </Stack>
          <Box sx={{
            width: '100%',
            height: 360,
            backgroundColor: 'grey.100',
            borderRadius: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}>
            {skinUrl || capeUrl ? (
              <Suspense fallback={<CircularProgress />}>
                <SkinViewer3D
                  skinUrl={skinUrl}
                  capeUrl={capeUrl}
                  width={200}
                  height={360}
                />
              </Suspense>
            ) : (
              <Stack alignItems="center" spacing={1}>
                <Photo sx={{ width: 48, height: 48, color: 'grey.500' }} />
                <Typography variant="body2" color="text.secondary">
                  {t('profile.noSkinOrCape')}
                </Typography>
              </Stack>
            )}
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ maxWidth: 500, mt: 2 }}>
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
                    {userInfo.totp_enabled
                      ? t('profile.totpEnabled')
                      : t('profile.totpDisabled')
                    }
                  </Typography>
                </Box>
                {userInfo.totp_enabled ? (
                  <Stack direction="column" spacing={1} alignItems="flex-end">
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Key />}
                      onClick={handleOpenTotpDialog}
                      disabled={totpLoading}
                    >
                      {totpLoading ? t('profile.totpLoading') : t('profile.totpReset')}
                    </Button>
                    <Button
                      color="warning"
                      variant="text"
                      size="small"
                      onClick={() => setDisableTotpDialogOpen(true)}
                      disabled={totpLoading}
                    >
                      {t('profile.totpDisable')}
                    </Button>
                  </Stack>
                ) : (
                  <Button
                    variant="contained"
                    startIcon={<Key />}
                    onClick={handleEnableTotp}
                    disabled={totpLoading}
                  >
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
                  control={(
                    <Switch
                      size="small"
                      checked={email2faEnabled}
                      onChange={(e) => handleToggleEmail2fa(e.target.checked)}
                      disabled={email2faLoading}
                    />
                  )}
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
                    {recoveryKeyEnabled
                      ? t('profile.recoveryKeyEnabled')
                      : t('profile.recoveryKeyDisabled')
                    }
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                    {t('profile.recoveryKeyHint')}
                  </Typography>
                </Box>
                {recoveryKeyEnabled ? (
                  <Stack direction="column" spacing={1} alignItems="flex-end">
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Key />}
                      onClick={() => openRecoveryKeyVerificationDialog('regenerate')}
                      disabled={recoveryKeyLoading}
                    >
                      {recoveryKeyLoading ? t('profile.totpLoading') : t('profile.recoveryKeyRegenerate')}
                    </Button>
                    <Button
                      color="warning"
                      variant="text"
                      size="small"
                      onClick={() => openRecoveryKeyVerificationDialog('revoke')}
                      disabled={recoveryKeyLoading}
                    >
                      {t('profile.recoveryKeyRevoke')}
                    </Button>
                  </Stack>
                ) : (
                  <Button
                    variant="contained"
                    startIcon={<Key />}
                    onClick={handleCreateRecoveryKey}
                    disabled={recoveryKeyLoading}
                  >
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
                  {webauthnClientSupported
                    ? t('profile.webauthnSubtitle')
                    : t('profile.webauthnUnsupportedHint')}
                </Typography>
              </Box>

              <Stack
                direction="column"
                spacing={2}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Key />}
                    onClick={handleOpenWebAuthnDialog}
                    disabled={webauthnLoading || !webauthnRegistrationReady}
                  >
                    {webauthnLoading ? t('profile.totpLoading') : webauthnPrimaryActionLabel}
                  </Button>
                  
                  <FormControlLabel
                    control={(
                      <Switch
                        size="small"
                        checked={webauthn2faEnabled}
                        onChange={(e) => handleToggleWebAuthn2fa(e.target.checked)}
                        disabled={webauthnLoading || webauthnCredentials.length === 0}
                      />
                    )}
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
                {twoFactorFeedback && (
                  <Alert severity={twoFactorFeedback.severity}>
                    {twoFactorFeedback.message}
                  </Alert>
                )}
                {webauthnAvailabilityError && (
                  <Alert severity="info">
                    {webauthnAvailabilityError}
                  </Alert>
                )}
                {webauthnFeedback && (
                  <Alert severity={webauthnFeedback.severity}>
                    {webauthnFeedback.message}
                  </Alert>
                )}
              </Stack>
            )}

            {webauthnCredentials.length > 0 && (
              <Stack spacing={1.5}>
                <Typography variant="subtitle2">
                  {t('profile.webauthnCredentialsTitle')}
                </Typography>
                {webauthnCredentials.map((credential) => (
                  <Box
                    key={credential.id}
                    sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
                  >
                    <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {credential.name || t('profile.webauthnUnnamedCredential')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {t('profile.webauthnCreatedAt', { value: formatDateTime(credential.created_at) })}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {t('profile.webauthnLastUsedAt', { value: formatDateTime(credential.last_used_at) })}
                        </Typography>
                      </Box>
                      <Button
                        color="error"
                        variant="text"
                        size="small"
                        startIcon={<Delete />}
                        onClick={() => setCredentialToDelete(credential)}
                        disabled={webauthnLoading}
                      >
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

      <Card sx={{ maxWidth: 500, mt: 2 }}>
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6" gutterBottom>
                {t('profile.deleteAccountTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('profile.deleteAccountSubtitle')}
              </Typography>
            </Box>
            <Alert severity="warning">
              {t('profile.deleteAccountWarning')}
            </Alert>
            <Box>
              <Button
                color="error"
                variant="outlined"
                startIcon={<Delete />}
                onClick={handleOpenDeleteDialog}
              >
                {t('profile.deleteAccountAction')}
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <TextureManageDialog
        open={textureDialogOpen}
        onClose={() => setTextureDialogOpen(false)}
        token={getAuthToken() || ''}
        onUpdated={fetchTextures}
      />

      <Dialog open={webauthnDialogOpen} onClose={handleCloseWebAuthnDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{t('profile.webauthnRegisterDialogTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {webauthnFeedback && (
              <Alert severity={webauthnFeedback.severity}>
                {webauthnFeedback.message}
              </Alert>
            )}
            <Typography variant="body2" color="text.secondary">
              {t('profile.webauthnRegisterHint')}
            </Typography>
            <TextField
              label={t('profile.webauthnNameLabel')}
              value={webauthnName}
              onChange={(e) => {
                setWebauthnName(e.target.value);
                if (webauthnNameError) {
                  setWebauthnNameError(null);
                }
                if (pendingWebAuthnRegistration) {
                  setPendingWebAuthnRegistration(null);
                }
              }}
              placeholder={t('profile.webauthnNamePlaceholder')}
              error={!!webauthnNameError}
              helperText={webauthnNameError || t('profile.webauthnNameHelper')}
              fullWidth
              disabled={webauthnLoading}
            />
            {pendingWebAuthnRegistration && (
              <Alert severity="info">
                {t('profile.webauthnReadyForPromptHint')}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseWebAuthnDialog} disabled={webauthnLoading}>
            {t('common.cancel')}
          </Button>
          <Button variant="contained" onClick={handleRegisterWebAuthn} disabled={webauthnLoading}>
            {webauthnLoading
              ? t('profile.totpLoading')
              : (pendingWebAuthnRegistration ? t('profile.webauthnTriggerPrompt') : t('profile.webauthnPrepareRegister'))}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(credentialToDelete)}
        onClose={() => (webauthnLoading ? undefined : setCredentialToDelete(null))}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t('profile.webauthnDeleteDialogTitle')}</DialogTitle>
        <DialogContent>
          <Typography sx={{ mt: 1 }}>
            {t('profile.webauthnDeleteDialogDescription', {
              name: credentialToDelete?.name || t('profile.webauthnUnnamedCredential'),
            })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCredentialToDelete(null)} disabled={webauthnLoading}>
            {t('common.cancel')}
          </Button>
          <Button color="error" variant="contained" onClick={handleDeleteWebAuthnCredential} disabled={webauthnLoading}>
            {webauthnLoading ? t('profile.totpLoading') : t('profile.webauthnDeleteCredential')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={totpDialogOpen} onClose={handleCloseTotpDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{t('profile.setupDialogTitle')}</DialogTitle>
        <DialogContent>
          {setupSuccess ? (
            <Alert severity="success" sx={{ mt: 2 }}>
              {t('profile.setupSuccess')}
            </Alert>
          ) : (
            <>
              {totpError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {totpError}
                </Alert>
              )}
              {totpKey && (
                <>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {t('profile.scanHint')}
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                    <QRCodeSVG
                      value={generateOtpAuthUri(totpKey, userInfo?.email || '')}
                      size={200}
                      level="M"
                    />
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
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">
                            <Typography variant="caption" color="text.secondary">
                              {passcode.length}/6
                            </Typography>
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                </>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseTotpDialog}>{t('profile.cancel')}</Button>
          {!setupSuccess && totpKey && (
            <Button
              variant="contained"
              onClick={handleVerifyPasscode}
              disabled={verifying || passcode.length !== 6}
            >
              {verifying ? t('profile.verifying') : t('profile.verify')}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog
        open={disableTotpDialogOpen}
        onClose={() => setDisableTotpDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t('profile.disableTotpDialogTitle')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {t('profile.disableTotpDialogDescription')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDisableTotpDialogOpen(false)} disabled={totpLoading}>
            {t('profile.cancel')}
          </Button>
          <Button color="warning" variant="contained" onClick={handleDisableTotp} disabled={totpLoading}>
            {totpLoading ? t('profile.totpLoading') : t('profile.totpDisable')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={recoveryKeyDialogOpen} onClose={closeRecoveryKeyDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {recoveryKeyDialogMode === 'display'
            ? t('profile.recoveryKeyDialogTitle')
            : (recoveryKeyDialogMode === 'regenerate'
              ? t('profile.recoveryKeyRegenerateDialogTitle')
              : t('profile.recoveryKeyRevokeDialogTitle'))}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {recoveryKeyDialogMode === 'display' ? (
              <>
                <Alert severity="success">
                  {t('profile.recoveryKeyDisplaySuccess')}
                </Alert>
                <Typography variant="body2" color="text.secondary">
                  {t('profile.recoveryKeyDisplayHint')}
                </Typography>
                <TextField
                  label={t('profile.recoveryKeyLabel')}
                  value={generatedRecoveryKey}
                  fullWidth
                  slotProps={{ input: { readOnly: true } }}
                />
              </>
            ) : (
              <>
                {recoveryKeyDialogError && (
                  <Alert severity="error">
                    {recoveryKeyDialogError}
                  </Alert>
                )}
                <Typography variant="body2" color="text.secondary">
                  {recoveryKeyDialogMode === 'regenerate'
                    ? t('profile.recoveryKeyRegenerateHint')
                    : t('profile.recoveryKeyRevokeHint')}
                </Typography>

                {selectedRecoveryKeyMethod === 'totp' && (
                  <TextField
                    label={t('profile.totpTitle')}
                    value={recoveryKeyTotpCode}
                    onChange={(e) => setRecoveryKeyTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder={t('login.totpPlaceholder')}
                    fullWidth
                    disabled={recoveryKeyLoading}
                    helperText={t('profile.recoveryKeyMethodTotpDescription')}
                  />
                )}

                {selectedRecoveryKeyMethod === 'email' && (
                  <Stack direction="row" spacing={1}>
                    <TextField
                      label={t('profile.emailCodeLabel')}
                      value={recoveryKeyEmailCode}
                      onChange={(e) => setRecoveryKeyEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder={t('profile.emailCodePlaceholder')}
                      fullWidth
                      disabled={recoveryKeyLoading || recoveryKeySendingEmailCode}
                      helperText={t('profile.recoveryKeyMethodEmailDescription')}
                    />
                    <Button
                      type="button"
                      variant="outlined"
                      onClick={handleSendRecoveryKeyEmailCode}
                      disabled={recoveryKeyLoading || recoveryKeySendingEmailCode}
                      sx={{ height: 56 }}
                    >
                      {recoveryKeySendingEmailCode ? t('common.loading') : t('profile.sendCodeToCurrentEmail')}
                    </Button>
                  </Stack>
                )}

                {selectedRecoveryKeyMethod === 'recovery_key' && (
                  <TextField
                    label={t('profile.recoveryKeyCurrentLabel')}
                    value={recoveryKeyVerificationValue}
                    onChange={(e) => setRecoveryKeyVerificationValue(e.target.value.toUpperCase().slice(0, 19))}
                    placeholder={t('profile.recoveryKeyPlaceholder')}
                    fullWidth
                    disabled={recoveryKeyLoading}
                    helperText={t('profile.recoveryKeyMethodRecoveryDescription')}
                  />
                )}

                {selectedRecoveryKeyMethod === 'webauthn' && (
                  <Alert severity="info">
                    {t('profile.recoveryKeyMethodPasskeyDescription')}
                  </Alert>
                )}

                {recoveryKeyMethodOptions.length > 1 && (
                  <Button
                    type="button"
                    variant="text"
                    onClick={() => setRecoveryKeyMethodDialogOpen(true)}
                    disabled={recoveryKeyLoading || recoveryKeySendingEmailCode}
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
          <Button onClick={closeRecoveryKeyDialog} disabled={recoveryKeyLoading || recoveryKeySendingEmailCode}>
            {t('common.cancel')}
          </Button>
          {recoveryKeyDialogMode !== 'display' && (
            <Button
              variant="contained"
              color={recoveryKeyDialogMode === 'revoke' ? 'warning' : 'primary'}
              onClick={handleSubmitRecoveryKeyAction}
              disabled={recoveryKeyLoading || recoveryKeySendingEmailCode}
            >
              {recoveryKeyLoading
                ? t('common.pleaseWait')
                : (recoveryKeyDialogMode === 'regenerate'
                  ? t('profile.recoveryKeyRegenerate')
                  : t('profile.recoveryKeyRevoke'))}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{t('profile.deleteAccountDialogTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="warning">
              {t('profile.deleteAccountDialogWarning')}
            </Alert>
            <Typography variant="body2" color="text.secondary">
              {t('profile.deleteAccountDialogDescription')}
            </Typography>
            <TextField
              type="password"
              label={t('profile.deletePasswordLabel')}
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              fullWidth
              autoComplete="current-password"
              error={!!deletePasswordError}
              helperText={deletePasswordError}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog} disabled={deleteLoading}>
            {t('profile.cancel')}
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDeleteAccount}
            disabled={deleteLoading}
          >
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
