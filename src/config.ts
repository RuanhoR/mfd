import path from 'node:path'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

export const MFD_CONFIG_FILE = 'mfd.config.js'
export const DEFAULT_ENTRY_ADDON_MANIFEST = '/manifest.addon.json'
export const DEFAULT_ENTRY_DIST_ADDON = '/dist.addon'
/** endpoint the bundled style module is served from */
export const STYLE_ENTRY = '/mfd.style.js'

export type MfdLocale = 'en' | 'zh'

/**
 * A display string: plain string (same for every locale) or a
 * `{ zh, en }` pair picked by the current ui locale.
 */
export type Localized = string | { zh?: string; en?: string }

export function resolveLocalized(
  value: Localized,
  locale: MfdLocale
): string {
  if (typeof value === 'string') return value
  return value[locale] ?? value.en ?? value.zh ?? ''
}

export function isLocalized(value: unknown): value is Localized {
  if (typeof value === 'string') return true
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.zh === 'string' || typeof v.en === 'string'
}

export interface MfdMcVersionRange {
  /** lowest supported Minecraft version, e.g. `'1.21.0'` */
  min: string
  /** highest supported Minecraft version, e.g. `'1.21.90'` */
  max: string
}

/**
 * Raw shape of `mfd.config.js` (before defaults are applied).
 *
 * Always author it through {@link defineConfig} so IDEs can type-check
 * and autocomplete the object.
 */
export interface MfdConfigData {
  /**
   * Page/addon title, shown in the page header and used as the document
   * title. Falls back to the message key `title` ("Addon Downloader")
   * when omitted.
   *
   * Accepts a plain `string` (used for every locale) or a `{ zh, en }`
   * pair picked by the current ui locale.
   *
   * @example
   * ```js
   * title: { zh: '起床战争', en: 'Bed Wars' }
   * ```
   */
  title?: Localized
  /**
   * Supported Minecraft version range. The page only offers versions
   * inside this range and maps them to `@minecraft/server` versions
   * with the same SAPI logic as `mbler build`.
   */
  mcVersion: MfdMcVersionRange
  /**
   * Addon introduction rendered on the page as markdown (with GFM
   * tables, code blocks, ...). Required.
   *
   * Accepts a plain `string` or a `{ zh, en }` pair. When a locale is
   * missing the other one is used as fallback.
   *
   * @example
   * ```js
   * description: { zh: '# 中文介绍', en: '# English intro' }
   * ```
   */
  description: Localized
  /**
   * API path that serves the generated `manifest.addon.json`.
   *
   * Redefine it when the default path collides with something on your
   * host. Must start with `/` (a missing one is added).
   *
   * @default '/manifest.addon.json'
   */
  entryAddonManifest?: string
  /**
   * API path that serves the addon file (the download link target).
   *
   * Must start with `/` (a missing one is added).
   *
   * @default '/dist.addon'
   */
  entryDistAddon?: string
  /**
   * Output directory for the `mfd page` static build. Relative paths
   * are resolved against the config file's cwd.
   *
   * @default 'dist-page'
   */
  distEntry?: string
  /**
   * Path to the built addon file (`.addon` / `.mcaddon`). It is copied
   * to {@link MfdConfigData.entryDistAddon} by `mfd page` and served
   * there by `mfd serve`. Relative paths are resolved against the
   * config file's cwd.
   */
  addon?: string
  /**
   * Port for the `mfd serve` preview server.
   *
   * @default 9527
   */
  port?: number
  /**
   * Overrides for the built-in ui strings. Keys are message keys
   * (`download`, `sectionIntro`, `tagline`, ... — see the README for
   * the full list), values accept a plain `string` or `{ zh, en }`.
   *
   * @example
   * ```js
   * i18n: { download: { zh: '下载模组', en: 'Download addon' } }
   * ```
   */
  i18n?: Record<string, Localized>
  /**
   * Path to a TS style module customizing page theme and behavior
   * (vitepress-like theming). Relative paths are resolved against the
   * config file's cwd. See the README "Custom style modules" section
   * for the API surface.
   *
   * @example
   * ```js
   * style: './mfd.style.ts'
   * ```
   */
  style?: string
}

  /** resolved config with defaults applied and paths absolutized */
export interface MfdConfig {
  title: Localized | null
  mcVersion: MfdMcVersionRange
  description: Localized
  entryAddonManifest: string
  entryDistAddon: string
  /** output directory for the static page build (absolute, or null for default) */
  distEntry: string | null
  /** absolute path to the built addon file, or null */
  addon: string | null
  /** port for `mfd serve`, or null for default */
  port: number | null
  i18n: Record<string, Localized> | null
  style: string | null
}

/**
 * Identity helper for `mfd.config.js` so IDEs can type-check the object.
 * It just returns the argument unchanged.
 *
 * @example
 * ```js
 * // mfd.config.js
 * import { defineConfig } from '@mbler/mfd'
 * export default defineConfig({
 *   title: { zh: '我的模组', en: 'My Addon' },
 *   mcVersion: { min: '1.21.0', max: '1.21.90' },
 *   description: { zh: '# 中文介绍', en: '# English intro' },
 *   distEntry: './dist-page',
 *   addon: './dist.mcaddon',
 * })
 * ```
 */
