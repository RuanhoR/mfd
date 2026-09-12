import { ref } from 'vue'
import { localeBus } from './events'
import { resolveLocalized, type Locale, type Localized } from './localized'

const messages: Record<Locale, Record<string, string>> = {
  en: {
    title: 'Addon Downloader',
    tagline: 'Minecraft Bedrock addon downloads',
    themeToLight: 'Switch to light mode',
    themeToDark: 'Switch to dark mode',
    sectionIntro: 'Introduction',
    sectionVersion: 'Version',
    supportedRange: 'Supported Minecraft versions',
    mcVersion: 'Minecraft version',
    serverApi: '@minecraft/server',
    serverApiBeta: '@minecraft/server (beta)',
    download: 'Download .addon',
    loading: 'Loading…',
    sapiFailed: 'Failed to load version data',
    loadFailed: 'Failed to load the addon manifest',
    retry: 'Retry',
    noVersions: 'No matching Minecraft versions found',
    footer: 'Powered by @mbler/mfd',
  },
  zh: {
    title: '模组下载',
    tagline: 'Minecraft 基岩版模组下载',
    themeToLight: '切换到浅色模式',
    themeToDark: '切换到深色模式',
    sectionIntro: '模组介绍',
    sectionVersion: '版本选择',
    supportedRange: '支持的 Minecraft 版本',
    mcVersion: 'Minecraft 版本',
    serverApi: '@minecraft/server',
    serverApiBeta: '@minecraft/server（测试版）',
    download: '下载 .addon',
    loading: '加载中…',
    sapiFailed: '版本数据加载失败',
    loadFailed: '模组信息加载失败',
    retry: '重试',
    noVersions: '没有找到匹配的 Minecraft 版本',
    footer: '由 @mbler/mfd 驱动',
  },
}

const KEY = 'mfd.locale'

/** ui string overrides from the `i18n` field of mfd.config.js */
let overrides: Record<string, Localized> | null = null

export function setI18nOverrides(
  record: Record<string, Localized> | null | undefined
): void {
  overrides = record ?? null
}

/**
 * starts as 'en' (or the locale chosen by the mfd page server for the
 * static render, injected via __MFD_CONFIG__) so SSR markup matches
 * the first client render
 */
export const locale = ref<Locale>('en')

/** restore saved locale / browser language after hydration (client only) */
/**
 * follow the system language automatically; only a value saved by a
 * custom layout (via setLocale) takes precedence
 */
export function initLocale(): void {
  const saved = localStorage.getItem(KEY)
  if (saved === 'en' || saved === 'zh') {
    setLocale(saved)
    return
  }
  setLocale(navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en')
}

/**
 * switch the ui language programmatically (e.g. from a custom layout
 * that provides its own language switcher); the default page does not
 * expose a switcher and just follows the system language
 */
export function setLocale(l: Locale): void {
  locale.value = l
  localStorage.setItem(KEY, l)
  document.documentElement.lang = l
  localeBus.emit(l)
}

export function t(key: string): string {
  const override = overrides?.[key]
  if (override !== undefined) {
    const resolved = resolveLocalized(override, locale.value)
    if (resolved) return resolved
  }
  return messages[locale.value][key] ?? messages.en[key] ?? key
}
