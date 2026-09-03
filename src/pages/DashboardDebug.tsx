import { useState, useEffect, useRef } from 'react';
import { Box, Typography, Card, CardContent, CircularProgress, Alert, Paper, Stack, Chip, Divider, TextField, Button } from '@mui/material';
import { getAuthToken, getUid, getUserEmail } from '../utils/cookie';
import { BackendUrl } from '../utils/config';
import { useMeta } from '../hooks/useMeta';
import { getDiscoveredServices, getServiceSDK, onSDKLoaded, notifySDKLoaded } from '../utils/serviceRegistry';

interface DebugInfo {
  requestUrl: string;
  requestMethod: string;
  requestHeaders: Record<string, string>;
  requestParams: Record<string, string>;
  responseStatus: number;
  responseStatusText: string;
  responseHeaders: Record<string, string>;
  responseBody: any;
  timestamp: string;
  duration: number;
}

export default function DashboardDebug() {
  useMeta('dashdebug');
  const [rawData, setRawData] = useState<any>(null);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setSdkTick] = useState(0);
  const isLoggedIn = !!(getAuthToken() && getUid() && getUserEmail());

  // 手动加载 SDK
  const [sdkName, setSdkName] = useState('');
  const [sdkCode] = useState(
`// 使用 __serviceName 变量（由调试工具自动注入，值为服务名称输入框内容）
window[__serviceName + '-sdk'] = {
  name: __serviceName,
  version: '1.0.0',
  menu: { label: 'My Service' },
  dashboard: { label: 'My Service', url: 'https://example.com' },
};`
  );
  const [sdkLoadError, setSdkLoadError] = useState<string | null>(null);
  const [sdkLoadSuccess, setSdkLoadSuccess] = useState<string | null>(null);
  const sdkCodeRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const fetchRawData = async () => {
      const token = getAuthToken();
      const uid = getUid();
      const email = getUserEmail();
      const isLoggedIn = !!token;

      const startTime = performance.now();
      const timestamp = new Date().toISOString();

      try {
        const base = BackendUrl;
        
        // 如果未登录，请求后端状态端点 /status；如果已登录，请求用户信息接口 /user
        const url = isLoggedIn ? base + '/user' : base + '/status';

        const requestHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        if (isLoggedIn) {
          requestHeaders['Authorization'] = `Bearer ${token}`;
        }

        const requestParams: Record<string, string> = isLoggedIn ? {
          uid: uid || 'N/A',
          email: email || 'N/A',
          access_token: token.substring(0, 10) + '...',
        } : {
          status: '未登录',
          mode: '获取服务状态'
        };

        const fetchOptions: RequestInit = {
          method: isLoggedIn ? 'POST' : 'GET',
          headers: requestHeaders,
        };

        if (isLoggedIn) {
          fetchOptions.body = JSON.stringify({ uid, email });
        }

        const resp = await fetch(url, fetchOptions);

        const duration = Math.round(performance.now() - startTime);

        const responseHeaders: Record<string, string> = {};
        resp.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        console.log('响应状态:', resp.status, resp.statusText);
        console.log('响应头:', responseHeaders);

        // 尝试解析 JSON，如果失败则尝试获取文本（门户页可能是 HTML 或重定向）
        let data: any;
        const contentType = resp.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await resp.json().catch(() => ({
            success: false,
            message: '服务器返回了 JSON Content-Type 但无法解析内容',
          }));
        } else {
          const text = await resp.text().catch(() => '无法读取响应内容');
          data = {
            isRawText: true,
            contentType: contentType || 'unknown',
            content: text.length > 5000 ? text.substring(0, 5000) + '... (内容过长已截断)' : text
          };
        }

        console.log('响应内容:', data);
        console.log('请求耗时:', duration + 'ms');
        console.log('========== DashboardDebug 请求结束 ==========');

        setDebugInfo({
          requestUrl: url,
          requestMethod: isLoggedIn ? 'POST' : 'GET',
          requestHeaders,
          requestParams,
          responseStatus: resp.status,
          responseStatusText: resp.statusText,
          responseHeaders,
          responseBody: data,
          timestamp,
          duration,
        });
        setRawData(data);
      } catch (err) {
        const duration = Math.round(performance.now() - startTime);
        console.error('DashboardDebug: 请求失败', err);
        console.error('请求耗时:', duration + 'ms');
        setError(err instanceof Error ? err.message : '未知错误');
      } finally {
        setLoading(false);
      }
    };

    fetchRawData();
  }, []);

  // 微服务 SDK 加载完成后刷新微服务列表展示。
  useEffect(() => {
    return onSDKLoaded(() => setSdkTick((t) => t + 1));
  }, []);

  const services = getDiscoveredServices();

  const handleLoadSDK = () => {
    setSdkLoadError(null);
    setSdkLoadSuccess(null);

    const name = sdkName.trim();
    if (!name) {
      setSdkLoadError('请输入服务名称');
      return;
    }

    const code = sdkCodeRef.current?.value ?? sdkCode;
    if (!code.trim()) {
      setSdkLoadError('请输入 SDK 代码');
      return;
    }

    try {
      // 通过 script 标签执行代码，能捕获语法错误和运行时错误
      // 注入 __serviceName 变量，SDK 代码可通过 window[__serviceName + '-sdk'] 动态挂载
      const script = document.createElement('script');
      script.dataset.serviceSdk = `manual-${name}`;
      script.textContent = `var __serviceName=${JSON.stringify(name)};\n${code}`;

      let capturedError: string | null = null;

      script.onerror = () => {
        // script 标签 onerror 主要捕获 src 加载失败，内联脚本的运行时错误走 window.onerror
        if (!capturedError) {
          capturedError = '脚本执行失败（详情请查看控制台）';
        }
        setSdkLoadError(capturedError);
        script.remove();
      };

      // 拦截运行时错误
      const prevOnError = window.onerror;
      window.onerror = (message, _source, _lineno, _colno, error) => {
        capturedError = String(message);
        if (error?.stack) {
          capturedError += '\n\n' + error.stack;
        }
        setSdkLoadError(capturedError);
        window.onerror = prevOnError;
        return true; // 阻止默认错误处理
      };

      document.head.appendChild(script);
      window.onerror = prevOnError;

      // 验证 SDK 全局对象是否正确注册
      const globalKey = `${name}-sdk`;
      const sdk = (window as any)[globalKey];

      if (!sdk || typeof sdk !== 'object') {
        setSdkLoadError(
          `代码已执行，但未检测到 window['${globalKey}'] 全局对象。\n` +
          `请确保 SDK 代码将对象挂载到 window['${globalKey}'] 上。`
        );
        script.remove();
        return;
      }

      // 验证必要字段
      if (!sdk.name || !sdk.version) {
        setSdkLoadError(
          `SDK 对象缺少必要字段：需要 name 和 version 属性。\n` +
          `当前对象: ${JSON.stringify(Object.keys(sdk))}`
        );
        script.remove();
        return;
      }

      // 加载成功
      setSdkLoadSuccess(
        `SDK 加载成功！\n` +
        `服务名: ${sdk.name}\n` +
        `版本: ${sdk.version}\n` +
        `导航菜单: ${sdk.menu ? sdk.menu.label : '无'}\n` +
        `Dashboard: ${sdk.dashboard ? sdk.dashboard.label : '无'}`
      );
      notifySDKLoaded(name);
      script.remove();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSdkLoadError(`SDK 加载出错: ${msg}`);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
        <CircularProgress />
      </Box>
    );
  }

  const renderJsonBlock = (title: string, data: any) => (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle2" gutterBottom color="primary">
        {title}
      </Typography>
      <Paper
        sx={{
          p: 2,
          bgcolor: 'grey.900',
          overflow: 'auto',
          maxHeight: '300px'
        }}
      >
        <pre style={{
          margin: 0,
          fontFamily: 'monospace',
          fontSize: '0.875rem',
          color: '#e0e0e0',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word'
        }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      </Paper>
    </Box>
  );

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <Typography variant="h4">
          Dashboard Debug
        </Typography>
        <Chip label="调试模式" color="info" size="small" />
        <Chip 
          label={isLoggedIn ? "用户模式" : "门户元数据模式"} 
          color={isLoggedIn ? "success" : "warning"} 
          variant="outlined"
          size="small" 
        />
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
          {error.includes('Failed to fetch') && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              提示：这通常意味着浏览器无法连接到后端服务器。请检查后端服务是否启动，或者是否存在跨域 (CORS) 问题。
            </Typography>
          )}
        </Alert>
      )}

      {BackendUrl === '' && !import.meta.env.DEV && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          检测到 BackendUrl 为空。这可能意味着 /config.json 未能正确加载。
          请检查部署目录下是否存在 config.json 且内容格式正确。
        </Alert>
      )}

      {debugInfo && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom color="primary">
              请求详情
            </Typography>

            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
              <Chip
                label={`方法: ${debugInfo.requestMethod}`}
                color="default"
                size="small"
              />
              <Chip
                label={`状态: ${debugInfo.responseStatus} ${debugInfo.responseStatusText}`}
                color={debugInfo.responseStatus >= 200 && debugInfo.responseStatus < 300 ? 'success' : 'error'}
                size="small"
              />
              <Chip
                label={`耗时: ${debugInfo.duration}ms`}
                color="info"
                size="small"
              />
              <Chip
                label={`时间: ${new Date(debugInfo.timestamp).toLocaleTimeString()}`}
                color="default"
                size="small"
              />
            </Stack>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" gutterBottom color="text.secondary">
              请求目标 URL
            </Typography>
            <Paper sx={{ p: 2, bgcolor: 'grey.100', mb: 2 }}>
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'monospace',
                  wordBreak: 'break-all',
                  color: 'primary.main'
                }}
              >
                {debugInfo.requestUrl}
              </Typography>
            </Paper>

            {renderJsonBlock('请求头 (Request Headers)', debugInfo.requestHeaders)}
            {renderJsonBlock('请求参数 (Request Params)', debugInfo.requestParams)}
            {renderJsonBlock('响应头 (Response Headers)', debugInfo.responseHeaders)}
          </CardContent>
        </Card>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom color="primary">
            已发现的微服务
          </Typography>
          {services.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              暂无已发现的微服务（可能未登录，或暂无声明了重叠前端区域的服务）。
            </Typography>
          ) : (
            services.map((svc) => {
              const sdk = getServiceSDK(svc.name);
              return (
                <Box key={svc.name} sx={{ mb: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Typography variant="subtitle1" fontWeight="medium">
                      {svc.name}
                    </Typography>
                    <Chip label={`scope: ${svc.scope_name}`} size="small" variant="outlined" />
                    <Chip
                      label={sdk ? 'SDK 已加载' : 'SDK 未加载'}
                      color={sdk ? 'success' : 'default'}
                      size="small"
                    />
                  </Stack>
                  {svc.sdk_url && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      SDK URL: {svc.sdk_url}
                    </Typography>
                  )}
                  {sdk && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      版本: {sdk.version} · 导航菜单: {sdk.menu ? '有' : '无'} · Dashboard 页面: {sdk.dashboard ? '有' : '无'}
                    </Typography>
                  )}
                </Box>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom color="primary">
            手动加载 SDK
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            输入 SDK JavaScript 代码并指定服务名，手动加载 SDK 进行调试。
            代码会通过 script 标签执行，服务名对应的全局对象键为 <code>{'{serviceName}-sdk'}</code>。
          </Typography>

          <Stack spacing={2}>
            <TextField
              label="服务名称 (serviceName)"
              placeholder="例如 my-service"
              size="small"
              value={sdkName}
              onChange={(e) => setSdkName(e.target.value)}
              helperText="SDK 将挂载到 window['{serviceName}-sdk']"
              sx={{ maxWidth: 400 }}
            />

            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                SDK JavaScript 代码：
              </Typography>
              <textarea
                ref={sdkCodeRef}
                defaultValue={sdkCode}
                spellCheck={false}
                style={{
                  width: '100%',
                  minHeight: '200px',
                  padding: '12px',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  lineHeight: '1.5',
                  backgroundColor: '#1e1e1e',
                  color: '#e0e0e0',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  resize: 'vertical',
                  outline: 'none',
                  tabSize: 2,
                }}
              />
            </Box>

            <Stack direction="row" spacing={2} alignItems="center">
              <Button variant="contained" color="primary" onClick={handleLoadSDK}>
                加载 SDK
              </Button>
              {sdkLoadSuccess && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    setSdkLoadSuccess(null);
                    setSdkLoadError(null);
                  }}
                >
                  清除结果
                </Button>
              )}
            </Stack>

            {sdkLoadError && (
              <Alert severity="error" sx={{ whiteSpace: 'pre-wrap' }}>
                <Typography variant="subtitle2" gutterBottom>SDK 加载错误：</Typography>
                {sdkLoadError}
              </Alert>
            )}

            {sdkLoadSuccess && (
              <Alert severity="success" sx={{ whiteSpace: 'pre-wrap' }}>
                {sdkLoadSuccess}
              </Alert>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom color="primary">
            后端响应内容 (Response Body)
          </Typography>
          <Paper
            sx={{
              p: 2,
              bgcolor: 'grey.900',
              overflow: 'auto',
              maxHeight: '50vh'
            }}
          >
            <pre style={{
              margin: 0,
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              color: '#e0e0e0',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {rawData !== null ? (
              rawData.isRawText ? (
                `[${rawData.contentType}]\n\n${rawData.content}`
              ) : (
                JSON.stringify(rawData, null, 2)
              )
            ) : '暂无数据'}
            </pre>
          </Paper>
        </CardContent>
      </Card>
    </Box>
  );
}
