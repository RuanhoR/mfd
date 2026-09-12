import { ref } from 'vue'
import { localeBus } from './events'
import { getRenderLocale } from './runtime'
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
    serverApiStable: '@minecraft/server (stable)',
    download: 'Download .addon',
    downloading: 'Preparing download…',
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
    serverApiStable: '@minecraft/server（正式版）',
    download: '下载 .addon',
    downloading: '正在打包下载…',
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
 * starts as the locale the static html was rendered with (injected via
 * __MFD_RENDER_LOCALE__, 'en' for ssr) so the first client render
 * matches the markup it hydrates
 */
export const locale = ref<Locale>(getRenderLocale() ?? 'en')

function detectLocale(): Locale {
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

/**
 * the ui language follows the system language automatically; only a
 * value saved by a previous visit / custom layout (via setLocale) wins.
 * runs after mount, so switching is a reactive update (no hydration
 * mismatch) even when the static html was rendered in another locale.
 */
export function initLocale(): void {
  const saved = localStorage.getItem(KEY)
  setLocale(saved === 'en' || saved === 'zh' ? saved : detectLocale())
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
