import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import type { ChangeEvent } from 'react';
import { Box, Typography, Card, CardContent, Avatar, CircularProgress, Alert, Chip, Stack, Link, TextField, Button, Dialog, DialogTitle, DialogContent, DialogActions, InputAdornment, FormControlLabel, Switch } from '@mui/material';
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
const SkinViewer3D = lazy(() => import('../components/SkinViewer3D'));
import { request } from '../utils/api';
import {
  beginWebAuthnRegistration,
  deleteWebAuthnCredential,
  finishWebAuthnRegistration,
  getTotpStatus,
  listWebAuthnCredentials,
  requestAccountDeletion,
  setupTotp,
  toggleTotp,
  toggleWebAuthnSecondFactor,
  type WebAuthnCredentialRecord,
  type WebAuthnPublicKeyOptions,
  verifyTotp,
} from '../api/auth';
import { clearAuthCookies, getUserEmail, getAuthToken, getUid, getVerified, getTotpEnabled, setTotpEnabled } from '../utils/cookie';
import { BackendUrl } from '../utils/config';
import { isWebAuthnSupported, registerWithWebAuthn } from '../utils/webauthn';

interface UserInfo {
  email: string;
  username: string;
  avatar?: string;
  verified?: boolean;
  totp_enabled: boolean;
  webauthn_2fa_enabled?: boolean;
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

