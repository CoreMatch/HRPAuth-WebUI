import { IconButton, Menu, MenuItem, Tooltip } from '@mui/material';
import LanguageIcon from '@mui/icons-material/Language';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES, type SupportedLanguage } from '../i18n';

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const current = (i18n.resolvedLanguage || i18n.language || 'zh-CN') as SupportedLanguage;

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => setAnchorEl(null);

  const handleSelect = (lng: SupportedLanguage) => {
    void i18n.changeLanguage(lng);
    handleClose();
  };

  return (
    <>
      <Tooltip title={t('navbar.language')}>
        <IconButton color="inherit" onClick={handleOpen} sx={{ ml: 1 }}>
          <LanguageIcon />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {SUPPORTED_LANGUAGES.map((lng) => (
          <MenuItem
            key={lng}
            selected={lng === current}
            onClick={() => handleSelect(lng)}
          >
            {LANGUAGE_LABELS[lng]}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}