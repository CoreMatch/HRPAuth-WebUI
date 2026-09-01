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
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ApiIcon from '@mui/icons-material/Api';
import FaceIcon from '@mui/icons-material/Face';
import { getRealBackendUrl } from '../utils/config';
import { useMeta } from '../hooks/useMeta';
import PersonIcon from '@mui/icons-material/Person';
import Profile from './Profile';
import { getDiscoveredServices, getServiceSDK, onSDKLoaded } from '../utils/serviceRegistry';
import type { ServiceSummary } from '../api/services';
import type { ServiceSDK, ServiceSDKDashboard } from '../types/service-sdk';

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
      <Typography variant="h6">There is a built-in Yggdrasil API service (Zggdrasil) available.</Typography>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>Server Address</Typography>
              <CodeBlock>{baseUrl}</CodeBlock>
              <Button
                variant="contained"
                startIcon={<ContentCopyIcon />}
                onClick={handleCopy}
                sx={{ mt: 2 }}
                fullWidth
              >
                {copied ? 'Copied!' : 'Copy URL'}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>Usage Instructions</Typography>
          <Typography variant="body2" component="div">
            <Box component="ol" sx={{ pl: 2, m: 0 }}>
              <li>Add the server address to your Minecraft launcher</li>
              <li>Use your credentials to authenticate</li>
              <li>Skins and capes will be loaded automatically</li>
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
  /** 微服务动态项：内容区 iframe 嵌入地址 */
  url?: string;
}

const menuItems: MenuItem[] = [
  { id: 'Profile', label: 'Profile', content: '', jsxContent: <Profile />, icon: <PersonIcon /> },
  { id: 'Yggdrasil API', label: 'Yggdrasil API', content: '', jsxContent: <YggdrasilDashboard />, icon: <ApiIcon /> },
  { id: 'CustomSkinLoader', label: 'CustomSkinLoader', content: '', icon: <FaceIcon /> },
];

export default function PermanentDrawerLeft() {
  useMeta('dash');
  const [selectedItem, setSelectedItem] = useState<string | null>('Profile');
  const [, setSdkTick] = useState(0);

  // 微服务 SDK 异步加载，加载完成后重渲染以读取其 dashboard 声明。
  useEffect(() => {
    return onSDKLoaded(() => setSdkTick((t) => t + 1));
  }, []);

  // 声明了 dashboard 的微服务：追加为左侧菜单项，内容区 iframe 嵌入。
  const serviceItems: MenuItem[] = getDiscoveredServices()
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

  const allItems: MenuItem[] = [...menuItems, ...serviceItems];
  const selected = allItems.find((item) => item.id === selectedItem) ?? null;

  return (
    <Box sx={{ display: 'flex', minHeight: 'calc(100vh - 64px)' }}>
      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            position: 'relative',
            height: '100%',
            borderRight: '1px solid',
            borderColor: 'divider',
          },
        }}
        variant="permanent"
        anchor="left"
      >
        <Toolbar />
        <Divider />
        <List sx={{ py: 1 }}>
          {allItems.map((item, index) => (
            <React.Fragment key={item.id}>
              {serviceItems.length > 0 && index === menuItems.length && (
                <Divider sx={{ my: 1 }} />
              )}
              <ListItem disablePadding sx={{ mx: 1, my: 0.5, borderRadius: 1 }}>
                <ListItemButton
                  selected={selectedItem === item.id}
                  onClick={() => setSelectedItem(item.id)}
                  sx={{
                    borderRadius: 1,
                    '&.Mui-selected': {
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      '& .MuiListItemIcon-root': {
                        color: 'primary.contrastText',
                      },
                      '&:hover': {
                        bgcolor: 'primary.dark',
                      },
                    },
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            </React.Fragment>
          ))}
        </List>
      </Drawer>
      <Box
        component="main"
        sx={{ flexGrow: 1, bgcolor: 'background.default', p: 3 }}
      >
        <Typography variant="h5" sx={{ marginBottom: 2 }}>
          {selected?.label}
        </Typography>
        {selected?.url ? (
          <iframe
            title={selected.label}
            src={selected.url}
            style={{
              width: '100%',
              height: 'calc(100vh - 160px)',
              border: 'none',
              borderRadius: 8,
            }}
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