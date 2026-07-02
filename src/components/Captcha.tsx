import {
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useState,
  useCallback,
} from 'react';
import { Box, TextField, Typography, CircularProgress } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  getCaptchaEnabled,
  requestCaptcha,
  type CaptchaFetchResult,
} from '../api/captcha';

export interface CaptchaRef {
  /** Returns the current captcha token, or null if captcha is disabled / not yet loaded. */
  getToken: () => string | null;
  /** Manually refresh the captcha (POST /captcha again). */
  refresh: () => Promise<void>;
  /** Whether the captcha is enabled on the backend. */
  isEnabled: () => boolean;
  /** Whether the captcha is currently loading. */
  isLoading: () => boolean;
}

interface CaptchaProps {
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
}

type Status = 'loading' | 'ready' | 'disabled' | 'error' | 'expired';

const Captcha = forwardRef<CaptchaRef, CaptchaProps>(({ value, onChange, error }, ref) => {
  const [status, setStatus] = useState<Status>('loading');
  const [token, setToken] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  // Bumped on every refresh to force <img> to refetch the same URL.
  const [imageKey, setImageKey] = useState(0);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setErrorMsg('');
    try {
      // Per API doc section 4.4: query the backend captcha toggle first
      // (GET /captcha/enabled) to decide whether to show the input.
      const enabled = await getCaptchaEnabled();
      if (!enabled) {
        setStatus('disabled');
        setToken(null);
        setImageUrl('');
        return;
      }
      const result: CaptchaFetchResult = await requestCaptcha();
      if (!result.enabled) {
        setStatus('disabled');
        setToken(null);
        setImageUrl('');
        return;
      }
      setToken(result.token);
      setImageUrl(result.imageUrl);
      setImageKey((k) => k + 1);
      setStatus('ready');
      // Schedule a refresh slightly before the captcha expires.
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      // Refresh 30s before expiry, minimum 5s, to give the user time to retype.
      const refreshIn = Math.max(5_000, (result.expiresIn - 30) * 1000);
      refreshTimerRef.current = setTimeout(() => {
        load();
      }, refreshIn);
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载验证码失败';
      setErrorMsg(message);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [load]);

  useImperativeHandle(ref, () => ({
    getToken: () => token,
    refresh: () => load(),
    isEnabled: () => status === 'ready' || status === 'loading' || status === 'expired',
    isLoading: () => status === 'loading',
  }));

  if (status === 'disabled') {
    return null;
  }

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box
          onClick={load}
          sx={{
            width: 160,
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid',
            borderColor: error ? 'error.main' : 'divider',
            borderRadius: 1,
            background: '#f5f5f5',
            cursor: status === 'loading' ? 'wait' : 'pointer',
            overflow: 'hidden',
            flexShrink: 0,
          }}
          title="点击刷新验证码"
        >
          {status === 'loading' && <CircularProgress size={24} />}
          {status === 'ready' && imageUrl && (
            <img
              key={imageKey}
              src={imageUrl}
              alt="captcha"
              style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }}
              draggable={false}
            />
          )}
          {(status === 'error' || status === 'expired') && (
            <RefreshIcon sx={{ color: 'error.main' }} />
          )}
        </Box>
        <TextField
          label="验证码"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          error={error}
          helperText={
            error
              ? '验证码错误或已过期'
              : status === 'error'
                ? errorMsg || '加载失败，点击图片重试'
                : status === 'expired'
                  ? '验证码已过期，请点击图片刷新'
                  : '请输入图中 4 位字符（不区分大小写）'
          }
          sx={{ flex: 1 }}
          inputProps={{ maxLength: 4, autoComplete: 'off' }}
        />
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
        点击图片可刷新验证码
      </Typography>
    </Box>
  );
});

Captcha.displayName = 'Captcha';

export default Captcha;
