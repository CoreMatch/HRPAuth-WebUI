import { useEffect } from 'react';
import { Box, Typography } from "@mui/material";
import { Trans } from 'react-i18next';
import { useTranslation } from 'react-i18next';
import { useMeta } from '../hooks/useMeta';
import { dataCache } from '../utils/dataCache';

export default function Home() {
  useMeta('home');
  const { t } = useTranslation();

  useEffect(() => {
    // 门户页加载完成后，异步预加载控制面板所需数据
    dataCache.prefetch();
  }, []);

  return (
    <Box sx={{ px: { xs: 1, md: 2 }, pt: { xs: 4, md: 8 } }}>
      <Box
        sx={{
          maxWidth: 920,
          mx: 'auto',
          minHeight: { xs: 'auto', md: 'calc(100vh - 220px)' },
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Box
          sx={{
            py: { xs: 4, md: 6 },
          }}
        >
          <Typography
            variant="overline"
            color="secondary.main"
            sx={{ letterSpacing: '0.12em', display: 'block', mb: 2 }}
          >
            {t('home.badge')}
          </Typography>

          <Typography id="home-header" variant="h1" sx={{ maxWidth: 680, mb: 2.5 }}>
            <Trans
              i18nKey="home.title"
              components={{
                1: <Box component="span" sx={{ color: 'primary.main' }} />,
              }}
            />
          </Typography>

          <Typography
            variant="h6"
            color="text.secondary"
            sx={{ maxWidth: 700, fontWeight: 400, lineHeight: 1.75, mb: 3.5 }}
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

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              maxWidth: 620,
              lineHeight: 1.8,
              letterSpacing: '0.01em',
            }}
          >
            {t('home.panelFootnote')}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
