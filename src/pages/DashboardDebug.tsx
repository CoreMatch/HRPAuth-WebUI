import { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, CircularProgress, Alert, Paper, Stack, Chip, Divider } from '@mui/material';
import { getAuthToken, getUid, getUserEmail } from '../utils/cookie';
import { BackendUrl } from '../utils/config';
import { useMeta } from '../hooks/useMeta';

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
  const isLoggedIn = !!(getAuthToken() && getUid() && getUserEmail());

  useEffect(() => {
    const fetchRawData = async () => {
      const token = getAuthToken();
      const uid = getUid();
      const email = getUserEmail();
      const isLoggedIn = !!(token && uid && email);

      const startTime = performance.now();
      const timestamp = new Date().toISOString();

      try {
        const base = BackendUrl;
        // 如果未登录，请求后端根路径（门户页）；如果已登录，请求用户信息接口
        const url = isLoggedIn ? base + '/user' : base + '/';

        const requestHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        const requestParams: Record<string, string> = isLoggedIn ? {
          uid: uid,
          email: email,
          remember_token: token.substring(0, 20) + '...',
        } : {
          status: '未登录',
          mode: '获取门户元数据'
        };

        console.log('========== DashboardDebug 请求开始 ==========');
        console.log('请求目标:', url);
        console.log('状态:', isLoggedIn ? '已登录' : '未登录');
        console.log('请求方法:', isLoggedIn ? 'POST' : 'GET');
        console.log('请求头:', requestHeaders);
        console.log('请求参数:', requestParams);

        const fetchOptions: RequestInit = {
          headers: requestHeaders,
          credentials: 'include',
        };

        if (isLoggedIn) {
          fetchOptions.method = 'POST';
          fetchOptions.body = JSON.stringify({ remember_token: token, uid, email });
        } else {
          fetchOptions.method = 'GET';
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
