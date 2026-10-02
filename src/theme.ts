import { alpha, createTheme } from '@mui/material/styles';

const primaryMain = '#7c8cff';
const primaryLight = '#a4b3ff';
const primaryDark = '#5e6ae6';
const accentMain = '#45d0ff';
const successMain = '#59d38c';
const warningMain = '#ffb86b';
const backgroundDefault = '#08101f';
const backgroundPaper = '#12192d';

export const appTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: primaryMain,
      light: primaryLight,
      dark: primaryDark,
    },
    secondary: {
      main: accentMain,
    },
    success: {
      main: successMain,
    },
    warning: {
      main: warningMain,
    },
    background: {
      default: backgroundDefault,
      paper: alpha(backgroundPaper, 0.88),
    },
    divider: alpha('#d7e3ff', 0.12),
    text: {
      primary: '#f4f7ff',
      secondary: alpha('#f4f7ff', 0.72),
    },
  },
  shape: {
    borderRadius: 16,
  },
  typography: {
    fontFamily: [
      'Inter',
      '"Segoe UI"',
      '"PingFang SC"',
      '"Microsoft YaHei"',
      'system-ui',
      'sans-serif',
    ].join(','),
    h1: {
      fontSize: 'clamp(2.8rem, 7vw, 4.8rem)',
      fontWeight: 800,
      letterSpacing: '-0.04em',
      lineHeight: 1.02,
    },
    h2: {
      fontWeight: 800,
      letterSpacing: '-0.03em',
    },
    h3: {
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    h4: {
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    button: {
      fontWeight: 700,
      letterSpacing: '0.01em',
      textTransform: 'none',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: backgroundDefault,
          backgroundImage: [
            'radial-gradient(circle at top left, rgba(69, 208, 255, 0.16), transparent 28%)',
            'radial-gradient(circle at 80% 10%, rgba(124, 140, 255, 0.22), transparent 24%)',
            'linear-gradient(180deg, #0b1223 0%, #08101f 100%)',
          ].join(','),
          backgroundAttachment: 'fixed',
        },
        '::selection': {
          backgroundColor: alpha(accentMain, 0.35),
          color: '#f7fbff',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: `1px solid ${alpha('#d7e3ff', 0.08)}`,
          backdropFilter: 'blur(18px)',
          boxShadow: `0 24px 80px ${alpha('#000814', 0.3)}`,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: `1px solid ${alpha('#d7e3ff', 0.08)}`,
          backgroundColor: alpha(backgroundPaper, 0.78),
          boxShadow: `0 20px 60px ${alpha('#000814', 0.28)}`,
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 14,
          paddingInline: 18,
          minHeight: 44,
        },
        containedPrimary: {
          backgroundImage: `linear-gradient(135deg, ${primaryMain} 0%, ${accentMain} 100%)`,
          boxShadow: `0 14px 32px ${alpha(primaryMain, 0.28)}`,
        },
        outlined: {
          borderColor: alpha('#d7e3ff', 0.16),
          backgroundColor: alpha('#ffffff', 0.02),
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          border: `1px solid ${alpha('#d7e3ff', 0.12)}`,
          backgroundColor: alpha('#ffffff', 0.04),
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: alpha('#ffffff', 0.03),
          '& fieldset': {
            borderColor: alpha('#d7e3ff', 0.12),
          },
          '&:hover fieldset': {
            borderColor: alpha('#d7e3ff', 0.22),
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: alpha(backgroundPaper, 0.82),
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: alpha(backgroundPaper, 0.94),
          borderRadius: 16,
        },
      },
    },
  },
});
