import { alpha, createTheme } from '@mui/material/styles';

const primaryMain = '#6750a4';
const primaryLight = '#7f67be';
const primaryDark = '#4f378b';
const accentMain = '#006a6b';
const successMain = '#146c2e';
const warningMain = '#9a6700';
const backgroundDefault = '#f8f7fb';
const backgroundPaper = '#fffbfe';
const textPrimary = '#1d1b20';
const textSecondary = '#49454f';
const outlineColor = '#cac4d0';
const surfaceVariant = '#e7e0ec';

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
      paper: backgroundPaper,
    },
    divider: outlineColor,
    text: {
      primary: textPrimary,
      secondary: textSecondary,
    },
  },
  shape: {
    borderRadius: 20,
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
    h6: {
      fontWeight: 500,
      lineHeight: 1.6,
    },
    button: {
      fontWeight: 500,
      letterSpacing: 0,
      textTransform: 'none',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: backgroundDefault,
          backgroundImage: `linear-gradient(180deg, ${alpha(primaryMain, 0.04)} 0px, transparent 220px)`,
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
          border: `1px solid ${alpha(outlineColor, 0.72)}`,
          boxShadow: `0 1px 3px ${alpha('#000000', 0.12)}`,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: 'none',
          backgroundColor: backgroundPaper,
          boxShadow: `0 1px 3px ${alpha('#000000', 0.14)}`,
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 20,
          paddingInline: 20,
          minHeight: 40,
        },
        containedPrimary: {
          backgroundColor: primaryMain,
          color: '#ffffff',
          boxShadow: `0 1px 2px ${alpha('#000000', 0.18)}`,
          '&:hover': {
            backgroundColor: primaryDark,
            boxShadow: `0 2px 4px ${alpha('#000000', 0.18)}`,
          },
        },
        outlined: {
          borderColor: outlineColor,
          backgroundColor: backgroundPaper,
        },
        text: {
          color: primaryMain,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          border: `1px solid ${outlineColor}`,
          backgroundColor: surfaceVariant,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: backgroundPaper,
          borderRadius: 16,
          '& fieldset': {
            borderColor: outlineColor,
          },
          '&:hover fieldset': {
            borderColor: textSecondary,
          },
          '&.Mui-focused fieldset': {
            borderWidth: 2,
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: backgroundPaper,
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: backgroundPaper,
          borderRadius: 16,
        },
      },
    },
  },
});
