import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * dev/build values for the `virtual:mfd-config` module. `mfd page` and
 * `mfd serve` rebuild with their own virtual plugin (configFile: false),
 * vite dev uses the demo manifest from public/.
 */
function mfdVirtualDev(): Plugin {
  const manifest = JSON.parse(
    readFileSync(new URL('./public/manifest.addon.json', import.meta.url), 'utf-8')
  )
  const runtime = {
    manifest,
    entryAddonManifest: '/manifest.addon.json',
    entryStyle: null,
    i18n: undefined,
  }
  return {
    name: 'mfd-virtual-dev',
    resolveId(id) {
      if (id === 'virtual:mfd-config') return '\0virtual:mfd-config'
    },
    load(id) {
      if (id === '\0virtual:mfd-config') {
        return `export default ${JSON.stringify(runtime).replaceAll('<', '\\u003c')}`
      }
    },
  }
}

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [vue(), mfdVirtualDev()],
  base: './',
  publicDir: isSsrBuild ? false : 'public',
  build: {
    outDir: isSsrBuild ? 'dist/server' : 'dist',
    emptyOutDir: !isSsrBuild,
  },
  ssr: {
    // bundle vue/marked into the server bundle so the ssr render
    // needs no additional dependencies at runtime
    noExternal: true,
  },
}))
