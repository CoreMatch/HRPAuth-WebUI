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
import Captcha, { type CaptchaRef } from '../components/Captcha';
import { validateEmail } from '../utils/email';
import { register } from '../api/register';
import type { RegisterRequest } from '../types/register';

export default function Register() {
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
      setError('请输入有效的邮箱地址');
      return false;
    }

    if (!formData.username || formData.username.trim().length < 3) {
      setError('用户名太短，至少需要3个字符');
      return false;
    }

    if (!formData.password || formData.password.length < 6) {
      setError('密码太短，至少需要6个字符');
      return false;
    }

    if (formData.password !== formData.password2) {
      setError('两次输入的密码不一致');
      return false;
    }

    // Captcha is only required when the backend has it enabled.
    const captchaRequired = captchaRef.current?.isEnabled() ?? false;
    if (captchaRequired) {
      if (!captchaCode || captchaCode.trim().length === 0) {
        setError('请输入验证码');
        setCaptchaError(true);
        return false;
      }
      if (!captchaRef.current?.getToken()) {
        setError('验证码尚未加载完成，请稍候');
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
        setSuccess(true);
        setTimeout(() => navigate('/login'), 1500);
      } else {
        // Per API doc: 400 "Invalid or expired captcha" -> refresh and re-prompt.
        if (result.code === 'invalid_captcha') {
          setCaptchaError(true);
          setError(result.message || '验证码错误或已过期，请重新输入');
          await captchaRef.current?.refresh();
          setCaptchaCode('');
        } else {
          setError(result.message || '注册失败');
          // Always refresh captcha on a failed attempt to avoid reuse of a
          // possibly-burned token.
          await captchaRef.current?.refresh();
          setCaptchaCode('');
        }
      }
    } catch {
      setError('网络错误：无法连接到后端');
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
        注册
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success ? (
        <Alert severity="success">注册成功，正在跳转到登录页…</Alert>
      ) : (
        <form onSubmit={handleSubmit}>
          <TextField
            label="邮箱"
            type="email"
            value={formData.email}
            onChange={handleInputChange('email')}
            required
            fullWidth
            sx={{ mb: 2 }}
            disabled={loading}
            placeholder="请输入邮箱地址"
          />

          <TextField
            label="用户名"
            value={formData.username}
            onChange={handleInputChange('username')}
            required
            fullWidth
            sx={{ mb: 2 }}
            disabled={loading}
            placeholder="请输入用户名"
          />

          <TextField
            label="密码"
            type="password"
            value={formData.password}
            onChange={handleInputChange('password')}
            required
            fullWidth
            sx={{ mb: 2 }}
            disabled={loading}
            placeholder="请输入密码（至少6个字符）"
          />

          <TextField
            label="确认密码"
            type="password"
            value={formData.password2}
            onChange={handleInputChange('password2')}
            required
            fullWidth
            sx={{ mb: 2 }}
            disabled={loading}
            placeholder="请再次输入密码"
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
              '注册'
            )}
          </Button>

          <Button
            variant="text"
            onClick={handleCaptchaRefresh}
            disabled={loading}
            fullWidth
            sx={{ mt: 1 }}
          >
            刷新验证码
          </Button>
        </form>
      )}
    </Box>
  );
}
