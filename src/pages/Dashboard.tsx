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
}

const menuItems: MenuItem[] = [
  { id: 'Yggdrasil API', label: 'Yggdrasil API', content: '', jsxContent: <YggdrasilDashboard />, icon: <ApiIcon /> },
  { id: 'CustomSkinLoader', label: 'CustomSkinLoader', content: '', icon: <FaceIcon /> },
];

export default function PermanentDrawerLeft() {
  const [selectedItem, setSelectedItem] = useState<string | null>('Yggdrasil API');

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
          {menuItems.map((item) => (
            <ListItem key={item.id} disablePadding sx={{ mx: 1, my: 0.5, borderRadius: 1 }}>
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
          ))}
        </List>
      </Drawer>
      <Box
        component="main"
        sx={{ flexGrow: 1, bgcolor: 'background.default', p: 3 }}
      >
        <Typography variant="h5" sx={{ marginBottom: 2 }}>
          {menuItems.find(item => item.id === selectedItem)?.label}
        </Typography>
        {menuItems.find(item => item.id === selectedItem)?.jsxContent ?? (
          <Typography sx={{ whiteSpace: 'pre-line' }}>
            {menuItems.find(item => item.id === selectedItem)?.content}
          </Typography>
        )}
      </Box>
    </Box>
  );
}