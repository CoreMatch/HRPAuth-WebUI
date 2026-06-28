import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import type { ChangeEvent } from 'react';
import { Box, Typography, Card, CardContent, Avatar, CircularProgress, Alert, Chip, Stack, Link, TextField, Button, Dialog, DialogTitle, DialogContent, DialogActions, InputAdornment } from '@mui/material';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Warning from '@mui/icons-material/Warning';
import Edit from '@mui/icons-material/Edit';
import Save from '@mui/icons-material/Save';
import Key from '@mui/icons-material/Key';
import CloudUpload from '@mui/icons-material/CloudUpload';
import Delete from '@mui/icons-material/Delete';
import Photo from '@mui/icons-material/Photo';
import { QRCodeSVG } from 'qrcode.react';
import { Link as RouterLink } from 'react-router-dom';
const SkinViewer3D = lazy(() => import('../components/SkinViewer3D'));
import { getUserEmail, getAuthToken, getUid, getVerified, getTotpEnabled, setTotpEnabled } from '../utils/cookie';
import { getApiUrl, getRealBackendUrl } from '../utils/config';

interface UserInfo {
  email: string;
  username: string;
  avatar?: string;
  verified?: boolean;
  totp_enabled: boolean;
  uuid?: string;
}

type TextureType = 'skin' | 'cape';

interface TextureManageDialogProps {
  open: boolean;
  onClose: () => void;
  uid: string;
  token: string;
  onUpdated?: () => void;
}

interface TextureInfo {
  texture_type: string;
  url: string;
  model?: string;
}

