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
  textureType: TextureType;
  uid: string;
  token: string;
  onUpdated?: () => void;
}

interface TextureInfo {
  texture_type: string;
  url: string;
  model?: string;
}

function TextureManageDialog({ open, onClose, textureType, uid, token, onUpdated }: TextureManageDialogProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [skinPreviewUrl, setSkinPreviewUrl] = useState<string | null>(null);
  const [capePreviewUrl, setCapePreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<'default' | 'slim'>('default');
  const [lastAction, setLastAction] = useState<'upload' | 'delete' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const label = textureType === 'skin' ? 'Skin' : 'Cape';
  const inputId = `${textureType}-upload`;

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setCurrentUrl(null);
      setSkinPreviewUrl(null);
      setCapePreviewUrl(null);
      setError(null);
      setLastAction(null);
      setConfirmDelete(false);
      setModel('default');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    let cancelled = false;
    const fetchCurrent = async () => {
      try {
        const backendUrl = await getRealBackendUrl();
        const response = await fetch(`${backendUrl}/texture/get`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            remember_token: token,
            profile_id: uid,
          }),
        });

        if (cancelled) return;

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data && data.data.textures) {
            const targetTexture = data.data.textures.find((t: TextureInfo) => t.texture_type === textureType);
            if (targetTexture && targetTexture.url) {
              const fullUrl = `${targetTexture.url}?${Date.now()}`;
              setCurrentUrl(fullUrl);
              setPreview(fullUrl);
              if (textureType === 'skin') {
                setSkinPreviewUrl(fullUrl);
                if (targetTexture.model) {
                  setModel(targetTexture.model as 'default' | 'slim');
                }
              } else {
                setCapePreviewUrl(fullUrl);
              }
            } else {
              setCurrentUrl(null);
              setPreview(null);
              if (textureType === 'skin') {
                setSkinPreviewUrl(null);
              } else {
                setCapePreviewUrl(null);
              }
            }

            const skinTexture = data.data.textures.find((t: TextureInfo) => t.texture_type === 'skin');
            if (skinTexture && skinTexture.url) {
              setSkinPreviewUrl(`${skinTexture.url}?${Date.now()}`);
              if (skinTexture.model) {
                setModel(skinTexture.model as 'default' | 'slim');
              }
            } else {
              setSkinPreviewUrl(null);
            }

            const capeTexture = data.data.textures.find((t: TextureInfo) => t.texture_type === 'cape');
            if (capeTexture && capeTexture.url) {
              setCapePreviewUrl(`${capeTexture.url}?${Date.now()}`);
            } else {
              setCapePreviewUrl(null);
            }
          } else {
            setCurrentUrl(null);
            setPreview(null);
            setSkinPreviewUrl(null);
            setCapePreviewUrl(null);
          }
        } else {
          setCurrentUrl(null);
          setPreview(null);
          setSkinPreviewUrl(null);
          setCapePreviewUrl(null);
        }
      } catch {
        if (!cancelled) {
          setCurrentUrl(null);
          setPreview(null);
          setSkinPreviewUrl(null);
          setCapePreviewUrl(null);
        }
      }
    };
    fetchCurrent();
    return () => {
      cancelled = true;
    };
  }, [open, uid, token, textureType]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
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
      setPreview(dataUrl);
      if (textureType === 'skin') {
        setSkinPreviewUrl(dataUrl);
      } else {
        setCapePreviewUrl(dataUrl);
      }
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    const fileInput = fileInputRef.current;
    if (!fileInput?.files?.[0]) {
      setError('请先选择一个文件');
      return;
    }

    const file = fileInput.files[0];

    setLoading(true);
    setError(null);

    try {
      const backendUrl = await getRealBackendUrl();
      const formData = new FormData();
      formData.append('remember_token', token);
      formData.append('profile_id', uid);
      formData.append('texture_type', textureType);
      if (textureType === 'skin') {
        formData.append('model', model);
      }
      formData.append('file', file);

      const response = await fetch(`${backendUrl}/texture/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data?.success) {
        setLastAction('upload');
        await fetchCurrentTexture();
        onUpdated?.();
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setError(data?.message || '上传失败');
      }
    } catch {
      setError('服务器错误');
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentTexture = async () => {
    try {
      const backendUrl = await getRealBackendUrl();
      const response = await fetch(`${backendUrl}/texture/get`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          remember_token: token,
          profile_id: uid,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data && data.data.textures) {
          const targetTexture = data.data.textures.find((t: TextureInfo) => t.texture_type === textureType);
          if (targetTexture && targetTexture.url) {
            const fullUrl = `${targetTexture.url}?${Date.now()}`;
            setCurrentUrl(fullUrl);
            setPreview(fullUrl);
          } else {
            setCurrentUrl(null);
            setPreview(null);
          }

          const skinTexture = data.data.textures.find((t: TextureInfo) => t.texture_type === 'skin');
          if (skinTexture && skinTexture.url) {
            setSkinPreviewUrl(`${skinTexture.url}?${Date.now()}`);
          } else {
            setSkinPreviewUrl(null);
          }

          const capeTexture = data.data.textures.find((t: TextureInfo) => t.texture_type === 'cape');
          if (capeTexture && capeTexture.url) {
            setCapePreviewUrl(`${capeTexture.url}?${Date.now()}`);
          } else {
            setCapePreviewUrl(null);
          }
        }
      }
    } catch {
      // ignore
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    setError(null);

    try {
      const backendUrl = await getRealBackendUrl();
      const response = await fetch(`${backendUrl}/texture/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          remember_token: token,
          profile_id: uid,
          texture_type: textureType,
        }),
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data?.success) {
        setLastAction('delete');
        setCurrentUrl(null);
        setPreview(null);
        onUpdated?.();
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setError(data?.message || '删除失败');
      }
    } catch {
      setError('服务器错误');
    } finally {
      setLoading(false);
      setConfirmDelete(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Manage Minecraft {label}</DialogTitle>
      <DialogContent>
        {lastAction ? (
          <Alert severity="success" sx={{ mt: 2 }}>
            {lastAction === 'upload'
              ? `${label} uploaded successfully!`
              : `${label} deleted successfully!`}
          </Alert>
        ) : confirmDelete ? (
          <Box sx={{ mt: 2 }}>
            <Alert severity="warning" sx={{ mb: 2 }}>
              确定要删除当前的 {label} 吗？此操作无法撤销。
            </Alert>
            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button onClick={() => setConfirmDelete(false)} disabled={loading}>
                取消
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={handleDelete}
                disabled={loading}
              >
                {loading ? '删除中...' : '确认删除'}
              </Button>
            </Stack>
          </Box>
        ) : (
          <>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <Box sx={{ display: 'flex', gap: 4, mt: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {label} Preview:
                </Typography>
                {preview ? (
                  <Box sx={{ position: 'relative', width: 200, height: 400, margin: '0 auto' }}>
                    <Suspense fallback={<CircularProgress sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />}>
                      <SkinViewer3D
                        skinUrl={skinPreviewUrl}
                        capeUrl={capePreviewUrl}
                        model={model}
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
              <Box sx={{ flex: 1 }}>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  Upload {label}:
                </Typography>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                  id={inputId}
                />
                <label htmlFor={inputId}>
                  <Button
                    variant="outlined"
                    component="span"
                    startIcon={<CloudUpload />}
                    fullWidth
                    sx={{ mb: 2 }}
                  >
                    Choose File
                  </Button>
                </label>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Supported: PNG format, max 100KB
                </Typography>
                {textureType === 'skin' && (
                  <>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                      Skin Model:
                    </Typography>
                    <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
                      <Button
                        variant={model === 'default' ? 'contained' : 'outlined'}
                        onClick={() => setModel('default')}
                      >
                        Default (Steve)
                      </Button>
                      <Button
                        variant={model === 'slim' ? 'contained' : 'outlined'}
                        onClick={() => setModel('slim')}
                      >
                        Slim (Alex)
                      </Button>
                    </Stack>
                  </>
                )}
                {currentUrl && (
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<Delete />}
                    onClick={() => setConfirmDelete(true)}
                    disabled={loading}
                    fullWidth
                    sx={{ mb: 2 }}
                  >
                    Delete Current {label}
                  </Button>
                )}
              </Box>
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          {lastAction ? 'Close' : 'Cancel'}
        </Button>
        {!lastAction && !confirmDelete && (
          <Button
            variant="contained"
            onClick={handleUpload}
            disabled={loading || !preview}
          >
            {loading ? 'Uploading...' : 'Upload'}
          </Button>
        )}
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

  const [skinDialogOpen, setSkinDialogOpen] = useState(false);
  const [capeDialogOpen, setCapeDialogOpen] = useState(false);

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

        if (resp.ok && data.success && data.data) {
          const apiTotp = data.data.totp_enabled;
          const cookieTotp = getTotpEnabled();
          const totpEnabled = apiTotp !== undefined ? Boolean(apiTotp) : (cookieTotp !== undefined ? cookieTotp : false);
          
          setUserInfo({
            email: data.data.email || email,
            username: data.data.username || email.split('@')[0],
            avatar: data.data.avatar,
            verified: Boolean(data.data.verified),
            totp_enabled: totpEnabled,
          });
        } else {
          const cookieTotp = getTotpEnabled();
          setUserInfo({
            email,
            username: email.split('@')[0],
            verified: Boolean(getVerified()),
            totp_enabled: cookieTotp !== undefined ? cookieTotp : false,
          });
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
        Dashboard
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
                Minecraft Skin
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Upload and manage your Minecraft character skin
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<CloudUpload />}
              onClick={() => setSkinDialogOpen(true)}
            >
              Manage Skin
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ maxWidth: 500, mt: 2 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h6" gutterBottom>
                Minecraft Cape
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Upload and manage your Minecraft character cape
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<CloudUpload />}
              onClick={() => setCapeDialogOpen(true)}
            >
              Manage Cape
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
        open={skinDialogOpen}
        onClose={() => setSkinDialogOpen(false)}
        textureType="skin"
        uid={getUid() || ''}
        token={getAuthToken() || ''}
      />

      <TextureManageDialog
        open={capeDialogOpen}
        onClose={() => setCapeDialogOpen(false)}
        textureType="cape"
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