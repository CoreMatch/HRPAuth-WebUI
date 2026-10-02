import { alpha, createTheme } from '@mui/material/styles';

const primaryMain = '#4f6bdc';
const primaryLight = '#7f95eb';
const primaryDark = '#3d56b1';
const accentMain = '#2c8ca3';
const successMain = '#3fa76c';
const warningMain = '#c9892f';
const backgroundDefault = '#f5f7fb';
const backgroundPaper = '#ffffff';
const textPrimary = '#172033';
const textSecondary = alpha(textPrimary, 0.72);
const borderColor = alpha(textPrimary, 0.1);

export const appTheme = createTheme({
  palette: {
    mode: 'light',
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
      paper: alpha(backgroundPaper, 0.9),
    },
    divider: borderColor,
    text: {
      primary: textPrimary,
      secondary: textSecondary,
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
            'radial-gradient(circle at top left, rgba(79, 107, 220, 0.08), transparent 24%)',
            'radial-gradient(circle at 100% 0%, rgba(44, 140, 163, 0.06), transparent 18%)',
          ].join(','),
          backgroundAttachment: 'fixed',
        },
        '::selection': {
          backgroundColor: alpha(primaryMain, 0.18),
          color: textPrimary,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: `1px solid ${borderColor}`,
          backdropFilter: 'blur(16px)',
          boxShadow: `0 18px 48px ${alpha('#15203b', 0.08)}`,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: `1px solid ${borderColor}`,
          backgroundColor: alpha(backgroundPaper, 0.84),
          boxShadow: `0 18px 44px ${alpha('#15203b', 0.06)}`,
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
          backgroundColor: primaryMain,
          color: '#ffffff',
          boxShadow: `0 10px 24px ${alpha(primaryMain, 0.16)}`,
          '&:hover': {
            backgroundColor: primaryDark,
          },
        },
        outlined: {
          borderColor: alpha(textPrimary, 0.14),
          backgroundColor: alpha('#ffffff', 0.75),
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          border: `1px solid ${alpha(textPrimary, 0.1)}`,
          backgroundColor: alpha('#ffffff', 0.8),
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: alpha('#ffffff', 0.78),
          '& fieldset': {
            borderColor: alpha(textPrimary, 0.12),
          },
          '&:hover fieldset': {
            borderColor: alpha(textPrimary, 0.2),
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: alpha(backgroundPaper, 0.92),
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: alpha(backgroundPaper, 0.96),
          borderRadius: 16,
        },
      },
    },
  },
});
