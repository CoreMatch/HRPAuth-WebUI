import { useState, useEffect, lazy, Suspense } from 'react';
import { Box, Typography, Card, CardContent, Alert, Switch, FormControlLabel, Stack, CircularProgress, Chip } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { enableMojangBind, disableMojangBind } from '../api/user';
import { mojangTextureUrl, fetchMojangProfile } from '../api/texture';
import { getAuthToken, getMbeEnabled, setMbeEnabled } from '../utils/cookie';
import { BackendUrl } from '../utils/config';
import { request } from '../utils/api';

const SkinViewer3D = lazy(() => import('../components/SkinViewer3D'));

interface MojangProfile {
  id: string;
  name: string;
}

export default function MojangBindDashboard() {
  const [mbeEnabled, setMbeEnabledState] = useState(false);
  const [mbeLoading, setMbeLoading] = useState(false);
  const [mbeError, setMbeError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mojangUuid, setMojangUuid] = useState<string | null>(null);
  const [mojangProfile, setMojangProfile] = useState<MojangProfile | null>(null);
  const [hasCape, setHasCape] = useState(false);
  const [skinLoading, setSkinLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchMojangProfileLocal = async (uuid: string) => {
    setSkinLoading(true);
    try {
      console.log('[MojangBind] fetchMojangProfileLocal start, uuid:', uuid);
      const profile = await fetchMojangProfile(uuid);
      console.log('[MojangBind] fetchMojangProfile result:', profile);
      if (profile) {
        setMojangProfile({ id: profile.id, name: profile.name });
        setHasCape(profile.has_cape);
      } else {
        setMojangProfile(null);
      }
    } catch (err) {
      console.error('[MojangBind] fetchMojangProfileLocal error:', err);
      setMojangProfile(null);
    } finally {
      setSkinLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      const token = getAuthToken();
      if (!token) {
        setMbeEnabledState(getMbeEnabled() ?? false);
        setLoading(false);
        return;
      }

      try {
        const resp = await request(`${BackendUrl}/user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });

        if (resp.success && resp.data) {
          const apiMbe = resp.data.mbe;
          setMbeEnabledState(apiMbe !== undefined ? Boolean(apiMbe) : (getMbeEnabled() ?? false));
          // 后端返回mojang_uuid时使用
          const uuid = resp.data.mojang_uuid;
          if (uuid) {
            setMojangUuid(uuid);
            fetchMojangProfileLocal(uuid);
          }
        } else {
          setMbeEnabledState(getMbeEnabled() ?? false);
        }
      } catch {
        setMbeEnabledState(getMbeEnabled() ?? false);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleCopyUuid = async () => {
    if (!mojangUuid) return;
    await navigator.clipboard.writeText(mojangUuid);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleToggleMbe = async () => {
    setMbeLoading(true);
    setMbeError(null);

    try {
      const resp = mbeEnabled
        ? await disableMojangBind()
        : await enableMojangBind();

      if (resp.success) {
        const newMbe = Boolean(resp.data?.mbe);
        setMbeEnabledState(newMbe);
        setMbeEnabled(newMbe);
      } else {
        setMbeError(resp.message || '操作失败');
      }
    } catch {
      setMbeError('服务器错误');
    } finally {
      setMbeLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Card>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box sx={{ flex: 1, mr: 2 }}>
              <Typography variant="h6" gutterBottom>
                Mojang Account Binding
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {mbeEnabled
                  ? 'Allow Mojang players with the same username to bind to your account'
                  : 'HA priority: Mojang players with the same username will be rejected'
                }
              </Typography>
              {mbeError && (
                <Alert severity="error" sx={{ mt: 1 }} onClose={() => setMbeError(null)}>
                  {mbeError}
                </Alert>
              )}
            </Box>
            <FormControlLabel
              control={
                <Switch
                  checked={mbeEnabled}
                  onChange={handleToggleMbe}
                  disabled={mbeLoading}
                />
              }
              label={mbeLoading ? '...' : mbeEnabled ? 'On' : 'Off'}
            />
          </Stack>
        </CardContent>
      </Card>

      {mojangUuid && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Bound Account
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                UUID:
              </Typography>
              <Chip
                label={mojangUuid}
                size="small"
                sx={{ fontFamily: 'monospace' }}
              />
              <Box
                component="span"
                onClick={handleCopyUuid}
                sx={{ cursor: 'pointer', display: 'inline-flex', color: 'action.active' }}
              >
                {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
              </Box>
            </Box>

            {skinLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : mojangUuid ? (
              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Skin Preview
                  </Typography>
                  <Suspense fallback={<CircularProgress />}>
                    <SkinViewer3D
                      skinUrl={mojangTextureUrl(mojangUuid, 'skin')}
                      capeUrl={mojangTextureUrl(mojangUuid, 'cape')}
                      width={200}
                      height={400}
                    />
                  </Suspense>
                </Box>
                <Box sx={{ flex: 1, minWidth: 200 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Player Info
                  </Typography>
                  <Stack spacing={1}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Name</Typography>
                      <Typography variant="body1">{mojangProfile?.name ?? '—'}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">UUID</Typography>
                      <Typography variant="body1" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                        {mojangProfile?.id ?? mojangUuid}
                      </Typography>
                    </Box>
                    {hasCape && (
                      <Alert severity="info">Cape available</Alert>
                    )}
                  </Stack>
                </Box>
              </Box>
            ) : (
              <Alert severity="info">No skin data available</Alert>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
