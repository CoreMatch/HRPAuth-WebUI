import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Drawer from '@mui/material/Drawer';
import Toolbar from '@mui/material/Toolbar';
import List from '@mui/material/List';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { Box, Card, CardContent, Grid, Button, CircularProgress } from "@mui/material";
import { alpha } from '@mui/material/styles';
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ApiIcon from '@mui/icons-material/Api';
import { getRealBackendUrl } from '../utils/config';
import { useMeta } from '../hooks/useMeta';
import PersonIcon from '@mui/icons-material/Person';
import SecurityIcon from '@mui/icons-material/Security';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import Profile from './Profile';
import AccountSecurity from './AccountSecurity';
import MojangBindDashboard from './MojangBindDashboard';
import { sdkDashboardItems } from '../generated/sdk-dashboard';
import { useTranslation } from 'react-i18next';

function CodeBlock({ children }: { children: string }) {
  return (
    <Box
      sx={{
        position: "relative",
        bgcolor: "grey.900",
        color: "grey.100",
        p: 2,
        borderRadius: 2,
        fontFamily: "monospace",
        fontSize: "0.9rem",
        whiteSpace: "pre-wrap",
        border: "1px solid",
        borderColor: "grey.800",
      }}
    >
      {children}
    </Box>
  );
}

function YggdrasilDashboard() {
  const { t } = useTranslation();
  const [baseUrl, setBaseUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let mounted = true;
    getRealBackendUrl().then((url) => {
      if (mounted) setBaseUrl(url);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleCopy = async () => {
    if (!baseUrl) return;
    await navigator.clipboard.writeText(baseUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h6">{t('dashboard.yggdrasil.intro')}</Typography>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>{t('dashboard.yggdrasil.serverAddress')}</Typography>
              <CodeBlock>{baseUrl}</CodeBlock>
              <Button
                variant="contained"
                startIcon={<ContentCopyIcon />}
                onClick={handleCopy}
                sx={{ mt: 2 }}
                fullWidth
              >
                {copied ? t('dashboard.yggdrasil.copied') : t('dashboard.yggdrasil.copyUrl')}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>{t('dashboard.yggdrasil.usageInstructions')}</Typography>
          <Typography variant="body2" component="div">
            <Box component="ol" sx={{ pl: 2, m: 0 }}>
              <li>{t('dashboard.yggdrasil.steps.1')}</li>
              <li>{t('dashboard.yggdrasil.steps.2')}</li>
              <li>{t('dashboard.yggdrasil.steps.3')}</li>
            </Box>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}

const drawerWidth = 240;

interface MenuItem {
  id: string;
  label: string;
  content: string;
  jsxContent?: React.ReactNode;
  icon?: React.ReactNode;
}

export default function PermanentDrawerLeft() {
  useMeta('dash');
  const { t } = useTranslation();
  const [selectedItem, setSelectedItem] = useState<string | null>('Profile');

  // 使用 useMemo 避免每次渲染都重新创建组件实例，配合 display: none 实现真正的“无刷新”切换
  const baseItems: MenuItem[] = useMemo(() => [
    { id: 'Profile', label: t('dashboard.sidebar.profile'), content: '', jsxContent: <Profile />, icon: <PersonIcon /> },
    { id: 'Security', label: t('dashboard.sidebar.security'), content: '', jsxContent: <AccountSecurity />, icon: <SecurityIcon /> },
    { id: 'MojangBind', label: t('dashboard.sidebar.mojangBind'), content: '', jsxContent: <MojangBindDashboard />, icon: <VpnKeyIcon /> },
    { id: 'Yggdrasil API', label: t('dashboard.sidebar.yggdrasil'), content: '', jsxContent: <YggdrasilDashboard />, icon: <ApiIcon /> },
  ], [t]);

  // 构建期注入的 SDK Dashboard 项：追加为左侧菜单项，内容区直接渲染其 element。
  const serviceItems: MenuItem[] = useMemo(
    () =>
      sdkDashboardItems.map((item) => ({
        id: item.key,
        label: item.label,
        content: '',
        jsxContent: item.element,
        icon: <ApiIcon />,
      })),
    []
  );

  const allItems: MenuItem[] = useMemo(() => [...baseItems, ...serviceItems], [baseItems, serviceItems]);
  const selected = allItems.find((item) => item.id === selectedItem) ?? null;

  return (
    <Box sx={{ display: 'flex', gap: 2, minHeight: 'calc(100vh - 64px)' }}>
      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            position: 'relative',
            height: '100%',
            border: 'none',
            borderRadius: 0,
            backgroundColor: 'transparent',
            boxShadow: 'none',
            overflow: 'visible',
          },
        }}
        variant="permanent"
        anchor="left"
      >
        <Toolbar sx={{ minHeight: 20 }} />
        <List sx={{ py: 1, pr: 1.5 }}>
          {allItems.map((item, index) => (
            <React.Fragment key={item.id}>
              {serviceItems.length > 0 && index === baseItems.length && (
                <Divider sx={{ my: 1.25, mr: 1.5, borderColor: alpha('#1d1b20', 0.08) }} />
              )}
              <ListItem disablePadding sx={{ my: 0.25, borderRadius: 999 }}>
                <ListItemButton
                  selected={selectedItem === item.id}
                  onClick={() => setSelectedItem(item.id)}
                  sx={{
                    minHeight: 48,
                    px: 1.75,
                    borderRadius: 999,
                    '&.Mui-selected': {
                      bgcolor: alpha('#6750a4', 0.08),
                      color: 'primary.main',
                      '& .MuiListItemText-primary': {
                        fontWeight: 600,
                      },
                      '& .MuiListItemIcon-root': {
                        color: 'primary.main',
                      },
                      '&:hover': {
                        bgcolor: alpha('#6750a4', 0.12),
                      },
                    },
                    '&:hover': {
                      bgcolor: alpha('#6750a4', 0.05),
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40, color: 'text.secondary' }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    slotProps={{
                      primary: {
                        variant: 'body2',
                      },
                    }}
                  />
                </ListItemButton>
              </ListItem>
            </React.Fragment>
          ))}
        </List>
      </Drawer>
      <Box
        component="main"
        sx={{ flexGrow: 1, minWidth: 0, p: 3 }}
      >
        <Typography variant="h5" sx={{ marginBottom: 2 }}>
          {selected?.label}
        </Typography>
        
        {/* Render all tabs to avoid re-mounting flicker, using display: none for inactive ones */}
        {/* 包一层 Suspense：构建期注入的 SDK element 可能含 React.lazy 懒加载组件。 */}
        <Suspense
          fallback={
            <Box sx={{ py: 4, display: 'grid', placeItems: 'center' }}>
              <CircularProgress color="secondary" size={32} />
            </Box>
          }
        >
          {allItems.map((item) => (
            <Box
              key={item.id}
              sx={{ display: selectedItem === item.id ? 'block' : 'none' }}
            >
              {item.jsxContent ?? (
                <Typography sx={{ whiteSpace: 'pre-line' }}>
                  {item.content}
                </Typography>
              )}
            </Box>
          ))}
        </Suspense>
      </Box>
    </Box>
  );
}
