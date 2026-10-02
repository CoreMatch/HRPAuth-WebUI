import React, { useState, useEffect } from 'react';
import Drawer from '@mui/material/Drawer';
import Toolbar from '@mui/material/Toolbar';
import List from '@mui/material/List';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { Box, Card, CardContent, Grid, Button } from "@mui/material";
import { alpha } from '@mui/material/styles';
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ApiIcon from '@mui/icons-material/Api';
import { getRealBackendUrl } from '../utils/config';
import { useMeta } from '../hooks/useMeta';
import PersonIcon from '@mui/icons-material/Person';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import Profile from './Profile';
import MojangBindDashboard from './MojangBindDashboard';
import { getDiscoveredServicesByArea, getServiceSDK, onSDKLoaded } from '../utils/serviceRegistry';
import type { ServiceSummary } from '../api/services';
import type { ServiceSDK, ServiceSDKDashboard } from '../types/service-sdk';
import ServicePanel from '../components/ServicePanel';
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
  /** 微服务动态项：内容区嵌入地址（优先 mount 组件，回退 iframe） */
  url?: string;
}

export default function PermanentDrawerLeft() {
  useMeta('dash');
  const { t } = useTranslation();
  const [selectedItem, setSelectedItem] = useState<string | null>('Profile');
  const [, setSdkTick] = useState(0);

  // 微服务 SDK 异步加载，加载完成后重渲染以读取其 dashboard 声明。
  useEffect(() => {
    return onSDKLoaded(() => setSdkTick((t) => t + 1));
  }, []);

  const baseItems: MenuItem[] = [
    { id: 'Profile', label: t('dashboard.sidebar.profile'), content: '', jsxContent: <Profile />, icon: <PersonIcon /> },
    { id: 'MojangBind', label: t('dashboard.sidebar.mojangBind'), content: '', jsxContent: <MojangBindDashboard />, icon: <VpnKeyIcon /> },
    { id: 'Yggdrasil API', label: t('dashboard.sidebar.yggdrasil'), content: '', jsxContent: <YggdrasilDashboard />, icon: <ApiIcon /> },
  ];

  // 声明了 dashboard 的微服务：追加为左侧菜单项，内容区动态加载组件（回退 iframe）。
  const serviceItems: MenuItem[] = getDiscoveredServicesByArea('webui-dash')
    .map((svc) => ({ svc, sdk: getServiceSDK(svc.name) }))
    .filter(
      (item): item is { svc: ServiceSummary; sdk: ServiceSDK & { dashboard: ServiceSDKDashboard } } =>
        item.sdk?.dashboard != null
    )
    .flatMap(({ svc, sdk }) => {
      const url = sdk.dashboard.url ?? sdk.iframeUrl;
      return url
        ? [
            {
              id: svc.name,
              label: sdk.dashboard.label,
              content: '',
              url,
              icon: <ApiIcon />,
            } satisfies MenuItem,
          ]
        : [];
    });

  const allItems: MenuItem[] = [...baseItems, ...serviceItems];
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
        {selected?.url ? (
          <ServicePanel
            name={selected.id}
            area="webui-dash"
            url={selected.url}
            height="calc(100vh - 160px)"
          />
        ) : (
          selected?.jsxContent ?? (
            <Typography sx={{ whiteSpace: 'pre-line' }}>
              {selected?.content}
            </Typography>
          )
        )}
      </Box>
    </Box>
  );
}