function TextureManageDialog({ open, onClose, uid, token, onUpdated }: TextureManageDialogProps) {
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
      const backendUrl = await getRealBackendUrl();
      const response = await fetch(`${backendUrl}/texture/get`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          remember_token: token,
          profile_id: uid,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data && data.data.textures) {
          const skinTexture = data.data.textures.find((t: TextureInfo) => t.texture_type === 'skin');
          const capeTexture = data.data.textures.find((t: TextureInfo) => t.texture_type === 'cape');
          setSkinCurrentUrl(skinTexture?.url ? `${skinTexture.url}?${Date.now()}` : null);
          setCapeCurrentUrl(capeTexture?.url ? `${capeTexture.url}?${Date.now()}` : null);
        } else {
          setSkinCurrentUrl(null);
          setCapeCurrentUrl(null);
        }
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
  }, [open, uid, token]);

  const handleFileSelect = (
    event: ChangeEvent<HTMLInputElement>,
    type: TextureType
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/png')) {
      setError('请上传 PNG 格式的图片');
      return;
    }

    if (file.size > 100 * 1024) {
      setError('图片大小不能超过 100KB');
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

  const handleUpload = async (type: TextureType) => {
    const file = type === 'skin' ? skinFile : capeFile;
    if (!file) {
      setError(`请先选择${type === 'skin' ? '皮肤' : '披风'}文件`);
      return;
    }

    setUploading(type);
    setError(null);

    try {
      const backendUrl = await getRealBackendUrl();
      const formData = new FormData();
      formData.append('remember_token', token);
      formData.append('profile_id', uid);
      formData.append('texture_type', type);
      formData.append('file', file);

      const response = await fetch(`${backendUrl}/texture/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data?.success) {
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
        setError(data?.message || '上传失败');
      }
    } catch {
      setError('服务器错误');
    } finally {
      setUploading(null);
    }
  };

  const handleDelete = async (type: TextureType) => {
    setDeleting(type);
    setError(null);

    try {
      const backendUrl = await getRealBackendUrl();
      const response = await fetch(`${backendUrl}/texture/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          remember_token: token,
          profile_id: uid,
          texture_type: type,
        }),
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data?.success) {
        setSuccess({ type, action: 'delete' });
        if (type === 'skin') {
          setSkinCurrentUrl(null);
        } else {
          setCapeCurrentUrl(null);
        }
        onUpdated?.();
      } else {
        setError(data?.message || '删除失败');
      }
    } catch {
      setError('服务器错误');
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
    const label = type === 'skin' ? 'Skin' : 'Cape';
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
                Choose File
              </Button>
            </label>
            {file && (
              <Button
                variant="contained"
                onClick={() => handleUpload(type)}
                disabled={isLoading}
                sx={{ minWidth: 100 }}
              >
                {isUploading ? 'Uploading...' : 'Upload'}
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
              {isDeleting ? 'Deleting...' : `Delete ${label}`}
            </Button>
          )}
          {file && (
            <Typography variant="caption" color="text.secondary">
              Selected: {file.name}
            </Typography>
          )}
        </Stack>
      </Box>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Manage Skin & Cape</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {success && !confirmDeleteType && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success.type === 'skin' ? 'Skin' : 'Cape'} {success.action === 'upload' ? 'uploaded' : 'deleted'} successfully!
          </Alert>
        )}

        {confirmDeleteType ? (
          <Box sx={{ mt: 2 }}>
            <Alert severity="warning" sx={{ mb: 2 }}>
              确定要删除当前的 {confirmDeleteType === 'skin' ? 'Skin' : 'Cape'} 吗？此操作无法撤销。
            </Alert>
            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button onClick={() => setConfirmDeleteType(null)} disabled={isLoading}>
                取消
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={() => handleDelete(confirmDeleteType)}
                disabled={isLoading}
              >
                {deleting ? '删除中...' : '确认删除'}
              </Button>
            </Stack>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 4, mt: 2, flexDirection: { xs: 'column', md: 'row' } }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body1" sx={{ mb: 2 }}>
                Preview:
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
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function Profile() {
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

  const [textureDialogOpen, setTextureDialogOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const email = getUserEmail();
      const token = getAuthToken();
      const uid = getUid();

      if (!email || !token || !uid) {
        setError('未登录或登录已过期');
        setLoading(false);
        return;
      }

      try {
        const resp = await fetch(getApiUrl('/user'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ remember_token: token, uid, email }),
        });

        const data = await resp.json().catch(() => ({
          success: false,
          message: '服务器返回无法解析的响应',
        }));

        let totpEnabled: boolean;
        if (resp.ok && data.success && data.data) {
          const apiTotp = data.data.totp_enabled;
          totpEnabled = apiTotp !== undefined ? Boolean(apiTotp) : (getTotpEnabled() ?? false);
          setUserInfo({
            email: data.data.email || email,
            username: data.data.username || email.split('@')[0],
            avatar: data.data.avatar,
            verified: Boolean(data.data.verified),
            totp_enabled: totpEnabled,
          });
        } else {
          totpEnabled = getTotpEnabled() ?? false;
          setUserInfo({
            email,
            username: email.split('@')[0],
            verified: Boolean(getVerified()),
            totp_enabled: totpEnabled,
          });
        }

        // 根据 API_DOC.md 中的 POST /totp/hasbeenenabled 权威校验 totp 状态
        try {
          const totpResp = await fetch(getApiUrl('/totp/hasbeenenabled'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ uid, rt: token }),
          });
          const totpData = await totpResp.json().catch(() => null);
          if (totpResp.ok && totpData && totpData.success && typeof totpData.enabled !== 'undefined') {
            const serverTotp = Boolean(Number(totpData.enabled));
            setTotpEnabled(serverTotp);
            setUserInfo(prev => prev ? { ...prev, totp_enabled: serverTotp } : prev);
          }
        } catch {
          // 静默失败，沿用之前的 totp 状态
        }
      } catch {
        const cookieTotp = getTotpEnabled();
        setUserInfo({
          email,
          username: email.split('@')[0],
          verified: Boolean(getVerified()),
          totp_enabled: cookieTotp !== undefined ? cookieTotp : false,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSaveUsername = async () => {
    if (!newUsername.trim()) {
      setSaveError('名称不能为空');
      return;
    }

    if (newUsername.length < 3 || newUsername.length > 16) {
      setSaveError('名称长度必须在3-16个字符之间');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
      setSaveError('名称只能包含字母、数字和下划线');
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const token = getAuthToken();

    try {
      const resp = await fetch(getApiUrl('/change-username'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ remember_token: token, username: newUsername }),
      });

      const data = await resp.json().catch(() => ({
        success: false,
        message: '服务器返回无法解析的响应',
      }));

      if (data.success) {
        const updatedUsername = data.data?.username || newUsername;
        setUserInfo(prev => prev ? { ...prev, username: updatedUsername } : null);
        setSaveSuccess(true);
        setEditMode(false);
        setNewUsername('');
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setSaveError(data.message || '修改失败');
      }
    } catch {
      setSaveError('服务器错误');
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
      setTotpError('未登录或登录已过期');
      return;
    }

    setTotpLoading(true);
    setTotpError(null);
    setTotpKey(null);
    setPasscode('');
    setPasscodeError(null);
    setSetupSuccess(false);

    try {
      const resp = await fetch(getApiUrl('/totp/setup'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, remtoken: token }),
      });

      const data = await resp.json().catch(() => ({
        success: false,
        message: '服务器返回无法解析的响应',
      }));

      if (data.success && data.totpkey) {
        setTotpKey(data.totpkey);
        setTotpDialogOpen(true);
      } else {
        setTotpError(data.message || '设置 TOTP 失败');
      }
    } catch {
      setTotpError('服务器错误');
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

  const handleVerifyPasscode = async () => {
    if (!passcode || passcode.length !== 6 || !/^\d+$/.test(passcode)) {
      setPasscodeError('请输入6位数字验证码');
      return;
    }

    const email = getUserEmail();
    if (!email) {
      setPasscodeError('用户信息获取失败');
      return;
    }

    setVerifying(true);
    setPasscodeError(null);

    try {
      const resp = await fetch(getApiUrl('/totp/verify'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, passcode }),
      });

      const data = await resp.json().catch(() => ({
        success: false,
        message: '服务器返回无法解析的响应',
      }));

      if (data.success) {
        setSetupSuccess(true);
        setUserInfo(prev => prev ? { ...prev, totp_enabled: true } : null);
        setTotpEnabled(true);
        setTimeout(() => {
          handleCloseTotpDialog();
        }, 1500);
      } else {
        setPasscodeError(data.message || '验证失败');
      }
    } catch {
      setPasscodeError('服务器错误');
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
            Verify email now
          </Link>
        </Box>
      </Alert>
    );
  }

  if (!userInfo) {
    return null;
  }

  const userInitial = userInfo.username ? userInfo.username.charAt(0).toUpperCase() : 'U';

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Profile
      </Typography>

      {!userInfo.verified && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Your email is not verified. Please verify your email to access full features.
          <Box sx={{ mt: 1 }}>
            <Link component={RouterLink} to="/verifyemail" color="primary">
              Verify email now
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
                  label="New Username"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="3-16 characters, letters, numbers, underscores"
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
                    {saving ? 'Saving...' : 'Save'}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={handleCancelEdit}
                    disabled={saving}
                  >
                    Cancel
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
                    Edit
                  </Button>
                </Box>
                {saveSuccess && (
                  <Alert severity="success" sx={{ mt: 1, mb: 2 }}>
                    Username updated successfully!
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
                label={userInfo.verified ? 'Email verified' : 'Email not verified'}
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
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h6" gutterBottom>
                Skin & Cape
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Manage your skin and cape
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<CloudUpload />}
              onClick={() => setTextureDialogOpen(true)}
            >
              Upload
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ maxWidth: 500, mt: 2 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h6" gutterBottom>
                Two-Factor Authentication
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {userInfo.totp_enabled
                  ? 'TOTP has been enabled for your account'
                  : 'Protect your account with TOTP authenticator'
                }
              </Typography>
            </Box>
            <Button
              variant={userInfo.totp_enabled ? 'outlined' : 'contained'}
              startIcon={<Key />}
              onClick={handleOpenTotpDialog}
              disabled={totpLoading}
            >
              {totpLoading ? 'Loading...' : userInfo.totp_enabled ? 'Reset' : 'Enable'}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <TextureManageDialog
        open={textureDialogOpen}
        onClose={() => setTextureDialogOpen(false)}
        uid={getUid() || ''}
        token={getAuthToken() || ''}
      />

      <Dialog open={totpDialogOpen} onClose={handleCloseTotpDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Set up TOTP Authenticator</DialogTitle>
        <DialogContent>
          {setupSuccess ? (
            <Alert severity="success" sx={{ mt: 2 }}>
              TOTP has been successfully enabled!
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
                    Scan the QR code with your authenticator app:
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                    <QRCodeSVG
                      value={generateOtpAuthUri(totpKey, userInfo?.email || '')}
                      size={200}
                      level="M"
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
                    Or manually enter this secret key: <strong>{totpKey}</strong>
                  </Typography>
                  <TextField
                    label="Enter 6-digit code"
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
          <Button onClick={handleCloseTotpDialog}>Cancel</Button>
          {!setupSuccess && totpKey && (
            <Button
              variant="contained"
              onClick={handleVerifyPasscode}
              disabled={verifying || passcode.length !== 6}
            >
              {verifying ? 'Verifying...' : 'Verify'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}