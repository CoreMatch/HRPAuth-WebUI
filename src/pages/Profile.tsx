import { useState, useEffect, useMemo, Suspense } from 'react';
import { Box, Typography, Card, CardContent, Avatar, CircularProgress, Alert, Chip, Stack, TextField, Button } from '@mui/material';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Warning from '@mui/icons-material/Warning';
import Edit from '@mui/icons-material/Edit';
import Save from '@mui/icons-material/Save';
import { useTranslation } from 'react-i18next';
import { dataCache } from '../utils/dataCache';
import { request } from '../utils/api';
import { getUserEmail, getUid } from '../utils/cookie';
import { BackendUrl } from '../utils/config';
import { sdkProfileCards } from '../generated/sdk-profile-cards';

interface UserInfo {
  email: string;
  username: string;
  avatar?: string;
  verified?: boolean;
  uid?: number;
}

export default function Profile() {
  const { t } = useTranslation();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const email = getUserEmail();
      const uid = getUid();
      
      const cachedUser = dataCache.getUser();
      if (cachedUser) {
        setUserInfo({
          email: cachedUser.email || email || '',
          username: cachedUser.username || (email ? email.split('@')[0] : 'User'),
          avatar: cachedUser.avatar,
          verified: Boolean(cachedUser.verified),
          uid: cachedUser.uid,
        });
        setLoading(false);
      }
      try {
        const userResp = await request(`${BackendUrl}/user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid, email }),
        });
        if (userResp.success && userResp.data) {
          dataCache.setUser(userResp.data);
          setUserInfo({
            email: userResp.data.email || email || '',
            username: userResp.data.username || (email ? email.split('@')[0] : 'User'),
            avatar: userResp.data.avatar,
            verified: Boolean(userResp.data.verified),
            uid: userResp.data.uid,
          });
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
        headers: { 'Content-Type': 'application/json' },
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

  const orderedSdkProfileCards = useMemo(
    () =>
      [...sdkProfileCards].sort((a, b) => {
        const aHasPriority = typeof a.priority === 'number';
        const bHasPriority = typeof b.priority === 'number';
        if (aHasPriority && bHasPriority && a.priority !== b.priority) {
          return (b.priority as number) - (a.priority as number);
        }
        if (aHasPriority !== bHasPriority) {
          return aHasPriority ? -1 : 1;
        }
        return a.loadOrder - b.loadOrder;
      }),
    []
  );

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!userInfo) return null;

  const userInitial = userInfo.username ? userInfo.username.charAt(0).toUpperCase() : 'U';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {!userInfo.verified && (
        <Alert severity="warning">
          {t('profile.notVerifiedWarning')}
        </Alert>
      )}

      <Card sx={{ maxWidth: 600 }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          {userInfo.avatar ? <Avatar src={userInfo.avatar} alt={userInfo.username} sx={{ width: 80, height: 80 }} /> : <Avatar sx={{ width: 80, height: 80, bgcolor: 'secondary.main', fontSize: '2rem' }}>{userInitial}</Avatar>}
          <Box sx={{ flex: 1 }}>
            {editMode ? (
              <Box sx={{ mb: 2 }}>
                <TextField label={t('profile.newUsernameLabel')} value={newUsername} onChange={(e) => setNewUsername(e.target.value)} fullWidth margin="dense" error={!!saveError} helperText={saveError} />
                <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                  <Button variant="contained" startIcon={<Save />} onClick={handleSaveUsername} disabled={saving}>{saving ? t('profile.saving') : t('profile.save')}</Button>
                  <Button variant="outlined" onClick={handleCancelEdit} disabled={saving}>{t('profile.cancel')}</Button>
                </Stack>
              </Box>
            ) : (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="h5" gutterBottom>{userInfo.username}</Typography>
                  <Button startIcon={<Edit />} onClick={() => setEditMode(true)} size="small" color="primary">{t('profile.edit')}</Button>
                </Box>
                {saveSuccess && <Alert severity="success" sx={{ mt: 1, mb: 2 }}>{t('profile.saveSuccess')}</Alert>}
              </>
            )}
            <Typography variant="body1" color="text.secondary">{userInfo.email}</Typography>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
              <Chip icon={userInfo.verified ? <CheckCircle /> : <Warning />} label={userInfo.verified ? t('profile.emailVerified') : t('profile.emailNotVerified')} color={userInfo.verified ? 'success' : 'warning'} size="small" variant="outlined" />
            </Stack>
          </Box>
        </CardContent>
      </Card>

      <Suspense
        fallback={
          <Box sx={{ py: 4, display: 'grid', placeItems: 'center' }}>
            <CircularProgress color="secondary" size={32} />
          </Box>
        }
      >
        {orderedSdkProfileCards.map((item) => (
          <Card key={item.key}>
            <CardContent>
              <Typography variant="h6" gutterBottom>{item.title}</Typography>
              {item.element}
            </CardContent>
          </Card>
        ))}
      </Suspense>
    </Box>
  );
}
