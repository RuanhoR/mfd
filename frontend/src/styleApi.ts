import * as vueRuntime from 'vue'
import type { Component } from 'vue'
import { entryStyle } from './runtime'
import { theme, setTheme } from './theme'
import { locale, setLocale, t as translate } from './i18n'
import { themeBus, localeBus, manifestBus } from './events'
import * as components from './components'
import type {
  MfdStyleApi,
  MfdStyleModule,
  MfdManifest,
} from './style-types'

export interface StyleApiHandle {
  api: MfdStyleApi
  /** layout component set via setLayout/replaceRoot, used at mount time */
  customLayout: Component | null
  /** global components registered via registerComponent */
  queuedComponents: Array<[string, unknown]>
}

let currentManifest: MfdManifest | null = null

export function createStyleApi(
  root: HTMLElement = document.getElementById('app') as HTMLElement
): StyleApiHandle {
  const handle: StyleApiHandle = {
    customLayout: null,
    queuedComponents: [],
    api: null as unknown as MfdStyleApi,
  }

  handle.api = {
    root,
    vue: vueRuntime as unknown as Record<string, unknown>,
    components: components as unknown as Record<string, unknown>,
    get manifest() {
      return currentManifest
    },
    get theme() {
      return theme.value
    },
    get locale() {
      return locale.value
    },
    t: translate,
    setThemeVars(vars) {
      const el = document.documentElement
      for (const [key, value] of Object.entries(vars)) {
        el.style.setProperty(key.startsWith('--') ? key : `--mfd-${key}`, value)
      }
    },
    setTheme(mode) {
      setTheme(mode)
    },
    onThemeChange(cb) {
      themeBus.on(cb)
    },
    setLocale(l) {
      setLocale(l)
    },
    onLocaleChange(cb) {
      localeBus.on(cb)
    },
    onManifest(cb) {
      manifestBus.on(cb)
    },
    setTitle(title) {
      document.title = title
    },
    setLayout(layout) {
      handle.customLayout = layout as Component
    },
    replaceRoot(component) {
      handle.customLayout = component as Component
    },
    registerComponent(name, component) {
      handle.queuedComponents.push([name, component])
    },
  }

  return handle
}

/** load the custom style module (served by the mfd page server) and run it */
export async function loadCustomStyle(handle: StyleApiHandle): Promise<void> {
  if (!entryStyle) return
  const mod = (await import(/* @vite-ignore */ entryStyle)) as MfdStyleModule
  if (mod.theme) handle.api.setThemeVars(mod.theme)
  if (mod.layout) handle.api.setLayout(mod.layout)
  const setup = mod.default ?? mod.setup
  if (setup) await setup(handle.api)
}

export function emitManifest(manifest: MfdManifest): void {
  currentManifest = manifest
  manifestBus.emit(manifest)
}
