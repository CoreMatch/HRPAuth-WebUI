import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';
import Navbar from "./Navbar";
import { Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <Box sx={{ minHeight: '100vh', position: 'relative' }}>
      <Box
        aria-hidden
        sx={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          background: `linear-gradient(180deg, ${alpha('#6750a4', 0.05)} 0px, transparent 240px)`,
        }}
      />
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Navbar />
        <Box
          component="main"
          sx={{
            width: 'min(1280px, calc(100% - 24px))',
            mx: 'auto',
            px: { xs: 1, md: 2 },
            pb: { xs: 5, md: 8 },
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
