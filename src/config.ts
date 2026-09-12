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
  min: string
  max: string
}

/**
 * Raw shape of `mfd.config.js` (before defaults are applied).
 * Use `defineConfig` to get IDE type hints while writing it.
 */
export interface MfdConfigData {
  /** page/addon title shown in the header and document title */
  title?: Localized
  /** supported Minecraft version range, e.g. { min: '1.21.0', max: '1.21.90' } */
  mcVersion: MfdMcVersionRange
  /** addon introduction in markdown, rendered on the page */
  description: Localized
  /** api path serving manifest.addon.json (default: /manifest.addon.json) */
  entryAddonManifest?: string
  /** api path serving the addon file (default: /dist.addon) */
  entryDistAddon?: string
  /** path to the built addon file (.addon/.mcaddon) served at entryDistAddon */
  distEntry?: string
  /** override built-in ui strings, keys are message keys (e.g. download) */
  i18n?: Record<string, Localized>
  /** path to a TS style module used to customize page theme/behavior */
  style?: string
}

/** resolved config with defaults applied and paths absolutized */
export interface MfdConfig {
  title: Localized | null
  mcVersion: MfdMcVersionRange
  description: Localized
  entryAddonManifest: string
  entryDistAddon: string
  distEntry: string | null
  i18n: Record<string, Localized> | null
  style: string | null
}

/**
 * Identity helper for `mfd.config.js` so IDEs can type-check the object.
 *
 * ```js
 * // mfd.config.js
 * import { defineConfig } from '@mbler/mfd'
 * export default defineConfig({
 *   mcVersion: { min: '1.21.0', max: '1.21.90' },
 *   description: { zh: '# 我的模组', en: '# My addon' },
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
  if (typeof raw.distEntry === 'string' && raw.distEntry.trim() !== '') {
    const p = raw.distEntry.trim()
    distEntry = path.isAbsolute(p) ? p : path.resolve(cwd, p)
    if (!fs.existsSync(distEntry)) {
      throw new Error(`[mfd] distEntry not found: ${distEntry}`)
    }
  } else if (raw.distEntry !== undefined) {
    throw new Error(`[mfd] '${MFD_CONFIG_FILE}': distEntry must be a file path`)
  }

  return {
    title: raw.title ?? null,
    mcVersion: { min: mcVersion.min, max: mcVersion.max },
    description: description,
    entryAddonManifest: normalizeEntry(raw.entryAddonManifest, DEFAULT_ENTRY_ADDON_MANIFEST),
    entryDistAddon: normalizeEntry(raw.entryDistAddon, DEFAULT_ENTRY_DIST_ADDON),
    distEntry,
    i18n,
    style,
  }
}
