import { useState, useEffect } from 'react';
import { AppBar, Toolbar, Typography, Button, Avatar, Menu, MenuItem, IconButton } from "@mui/material";
import { Link, useNavigate } from "react-router-dom";
import { request } from '../utils/api';
import { getAuthToken, getUserEmail, clearAuthCookies } from '../utils/cookie';
import { BackendUrl } from '../utils/config';
import { getDiscoveredServices, getServiceSDK, onSDKLoaded } from '../utils/serviceRegistry';
import type { ServiceSummary } from '../api/services';
import type { ServiceSDK, ServiceSDKMenu } from '../types/service-sdk';

export default function Navbar() {
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
    <AppBar position="static">
      <Toolbar>
        <Typography
          variant="h6"
          sx={{ flexGrow: 1 }}
          component={Link}
          to="/"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          HRPAuth
        </Typography>

        {isLoggedIn ? (
          <>
            <IconButton
              onClick={handleMenuOpen}
              color="inherit"
              sx={{ ml: 1 }}
            >
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
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
                Dashboard
              </MenuItem>
              <MenuItem component={Link} to="/dashdebug" onClick={handleMenuClose}>
                Debug
              </MenuItem>
              <MenuItem component={Link} to="/skinlib" onClick={handleMenuClose}>
                SkinLib
              </MenuItem>
              {/* 微服务通过 SDK 声明的菜单项 */}
              {getDiscoveredServices()
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
                Logout
              </MenuItem>
            </Menu>
          </>
        ) : (
          <>
            <Button color="inherit" component={Link} to="/login">
              Login
            </Button>
            <Button color="inherit" component={Link} to="/register">
              Register
            </Button>
          </>
        )}
      </Toolbar>
    </AppBar>
  );
}