export function defineConfig(config: MfdConfigData): MfdConfigData {
  return config
}

function normalizeEntry(entry: unknown, fallback: string): string {
  if (typeof entry !== 'string' || entry.trim() === '') return fallback
  const e = entry.trim()
  return e.startsWith('/') ? e : `/${e}`
}

function assertLocalized(
  value: unknown,
  field: string,
  required: boolean
): void {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw new Error(
        `[mfd] '${MFD_CONFIG_FILE}' must provide ${field} (markdown, string or { zh, en })`
      )
    }
    return
  }
  if (!isLocalized(value)) {
    throw new Error(
      `[mfd] '${MFD_CONFIG_FILE}': ${field} must be a string or { zh: string, en: string }`
    )
  }
}

export function resolveMfdConfigPath(cwd: string = process.cwd()): string {
  return path.resolve(cwd, MFD_CONFIG_FILE)
}

/**
 * Load `mfd.config.js` from `cwd`.
 * Dynamic import goes through `pathToFileURL` so it works the same on
 * Windows (drive letters) and POSIX (spaces, unicode) paths.
 */
export async function readMfdConfig(cwd: string = process.cwd()): Promise<MfdConfig> {
  const configPath = resolveMfdConfigPath(cwd)
  if (!fs.existsSync(configPath)) {
    throw new Error(`[mfd] ${MFD_CONFIG_FILE} not found in ${cwd}`)
  }
  let mod: unknown
  try {
    mod = await import(String(pathToFileURL(configPath)))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`[mfd] failed to load ${MFD_CONFIG_FILE}: ${msg}`, {
      cause: err,
    })
  }
  const raw = ((mod as { default?: MfdConfigData }).default ??
    mod) as MfdConfigData | null
  if (!raw || typeof raw !== 'object') {
    throw new Error(`[mfd] ${MFD_CONFIG_FILE} must default-export a config object`)
  }
  const { mcVersion, description } = raw
  if (
    !mcVersion ||
    typeof mcVersion.min !== 'string' ||
    typeof mcVersion.max !== 'string'
  ) {
    throw new Error(
      `[mfd] '${MFD_CONFIG_FILE}' must provide mcVersion: { min: string, max: string }`
    )
  }
  assertLocalized(description, 'description', true)
  if (raw.title !== undefined) assertLocalized(raw.title, 'title', false)

  let i18n: Record<string, Localized> | null = null
  if (raw.i18n !== undefined) {
    if (!raw.i18n || typeof raw.i18n !== 'object') {
      throw new Error(`[mfd] '${MFD_CONFIG_FILE}': i18n must be an object`)
    }
    i18n = {}
    for (const [key, value] of Object.entries(raw.i18n)) {
      if (!isLocalized(value)) {
        throw new Error(
          `[mfd] '${MFD_CONFIG_FILE}': i18n.${key} must be a string or { zh: string, en: string }`
        )
      }
      i18n[key] = value
    }
  }

  let style: string | null = null
  if (typeof raw.style === 'string' && raw.style.trim() !== '') {
    const p = raw.style.trim()
    style = path.isAbsolute(p) ? p : path.resolve(cwd, p)
    if (!fs.existsSync(style)) {
      throw new Error(`[mfd] style module not found: ${style}`)
    }
  }
  let distEntry: string | null = null
  if (raw.distEntry !== undefined) {
    if (typeof raw.distEntry !== 'string' || raw.distEntry.trim() === '') {
      throw new Error(`[mfd] '${MFD_CONFIG_FILE}': distEntry must be a directory path`)
    }
    const p = raw.distEntry.trim()
    distEntry = path.isAbsolute(p) ? p : path.resolve(cwd, p)
  }
  let addon: string | null = null
  if (raw.addon !== undefined) {
    if (typeof raw.addon !== 'string' || raw.addon.trim() === '') {
      throw new Error(`[mfd] '${MFD_CONFIG_FILE}': addon must be a file path`)
    }
    const p = raw.addon.trim()
    addon = path.isAbsolute(p) ? p : path.resolve(cwd, p)
    if (!fs.existsSync(addon)) {
      throw new Error(`[mfd] addon file not found: ${addon}`)
    }
  }
  if (raw.port !== undefined) {
    const port = Number(raw.port)
    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
      throw new Error(`[mfd] '${MFD_CONFIG_FILE}': port must be an integer between 1 and 65535`)
    }
  }

  return {
    title: raw.title ?? null,
    mcVersion: { min: mcVersion.min, max: mcVersion.max },
    description: description,
    entryAddonManifest: normalizeEntry(raw.entryAddonManifest, DEFAULT_ENTRY_ADDON_MANIFEST),
    entryDistAddon: normalizeEntry(raw.entryDistAddon, DEFAULT_ENTRY_DIST_ADDON),
    distEntry,
    addon,
    port: raw.port !== undefined ? Number(raw.port) : null,
    i18n,
    style,
  }
}
