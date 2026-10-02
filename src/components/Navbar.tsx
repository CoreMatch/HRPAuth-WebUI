import { useState, useEffect } from 'react';
import { Avatar, Box, Button, IconButton, Menu, MenuItem, Stack, Typography } from "@mui/material";
import { alpha } from '@mui/material/styles';
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from 'react-i18next';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import CollectionsOutlinedIcon from '@mui/icons-material/CollectionsOutlined';
import LanguageSwitcher from './LanguageSwitcher';
import { request } from '../utils/api';
import { getAuthToken, getUserEmail, clearAuthCookies } from '../utils/cookie';
import { BackendUrl } from '../utils/config';
import { getDiscoveredServicesByArea, getServiceSDK, onSDKLoaded } from '../utils/serviceRegistry';
import type { ServiceSummary } from '../api/services';
import type { ServiceSDK, ServiceSDKMenu } from '../types/service-sdk';

export default function Navbar() {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [, setSdkTick] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = () => {
      const token = getAuthToken();
      setIsLoggedIn(!!token);
    };

    checkAuth();
    const interval = setInterval(checkAuth, 1000);

    return () => clearInterval(interval);
  }, []);

  // 微服务 SDK 异步加载，加载完成后重渲染以读取其 menu 声明。
  useEffect(() => {
    return onSDKLoaded(() => setSdkTick((t) => t + 1));
  }, []);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    try {
      await request(`${BackendUrl}/logout`, { method: 'GET' });
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      clearAuthCookies();
      setIsLoggedIn(false);
      handleMenuClose();
      navigate('/');
    }
  };

  const userEmail = getUserEmail();
  const userInitial = userEmail ? userEmail.charAt(0).toUpperCase() : 'U';

  return (
    <Box
      component="header"
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        px: { xs: 1.5, md: 2.5 },
        pt: 2,
        pb: 1.5,
      }}
    >
      <Box
        sx={{
          maxWidth: 1280,
          mx: 'auto',
          px: { xs: 2, md: 2.5 },
          py: 1.25,
          borderRadius: 4,
          border: `1px solid ${alpha('#cac4d0', 0.9)}`,
          backgroundColor: '#fffbfe',
          boxShadow: `0 1px 3px ${alpha('#000000', 0.12)}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box
          component={Link}
          to="/"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            color: 'inherit',
            minWidth: 0,
          }}
        >
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: 2.5,
              display: 'grid',
              placeItems: 'center',
              backgroundColor: alpha('#6750a4', 0.08),
            }}
          >
            <ShieldOutlinedIcon sx={{ color: 'primary.main' }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ lineHeight: 1.05, fontWeight: 800 }}>
              HRPAuth
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
              {t('navbar.tagline')}
            </Typography>
          </Box>
        </Box>

        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
          <LanguageSwitcher />

          {isLoggedIn ? (
            <>
              <Button
                variant="text"
                color="primary"
                component={Link}
                to="/dash"
                startIcon={<DashboardOutlinedIcon />}
                sx={{ display: { xs: 'none', md: 'inline-flex' } }}
              >
                {t('navbar.dashboard')}
              </Button>
              <Button
                variant="outlined"
                component={Link}
                to="/skinlib"
                startIcon={<CollectionsOutlinedIcon />}
                sx={{ display: { xs: 'none', md: 'inline-flex' } }}
              >
                {t('navbar.skinlib')}
              </Button>
              <IconButton onClick={handleMenuOpen} sx={{ ml: 0.5 }}>
                <Avatar
                  sx={{
                    width: 36,
                    height: 36,
                    bgcolor: 'primary.main',
                    color: '#ffffff',
                    fontWeight: 800,
                  }}
                >
                  {userInitial}
                </Avatar>
              </IconButton>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
              >
                <MenuItem component={Link} to="/dash" onClick={handleMenuClose}>
                  {t('navbar.dashboard')}
                </MenuItem>
                <MenuItem component={Link} to="/dashdebug" onClick={handleMenuClose}>
                  {t('navbar.debug')}
                </MenuItem>
                <MenuItem component={Link} to="/skinlib" onClick={handleMenuClose}>
                  {t('navbar.skinlib')}
                </MenuItem>
                {getDiscoveredServicesByArea('webui-service')
                  .map((svc) => ({ svc, sdk: getServiceSDK(svc.name) }))
                  .filter(
                    (item): item is { svc: ServiceSummary; sdk: ServiceSDK & { menu: ServiceSDKMenu } } =>
                      item.sdk?.menu != null
                  )
                  .map(({ svc, sdk }) => (
                    <MenuItem
                      key={svc.name}
                      component={Link}
                      to={`/service/${encodeURIComponent(svc.name)}`}
                      onClick={handleMenuClose}
                    >
                      {sdk.menu.label}
                    </MenuItem>
                  ))}
                <MenuItem onClick={handleLogout}>
                  {t('navbar.logout')}
                </MenuItem>
              </Menu>
            </>
          ) : (
            <>
              <Button variant="text" color="inherit" component={Link} to="/login">
                {t('navbar.login')}
              </Button>
              <Button variant="contained" color="primary" component={Link} to="/register">
                {t('navbar.register')}
              </Button>
            </>
          )}
        </Stack>
      </Box>
    </Box>
  );
}
