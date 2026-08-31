import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getServiceSDK, onSDKLoaded } from '../utils/serviceRegistry';

/**
 * 微服务嵌入页：根据 SDK 声明的 iframeUrl 在 iframe 中嵌入微服务 UI。
 * 路由 /service/:name；URL 由微服务 SDK 的 iframeUrl 字段声明。
 */
export default function ServiceEmbed() {
  const { name = '' } = useParams();
  const [, setSdkTick] = useState(0);

  // SDK 异步加载，加载完成后重渲染以读取 iframeUrl。
  useEffect(() => {
    const unsubscribe = onSDKLoaded((loadedName) => {
      if (loadedName === name) {
        setSdkTick((t) => t + 1);
      }
    });
    return unsubscribe;
  }, [name]);

  const sdk = getServiceSDK(name);
  const iframeUrl = sdk?.iframeUrl;

  if (!iframeUrl) {
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
        <p>服务 {name} 未声明 iframeUrl 或 SDK 尚未加载。</p>
        <Link to="/">返回首页</Link>
      </div>
    );
  }

  return (
    <iframe
      title={`${sdk.name} 嵌入页`}
      src={iframeUrl}
      style={{ width: '100%', height: 'calc(100vh - 64px)', border: 'none' }}
    />
  );
}
