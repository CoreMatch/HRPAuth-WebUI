import { useEffect, useRef, useState } from 'react';
import { getServiceSDK, onSDKLoaded } from '../utils/serviceRegistry';

export interface ServicePanelProps {
  /** 服务名，用于读取 SDK 全局对象。 */
  name: string;
  /** 当前所在前端区域，传入 SDK 的 mount。 */
  area: string;
  /** iframe 回退地址；缺省用 sdk.iframeUrl。 */
  url?: string;
  /** iframe 回退高度。 */
  height?: string;
}

/**
 * 微服务内容面板：优先动态挂载 SDK 的 mount 组件，未提供时回退 iframe 嵌入。
 * SDK 异步加载，加载完成后自动重渲染。
 */
export default function ServicePanel({ name, area, url, height }: ServicePanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [sdk, setSdk] = useState(() => getServiceSDK(name));

  // SDK 异步加载，加载完成后重读并重渲染。
  useEffect(() => {
    return onSDKLoaded((loadedName) => {
      if (loadedName === name) {
        setSdk(getServiceSDK(name));
      }
    });
  }, [name]);

  const hasMount = typeof sdk?.mount === 'function';

  // mount 挂载组件；清理函数在卸载或 SDK 变化时调用。
  useEffect(() => {
    const mountFn = sdk?.mount;
    if (typeof mountFn !== 'function' || !containerRef.current) {
      return;
    }
    const cleanup = mountFn(containerRef.current, { area });
    return typeof cleanup === 'function' ? cleanup : undefined;
  }, [sdk, area]);

  if (hasMount) {
    return <div ref={containerRef} style={{ width: '100%' }} />;
  }

  const iframeUrl = url ?? sdk?.iframeUrl;
  if (iframeUrl) {
    return (
      <iframe
        title={name}
        src={iframeUrl}
        style={{ width: '100%', height, border: 'none', borderRadius: 8 }}
      />
    );
  }

  return <p>服务 {name} 未提供可嵌入内容（未声明 mount 或 iframeUrl）。</p>;
}
