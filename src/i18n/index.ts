import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import zhCN from './locales/zh-CN.json';
import en from './locales/en.json';

export const SUPPORTED_LANGUAGES = ['zh-CN', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  'zh-CN': '简体中文',
  en: 'English',
};

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'zh-CN': { translation: zhCN },
      en: { translation: en },
    },
    lng: 'en',
    fallbackLng: 'en',
    // 仅声明精确支持的语言代码。不要开启 nonExplicitSupportedLngs：
    // i18next v26 在 init 时会把 zh-CN 规范化为 zh 并按 supportedLngs 过滤，
    // 结果会把 zh-CN 误判为不支持，导致 changeLanguage 后查不到资源而 fallback 回 en。
    supportedLngs: ['zh-CN', 'en'],
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
      bindI18n: 'languageChanged loaded',
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'hrpauth-lang',
    },
  });

export default i18n;