  const fetchTextures = async () => {
    try {
      const response = await request(`${BackendUrl}/texture/get`, {
        method: 'POST',
      });

      if (response.success && response.data && Array.isArray(response.data.textures)) {
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

  const readTotpEnabledFromResponse = (resp: { data?: { enabled?: boolean | number }; enabled?: boolean | number }): boolean | undefined => {
    return parseEnabledFlag(resp.data?.enabled ?? resp.enabled);
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

  const refreshTotpStatus = async (fallback?: boolean): Promise<boolean> => {
    const fallbackValue = fallback ?? getTotpEnabled() ?? false;

    try {
      const resp = await getTotpStatus();
      const enabled = readTotpEnabledFromResponse(resp as typeof resp & { enabled?: boolean | number });
      const finalValue = resp.success && enabled !== undefined ? enabled : fallbackValue;
      setTotpEnabled(finalValue);
      setUserInfo((prev) => (prev ? { ...prev, totp_enabled: finalValue } : prev));
      return finalValue;
    } catch {
      setTotpEnabled(fallbackValue);
      setUserInfo((prev) => (prev ? { ...prev, totp_enabled: fallbackValue } : prev));
      return fallbackValue;
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

      try {
        const [resp, totpResp, webauthnResp] = await Promise.all([
          request(`${BackendUrl}/user`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ uid, email }),
          }),
          getTotpStatus(),
          listWebAuthnCredentials(),
        ]);

        // #region debug-point E:initial-load-webauthn-response
        reportWebAuthnDebug('E', 'Profile.tsx:fetchData:webauthnResp', 'Initial WebAuthn-related responses loaded', {
          userSuccess: resp.success,
          credentialSuccess: webauthnResp.success,
          credentialCode: webauthnResp.code ?? null,
          credentialMessage: webauthnResp.message,
          credentialDataType: Array.isArray(webauthnResp.data) ? 'array' : typeof webauthnResp.data,
        });
        // #endregion

        let totpEnabled = getTotpEnabled() ?? false;
        const apiTotpEnabled = readTotpEnabledFromResponse(totpResp as typeof totpResp & { enabled?: boolean | number });
        if (totpResp.success && apiTotpEnabled !== undefined) {
          totpEnabled = apiTotpEnabled;
          setTotpEnabled(totpEnabled);
        }

        const webauthnEnabledFromApi = webauthnResp.success ? readWebAuthnEnabledFromValue(webauthnResp.data) : undefined;
        const webauthnEnabledFromUser = resp.success ? readWebAuthnEnabledFromValue(resp.data) : undefined;
        const webauthnEnabled = webauthnEnabledFromApi ?? webauthnEnabledFromUser ?? false;
        applyWebAuthnState(webauthnResp.success ? webauthnResp.data : [], webauthnEnabled);

        if (resp.success && resp.data) {
          setUserInfo({
            email: resp.data.email || email || '',
            username: resp.data.username || (email ? email.split('@')[0] : 'User'),
            avatar: resp.data.avatar,
            verified: Boolean(resp.data.verified),
            totp_enabled: totpEnabled,
            webauthn_2fa_enabled: webauthnEnabled,
            uid: resp.data.uid,
          });
        } else {
          setUserInfo({
            email: email || '',
            username: email ? email.split('@')[0] : 'User',
            verified: Boolean(getVerified()),
            totp_enabled: totpEnabled,
            webauthn_2fa_enabled: webauthnEnabled,
          });
        }
      } catch {
        const cookieTotp = getTotpEnabled();
        applyWebAuthnState([], false);
        setUserInfo({
          email: email || '',
          username: email ? email.split('@')[0] : 'User',
          verified: Boolean(getVerified()),
          totp_enabled: cookieTotp !== undefined ? cookieTotp : false,
          webauthn_2fa_enabled: false,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [t]);

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
        await refreshTotpStatus(true);
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
        await refreshTotpStatus(false);
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
        await refreshTotpStatus(true);
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

      await refreshWebAuthnStatus(webauthn2faEnabled);
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

      const nextEnabled = readWebAuthnEnabledFromValue(resp.data) ?? enabled;
      await refreshWebAuthnStatus(nextEnabled);
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

      const nextCredentialCount = Math.max(webauthnCredentials.length - 1, 0);
      const nextEnabled = nextCredentialCount > 0 ? webauthn2faEnabled : false;
      await refreshWebAuthnStatus(nextEnabled);
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
  const webauthnClientSupported = typeof window !== 'undefined' && window.isSecureContext && isWebAuthnSupported();
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
            <Typography variant="body1" color="text.secondary" gutterBottom>
              {userInfo.email}
            </Typography>
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
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6" gutterBottom>
                {t('profile.twoFactorSectionTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('profile.twoFactorSectionSubtitle')}
              </Typography>
            </Box>

            <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
                <Box>
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
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <Button
                      variant="outlined"
                      startIcon={<Key />}
                      onClick={handleOpenTotpDialog}
                      disabled={totpLoading}
                    >
                      {totpLoading ? t('profile.totpLoading') : t('profile.totpReset')}
                    </Button>
                    <Button
                      color="warning"
                      variant="text"
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

            {twoFactorFeedback && (
              <Alert severity={twoFactorFeedback.severity}>
                {twoFactorFeedback.message}
              </Alert>
            )}

            <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Box>
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
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'stretch', sm: 'center' }}
                justifyContent="space-between"
                spacing={2}
                sx={{ mt: 2 }}
              >
                <Button
                  variant="contained"
                  startIcon={<Key />}
                  onClick={handleOpenWebAuthnDialog}
                  disabled={webauthnLoading || !webauthnRegistrationReady}
                >
                  {webauthnLoading ? t('profile.totpLoading') : webauthnPrimaryActionLabel}
                </Button>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <FormControlLabel
                    control={(
                      <Switch
                        checked={webauthn2faEnabled}
                        onChange={(e) => handleToggleWebAuthn2fa(e.target.checked)}
                        disabled={webauthnLoading || webauthnCredentials.length === 0}
                      />
                    )}
                    label={t('profile.webauthnSecondFactorLabel')}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {webauthnCredentials.length > 0
                      ? t('profile.webauthnSecondFactorDescription')
                      : t('profile.webauthnSecondFactorDisabledHint')}
                  </Typography>
                </Box>
              </Stack>
            </Box>

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

            <Stack spacing={1.5}>
              <Typography variant="subtitle2">
                {t('profile.webauthnCredentialsTitle')}
              </Typography>
              {webauthnCredentials.length > 0 ? (
                webauthnCredentials.map((credential) => (
                  <Box
                    key={credential.id}
                    sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
                  >
                    <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
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
                        startIcon={<Delete />}
                        onClick={() => setCredentialToDelete(credential)}
                        disabled={webauthnLoading}
                      >
                        {t('profile.webauthnDeleteCredential')}
                      </Button>
                    </Stack>
                  </Box>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {t('profile.webauthnEmpty')}
                </Typography>
              )}
            </Stack>
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
    </Box>
  );
}
