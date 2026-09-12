export type MfdThemeMode = 'light' | 'dark'
export type MfdLocale = 'en' | 'zh'

export interface MfdManifest {
  name?: string
  description: string
  distAddon: string
  mcVersion: { min: string; max: string }
}

export interface MfdStyleApi {
  root: HTMLElement
  vue: Record<string, unknown>
  readonly manifest: MfdManifest | null
  readonly theme: MfdThemeMode
  readonly locale: MfdLocale
  setThemeVars(vars: Record<string, string>): void
  setTheme(mode: MfdThemeMode): void
  onThemeChange(cb: (mode: MfdThemeMode) => void): void
  setLocale(locale: MfdLocale): void
  onLocaleChange(cb: (locale: MfdLocale) => void): void
  onManifest(cb: (manifest: MfdManifest) => void): void
  setTitle(title: string): void
  replaceRoot(component: unknown, props?: Record<string, unknown>): void
  registerComponent(name: string, component: unknown): void
}

export interface MfdStyleModule {
  theme?: Record<string, string>
  setup?: (api: MfdStyleApi) => void | Promise<void>
  default?: (api: MfdStyleApi) => void | Promise<void>
}
