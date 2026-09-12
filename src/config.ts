import path from 'node:path'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

export const MFD_CONFIG_FILE = 'mfd.config.js'
export const DEFAULT_ENTRY_ADDON_MANIFEST = '/manifest.addon.json'
export const DEFAULT_ENTRY_DIST_ADDON = '/dist.addon'
/** endpoint the bundled style module is served from */
export const STYLE_ENTRY = '/mfd.style.js'

export interface MfdMcVersionRange {
  min: string
  max: string
}

/**
 * Raw shape of `mfd.config.js` (before defaults are applied).
 * Use `defineConfig` to get IDE type hints while writing it.
 */
export interface MfdConfigData {
  /** supported Minecraft version range, e.g. { min: '1.21.0', max: '1.21.90' } */
  mcVersion: MfdMcVersionRange
  /** addon introduction in markdown, rendered on the page */
  description: string
  /** api path serving manifest.addon.json (default: /manifest.addon.json) */
  entryAddonManifest?: string
  /** api path serving the .addon file (default: /dist.addon) */
  entryDistAddon?: string
  /** path to a TS style module used to customize page theme/behavior */
  style?: string
}

/** resolved config with defaults applied and paths absolutized */
export interface MfdConfig {
  mcVersion: MfdMcVersionRange
  description: string
  entryAddonManifest: string
  entryDistAddon: string
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
 *   description: '# My addon\n...',
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
  if (typeof description !== 'string' || description.trim() === '') {
    throw new Error(`[mfd] '${MFD_CONFIG_FILE}' must provide description (markdown)`)
  }
  let style: string | null = null
  if (typeof raw.style === 'string' && raw.style.trim() !== '') {
    const p = raw.style.trim()
    style = path.isAbsolute(p) ? p : path.resolve(cwd, p)
    if (!fs.existsSync(style)) {
      throw new Error(`[mfd] style module not found: ${style}`)
    }
  }
  return {
    mcVersion: { min: mcVersion.min, max: mcVersion.max },
    description,
    entryAddonManifest: normalizeEntry(raw.entryAddonManifest, DEFAULT_ENTRY_ADDON_MANIFEST),
    entryDistAddon: normalizeEntry(raw.entryDistAddon, DEFAULT_ENTRY_DIST_ADDON),
    style,
  }
}
