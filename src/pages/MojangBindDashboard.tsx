import { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, Alert, Switch, FormControlLabel, Stack, CircularProgress } from '@mui/material';
import { enableMojangBind, disableMojangBind } from '../api/user';
import { getAuthToken, getMbeEnabled, setMbeEnabled } from '../utils/cookie';
import { BackendUrl } from '../utils/config';
import { request } from '../utils/api';

export default function MojangBindDashboard() {
  const [mbeEnabled, setMbeEnabledState] = useState(false);
  const [mbeLoading, setMbeLoading] = useState(false);
  const [mbeError, setMbeError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    </Box>
  );
}
