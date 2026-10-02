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
          backgroundImage: `
            linear-gradient(${alpha('#172033', 0.03)} 1px, transparent 1px),
            linear-gradient(90deg, ${alpha('#172033', 0.03)} 1px, transparent 1px)
          `,
          backgroundSize: '56px 56px',
          maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.45), transparent 88%)',
        }}
      />
      <Box
        aria-hidden
        sx={{
          position: 'fixed',
          top: -120,
          left: -80,
          width: 360,
          height: 360,
          borderRadius: '50%',
          pointerEvents: 'none',
          bgcolor: alpha('#4f6bdc', 0.08),
          filter: 'blur(100px)',
        }}
      />
      <Box
        aria-hidden
        sx={{
          position: 'fixed',
          right: -60,
          top: 120,
          width: 320,
          height: 320,
          borderRadius: '50%',
          pointerEvents: 'none',
          bgcolor: alpha('#2c8ca3', 0.07),
          filter: 'blur(100px)',
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
