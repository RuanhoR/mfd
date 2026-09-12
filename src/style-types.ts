export type MfdLocale = 'en' | 'zh'

/**
 * A display string: plain string (same for every locale) or a
 * `{ zh, en }` pair picked by the current ui locale.
 */
export type Localized = string | { zh?: string; en?: string }

export function resolveLocalized(value: Localized, locale: MfdLocale): string {
  if (typeof value === 'string') return value
  return value[locale] ?? value.en ?? value.zh ?? ''
}

export type MfdThemeMode = 'light' | 'dark'

export interface MfdManifest {
  /** page/addon title (falls back to legacy `name`) */
  title?: Localized
  /** legacy plain title from older manifests */
  name?: string
  description: Localized
  distAddon: string
  mcVersion: { min: string; max: string }
  /** use the beta @minecraft/server api (consistent with mbler script.UseBeta) */
  isBeta?: boolean
}

/**
 * API handed to a custom style module (`style` field of mfd.config.js).
 * The module is bundled with rolldown and served at /mfd.style.js,
 * the page loads it before mounting. Vitepress-like theming: provide
 * a `layout` component to take over the page, or compose the exposed
 * building blocks (`components`, `manifest`, `t`, ...) inside it.
 */
export interface MfdStyleApi {
  /** mount target element (#app) */
  root: HTMLElement
  /** live vue runtime exports (ref, computed, defineComponent, h, ...) so no `vue` import is needed */
  vue: Record<string, unknown>
  /** ready-made page building blocks for custom layouts: AddonIntro, AddonVersions */
  readonly components: Record<string, unknown>
  /** loaded manifest.addon.json, null until fetched */
  readonly manifest: MfdManifest | null
  /** current theme mode */
  readonly theme: MfdThemeMode
  /** current ui locale */
  readonly locale: MfdLocale
  /** translate a ui message key (built-in strings + configured i18n overrides) */
  t(key: string): string
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
  /** replace the default layout with your own component; it receives the api as a prop (must run before mount) */
  setLayout(layout: unknown): void
  /** alias of setLayout (must run before mount) */
  replaceRoot(component: unknown, props?: Record<string, unknown>): void
  /** register a global component usable from templates (must run before mount) */
  registerComponent(name: string, component: unknown): void
}

export interface MfdStyleModule {
  /** static theme variables applied before setup() runs */
  theme?: Record<string, string>
  /** vitepress-like custom layout component; receives the api as a prop */
  layout?: unknown
  setup?: (api: MfdStyleApi) => void | Promise<void>
  default?: (api: MfdStyleApi) => void | Promise<void>
}

/** identity helper so IDEs can type-check a style module */
export function defineStyle(module: MfdStyleModule): MfdStyleModule {
  return module
}
