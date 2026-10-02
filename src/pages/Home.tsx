import { Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { alpha } from '@mui/material/styles';
import { Trans } from 'react-i18next';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import StyleOutlinedIcon from '@mui/icons-material/StyleOutlined';
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded';
import logo from "/revolution.png";
import { useMeta } from '../hooks/useMeta';
import { getAuthToken } from '../utils/cookie';

export default function Home() {
  useMeta('home');
  const { t } = useTranslation();
  const isLoggedIn = Boolean(getAuthToken());

  const features = [
    {
      icon: <ShieldOutlinedIcon color="secondary" />,
      title: t('home.featureSecurityTitle'),
      description: t('home.featureSecurityDescription'),
    },
    {
      icon: <HubOutlinedIcon color="secondary" />,
      title: t('home.featureServiceTitle'),
      description: t('home.featureServiceDescription'),
    },
    {
      icon: <StyleOutlinedIcon color="secondary" />,
      title: t('home.featureAssetTitle'),
      description: t('home.featureAssetDescription'),
    },
  ];

  return (
    <Box sx={{ px: { xs: 1, md: 2 }, pt: { xs: 2, md: 4 } }}>
      <Box
        sx={{
          maxWidth: 1240,
          mx: 'auto',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.1fr) minmax(380px, 0.9fr)' },
          gap: { xs: 3, md: 4 },
          alignItems: 'stretch',
        }}
      >
        <Box
          sx={{
            py: { xs: 3, md: 5 },
            pr: { lg: 3 },
          }}
        >
          <Chip label={t('home.badge')} sx={{ mb: 2 }} />

          <Typography id="home-header" variant="h1" sx={{ maxWidth: 720, mb: 2.5 }}>
            <Trans
              i18nKey="home.title"
              components={{
                1: (
                  <Box
                    component="span"
                    sx={{
                      color: 'secondary.main',
                      textShadow: `0 0 24px ${alpha('#45d0ff', 0.24)}`,
                    }}
                  />
                ),
              }}
            />
          </Typography>

          <Typography
            variant="h6"
            color="text.secondary"
            sx={{ maxWidth: 760, fontWeight: 400, lineHeight: 1.7, mb: 3.5 }}
          >
            <Trans
              i18nKey="home.description"
              components={{
                2: (
                  <Box
                    component="a"
                    href="//mc.samuelchest.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      color: 'secondary.main',
                      textDecoration: 'none',
                    }}
                  />
                ),
              }}
            />
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 3 }}>
            <Button
              variant="contained"
              size="large"
              component={Link}
              to={isLoggedIn ? '/dash' : '/login'}
              endIcon={<ArrowOutwardRoundedIcon />}
            >
              {t(isLoggedIn ? 'home.primaryActionAuth' : 'home.primaryActionGuest')}
            </Button>
            <Button variant="outlined" size="large" component={Link} to="/skinlib">
              {t('home.secondaryAction')}
            </Button>
          </Stack>

          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 4.5 }}>
            <Chip label={t('home.pillSecurity')} />
            <Chip label={t('home.pillServices')} />
            <Chip label={t('home.pillAssets')} />
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
              gap: 2,
            }}
          >
            {features.map((feature) => (
              <Card key={feature.title}>
                <CardContent sx={{ p: 2.5 }}>
                  <Box sx={{ mb: 1.5 }}>{feature.icon}</Box>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.75 }}>
                    {feature.description}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Card
            sx={{
              width: '100%',
              overflow: 'hidden',
              position: 'relative',
              minHeight: { xs: 420, md: 540 },
            }}
          >
            <Box
              aria-hidden
              sx={{
                position: 'absolute',
                inset: 0,
                background: `
                  radial-gradient(circle at top right, ${alpha('#45d0ff', 0.18)}, transparent 28%),
                  radial-gradient(circle at bottom left, ${alpha('#7c8cff', 0.24)}, transparent 32%)
                `,
              }}
            />
            <Box
              aria-hidden
              sx={{
                position: 'absolute',
                top: 28,
                right: 28,
                width: { xs: 180, md: 260 },
                aspectRatio: '1 / 1',
                backgroundImage: `url(${logo})`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                backgroundSize: 'contain',
                opacity: 0.92,
                filter: 'drop-shadow(0 18px 42px rgba(69, 208, 255, 0.2))',
              }}
            />
            <Box
              sx={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: '100%',
                p: { xs: 2.5, md: 3.5 },
              }}
            >
              <Box
                sx={{
                  maxWidth: 260,
                  p: 2.25,
                  borderRadius: 3,
                  backgroundColor: alpha('#0b1223', 0.62),
                  border: `1px solid ${alpha('#d7e3ff', 0.1)}`,
                }}
              >
                <Typography variant="overline" color="secondary.main">
                  {t('home.panelTitle')}
                </Typography>
                <Stack spacing={1.75} sx={{ mt: 1.25 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {t('home.panelStatus')}
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>
                      {t('home.panelStatusValue')}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {t('home.panelServices')}
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>
                      {t('home.panelServicesValue')}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {t('home.panelAssets')}
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>
                      {t('home.panelAssetsValue')}
                    </Typography>
                  </Box>
                </Stack>
              </Box>

              <Box
                sx={{
                  alignSelf: 'flex-end',
                  width: 'min(100%, 320px)',
                  p: 2.5,
                  borderRadius: 3,
                  backgroundColor: alpha('#0b1223', 0.72),
                  border: `1px solid ${alpha('#d7e3ff', 0.1)}`,
                }}
              >
                <Typography variant="h5" sx={{ mb: 1 }}>
                  HRPAuth
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                  {t('home.panelFootnote')}
                </Typography>
              </Box>
            </Box>
          </Card>
        </Box>
      </Box>
    </Box>
  );
}
