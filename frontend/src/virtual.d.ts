/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<
    Record<string, never>,
    Record<string, never>,
    unknown
  >
  export default component
}

declare module 'virtual:mfd-config' {
  import type { Localized } from './localized'
  import type { ManifestAddon } from './api'

  interface MfdBakedConfig {
    /** manifest.addon.json baked at build time */
    manifest: ManifestAddon
    /** ui string overrides from the mfd.config.js `i18n` field */
    i18n?: Record<string, Localized>
    /** api path serving the manifest (base-prefixed) */
    entryAddonManifest: string
    /** api path of the bundled style module, null when unset */
    entryStyle: string | null
  }

  const config: MfdBakedConfig
  export default config
}
