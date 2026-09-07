import { useState, useRef } from 'react';
import {
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Captcha, { type CaptchaRef } from '../components/Captcha';
import { validateEmail } from '../utils/email';
import { register } from '../api/register';
import { getLoginTicket } from '../api/auth';
import { completeLogin } from '../utils/auth';
import type { RegisterRequest } from '../types/register';
import { useMeta } from '../hooks/useMeta';

export default function Register() {
  useMeta('register');
  const { t } = useTranslation();
  const [formData, setFormData] = useState<RegisterRequest>({
    email: '',
    username: '',
    password: '',
    password2: '',
  });
  const [captchaCode, setCaptchaCode] = useState('');
  const [captchaError, setCaptchaError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const captchaRef = useRef<CaptchaRef>(null);
  const navigate = useNavigate();

  const handleInputChange = (
    field: keyof RegisterRequest
  ) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  const validate = (): boolean => {
    setError(null);
    setCaptchaError(false);

    if (!formData.email || !validateEmail(formData.email)) {
      setError(t('register.errors.invalidEmail'));
      return false;
    }

    if (!formData.username || formData.username.trim().length < 3) {
      setError(t('register.errors.usernameTooShort'));
      return false;
    }

    if (!formData.password || formData.password.length < 6) {
      setError(t('register.errors.passwordTooShort'));
      return false;
    }

    if (formData.password !== formData.password2) {
      setError(t('register.errors.passwordMismatch'));
      return false;
    }

    const captchaRequired = captchaRef.current?.isEnabled() ?? false;
    if (captchaRequired) {
      if (!captchaCode || captchaCode.trim().length === 0) {
        setError(t('register.errors.captchaRequired'));
        setCaptchaError(true);
        return false;
      }
      if (captchaCode.trim().length !== 4) {
        setError(t('register.errors.captchaLength'));
        setCaptchaError(true);
        return false;
      }
      if (!captchaRef.current?.getToken()) {
        setError(t('register.errors.captchaLoading'));
        setCaptchaError(true);
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setError(null);

    try {
      const { password2, ...rest } = formData;
      const registerData: Omit<RegisterRequest, 'password2'> = {
        email: rest.email,
        username: rest.username,
        password: rest.password,
      };

      // Attach captcha fields only if the backend has captcha enabled.
      if (captchaRef.current?.isEnabled()) {
        const token = captchaRef.current.getToken();
        if (token) {
          registerData.captcha_token = token;
          registerData.captcha_code = captchaCode.trim();
        }
      }

      const result = await register(registerData);

      if (result.success === true) {
        // Auto-login: call login-ticket API with the credentials just registered.
        try {
          const loginRes = await getLoginTicket(formData.email, formData.password);
          if (loginRes.success && loginRes.data) {
            const data = loginRes.data;
            if (data.totp_required) {
              // TOTP required — hand off to the login page with the ticket.
              navigate('/login', {
                state: { login_ticket: data.login_ticket, email: formData.email },
              });
              return;
            }
            if (data.access_token) {
              await completeLogin(data.access_token, data.refresh_token || '', data.uid || '', formData.email);
              setSuccess(true);
              setTimeout(() => navigate('/dash'), 700);
              return;
            }
          }
        } catch {
          // Auto-login failed — fall back to manual login page.
        }
        // Fallback: redirect to login page without credentials.
        setSuccess(true);
        setTimeout(() => navigate('/login'), 1500);
      } else {
        if (result.code === 'invalid_captcha') {
          setCaptchaError(true);
          setError(result.message || t('register.errors.captchaInvalid'));
          await captchaRef.current?.refresh();
          setCaptchaCode('');
        } else if (result.code === 'rate_limit') {
          setError(result.message || t('register.errors.rateLimit'));
          await captchaRef.current?.refresh();
          setCaptchaCode('');
        } else {
          setError(result.message || t('register.errors.registerFailed'));
        }
      }
    } catch {
      setError(t('register.errors.networkError'));
      await captchaRef.current?.refresh();
      setCaptchaCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleCaptchaRefresh = () => {
    void captchaRef.current?.refresh();
  };

  return (
    <Box sx={{ maxWidth: 520 }}>
      <Typography variant="h4" gutterBottom>
        {t('register.title')}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success ? (
        <Alert severity="success">{t('register.successRedirecting')}</Alert>
      ) : (
        <form onSubmit={handleSubmit}>
          <TextField
            label={t('register.emailLabel')}
            type="email"
            value={formData.email}
            onChange={handleInputChange('email')}
            required
            fullWidth
            sx={{ mb: 2 }}
            disabled={loading}
            placeholder={t('register.emailPlaceholder')}
          />

          <TextField
            label={t('register.usernameLabel')}
            value={formData.username}
            onChange={handleInputChange('username')}
            required
            fullWidth
            sx={{ mb: 2 }}
            disabled={loading}
            placeholder={t('register.usernamePlaceholder')}
          />

          <TextField
            label={t('register.passwordLabel')}
            type="password"
            value={formData.password}
            onChange={handleInputChange('password')}
            required
            fullWidth
            sx={{ mb: 2 }}
            disabled={loading}
            placeholder={t('register.passwordPlaceholder')}
          />

          <TextField
            label={t('register.password2Label')}
            type="password"
            value={formData.password2}
            onChange={handleInputChange('password2')}
            required
            fullWidth
            sx={{ mb: 2 }}
            disabled={loading}
            placeholder={t('register.password2Placeholder')}
          />

          <Captcha
            ref={captchaRef}
            value={captchaCode}
            onChange={setCaptchaCode}
            error={captchaError}
          />

          <Button
            variant="contained"
            type="submit"
            disabled={loading}
            fullWidth
            sx={{ mt: 2 }}
          >
            {loading ? (
              <CircularProgress size={24} />
            ) : (
              t('register.submit')
            )}
          </Button>

          <Button
            variant="text"
            onClick={handleCaptchaRefresh}
            disabled={loading}
            fullWidth
            sx={{ mt: 1 }}
          >
            {t('register.refreshCaptcha')}
          </Button>
        </form>
      )}
    </Box>
  );
}