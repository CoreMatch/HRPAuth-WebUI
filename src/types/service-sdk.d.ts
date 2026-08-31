/**
 * 微服务 SDK 全局对象约定（前端侧前置声明）。
 *
 * 背景：SDK 是微服务声明的纯 JS 使用文件，通过 GET /services/sdk/:name 中继注入
 * （见 src/utils/serviceRegistry.ts 的 loadSDK）。HRPAuth 不解释其内容，
 * 内容由微服务与前端协商决定，因此前端需预先约定 SDK 的暴露方式才能获得类型。
 *
 * 约定：
 * - SDK 执行后必须在 window 上定义全局对象，键名 = `${serviceName}-sdk`，
 *   例如 texture-service 的 SDK 定义 window['texture-service-sdk']。
 * - 通过 getServiceSDK(name) 读取，返回类型即本接口（可按具体服务泛型收窄）。
 */

/** SDK 初始化钩子入参。 */
export interface ServiceSDKInitOptions {
  /** 当前所在前端区域，如 'webui-home'。 */
  area: string;
}

/** 微服务在导航栏中声明的菜单项。 */
export interface ServiceSDKMenu {
  /** 菜单显示文本。 */
  label: string;
}

/** 微服务 SDK 全局对象的最小约定结构。 */
export interface ServiceSDK {
  /** 服务名（应与 presence 注册的 name 一致）。 */
  name: string;
  /** SDK 版本号。 */
  version: string;
  /** 在导航栏菜单中声明一项（可选）。 */
  menu?: ServiceSDKMenu;
  /**
   * 菜单项打开时 iframe 嵌入的 URL（可选，配合 menu 使用）。
   * 绝对 URL 或相对路径均可；相对路径按页面当前 origin 解析。
   */
  iframeUrl?: string;
  /** 初始化钩子：SDK 注入后由前端调用（可选，具体语义与微服务协商）。 */
  init?: (options: ServiceSDKInitOptions) => void;
}
