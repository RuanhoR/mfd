export type MfdThemeMode = 'light' | 'dark'
export type MfdLocale = 'en' | 'zh'

export interface MfdManifest {
  name?: string
  description: string
  distAddon: string
  mcVersion: { min: string; max: string }
}

/**
 * API handed to a custom style module (`style` field of mfd.config.js).
 * The module is bundled with esbuild and served at /mfd.style.js,
 * the page loads it before mounting and hands over full control:
 * tweak theme variables, hook into theme/locale/manifest events, or
 * replace the whole page with your own component (`replaceRoot`).
 */
export interface MfdStyleApi {
  /** mount target element (#app) */
  root: HTMLElement
  /** live vue runtime exports (ref, computed, defineComponent, h, ...) so no `vue` import is needed */
  vue: Record<string, unknown>
  /** loaded manifest.addon.json, null until fetched */
  readonly manifest: MfdManifest | null
  /** current theme mode */
  readonly theme: MfdThemeMode
  /** current ui locale */
  readonly locale: MfdLocale
  /** override css variables; keys without `--` prefix are treated as `--mfd-<key>` */
  setThemeVars(vars: Record<string, string>): void
  setTheme(mode: MfdThemeMode): void
  onThemeChange(cb: (mode: MfdThemeMode) => void): void
  setLocale(locale: MfdLocale): void
  onLocaleChange(cb: (locale: MfdLocale) => void): void
  /** called when manifest.addon.json is fetched; fires immediately if already loaded */
  onManifest(cb: (manifest: MfdManifest) => void): void
  /** set the document title */
  setTitle(title: string): void
  /** replace the default page with your own root component (must run before mount) */
  replaceRoot(component: unknown, props?: Record<string, unknown>): void
  /** register a global component usable from templates (must run before mount) */
  registerComponent(name: string, component: unknown): void
}

export interface MfdStyleModule {
  /** static theme variables applied before setup() runs */
  theme?: Record<string, string>
  setup?: (api: MfdStyleApi) => void | Promise<void>
  default?: (api: MfdStyleApi) => void | Promise<void>
}

/** identity helper so IDEs can type-check a style module */
export function defineStyle(module: MfdStyleModule): MfdStyleModule {
  return module
}
