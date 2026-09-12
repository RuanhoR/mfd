import mfdConfig from 'virtual:mfd-config'
import type { Localized } from './localized'
import type { ManifestAddon } from './api'

export interface MfdBakedConfig {
  /** manifest.addon.json baked at build time */
  manifest: ManifestAddon
  /** ui string overrides from the mfd.config.js `i18n` field */
  i18n?: Record<string, Localized>
  /** api path serving the manifest (base-prefixed) */
  entryAddonManifest: string
  /** api path of the bundled style module, null when unset */
  entryStyle: string | null
}

/**
 * values baked at build time by the mfd virtual module
 * (real config for `mfd page`/`mfd serve`, demo values in vite dev)
 */
export const bakedConfig = mfdConfig as MfdBakedConfig

export const entryAddonManifest: string =
  bakedConfig.entryAddonManifest ?? '/manifest.addon.json'

export const entryStyle: string | null = bakedConfig.entryStyle ?? null

/** ui string overrides from the mfd.config.js `i18n` field */
export const configI18n: Record<string, Localized> | undefined =
  bakedConfig.i18n

/** hydration state: the baked manifest (matches the ssr render) */
export function getClientManifest(): ManifestAddon | null {
  return bakedConfig.manifest ?? null
}

/**
 * locale the static html was rendered with, injected per-request by
 * `mfd serve` (Accept-Language) or fixed by `mfd page --locale`
 */
export function getRenderLocale(): 'en' | 'zh' | undefined {
  if (typeof window === 'undefined') return undefined
  return window.__MFD_RENDER_LOCALE__
}
