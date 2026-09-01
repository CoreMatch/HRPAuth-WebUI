import { useParams } from 'react-router-dom';
import ServicePanel from '../components/ServicePanel';

/**
 * 微服务嵌入页（/service/:name）。
 * 优先动态加载 SDK 的 mount 组件，未提供时回退 iframe 嵌入 sdk.iframeUrl。
 */
export default function ServiceEmbed() {
  const { name = '' } = useParams();
  return <ServicePanel name={name} area="webui-service" height="calc(100vh - 64px)" />;
}
