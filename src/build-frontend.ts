import path from 'node:path'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build as viteBuild, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import type { MfdConfig, MfdLocale } from './config'
import { withBase, STYLE_ENTRY } from './config'

/** frontend source shipped inside the package, used as the build template */
export function frontendTemplateDir(): string {
  return fileURLToPath(new URL('../frontend', import.meta.url))
}

export interface PrepareFrontendOptions {
  config: MfdConfig
  /** output directory for the client bundle (index.html + assets) */
  outDir: string
  /** override the frontend template directory */
  root?: string
}

export interface PreparedFrontend {
  /**
   * render the full index.html for a locale: vitepress-like ssr of the
   * baked manifest into the client index.html, plus the render-locale
   * injection so the client's first render matches (then the ui
   * follows the system language)
   */
  renderHtml(locale: MfdLocale): Promise<string>
  /** remove the temporary ssr bundle */
  cleanup(): void
}

interface SsrRenderer {
  renderPage: (options?: {
    locale?: MfdLocale
  }) => Promise<{ html: string; title: string }>
}

/** virtual module values baked into the build */
interface MfdVirtualValues {
  manifest: Record<string, unknown>
  i18n?: Record<string, unknown>
  entryAddonManifest: string
  entryStyle: string | null
}

function mfdVirtual(values: MfdVirtualValues): Plugin {
  return {
    name: 'mfd-virtual',
    resolveId(id) {
      if (id === 'virtual:mfd-config') return '\0virtual:mfd-config'
    },
    load(id) {
      if (id === '\0virtual:mfd-config') {
        return `export default ${JSON.stringify(values).replaceAll('<', '\\u003c')}`
      }
    },
  }
}

function virtualValues(config: MfdConfig): MfdVirtualValues {
  const manifest = {
    title: config.title ?? undefined,
    description: config.description,
    distAddon: withBase(config.base, config.entryDistAddon),
    mcVersion: config.mcVersion,
    isBeta: config.isBeta,
  }
  return {
    manifest,
    i18n: config.i18n ?? undefined,
    entryAddonManifest: withBase(config.base, config.entryAddonManifest),
    entryStyle: config.style ? withBase(config.base, STYLE_ENTRY) : null,
  }
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

/**
 * runtime vite build of the shipped frontend template:
 * - client bundle into `outDir` with `base` as the vite base, so asset
 *   urls match the deployment path, and the manifest/i18n/entry paths
 *   baked in via the virtual module
 * - ssr bundle into a temp dir (kept for per-locale renders until
 *   `cleanup()`)
 */
export async function prepareFrontend(
  options: PrepareFrontendOptions
): Promise<PreparedFrontend> {
  const config = options.config
  const templateDir = path.resolve(options.root ?? frontendTemplateDir())
  const outDir = path.resolve(options.outDir)
  const plugins = [vue(), mfdVirtual(virtualValues(config))]

  await viteBuild({
    root: templateDir,
    configFile: false,
    base: config.base,
    plugins,
    build: {
      outDir,
      emptyOutDir: true,
    },
    logLevel: 'warn',
  })
  // the dev-only demo manifest from public/ must not ship
  await fsp.rm(path.join(outDir, 'manifest.addon.json'), { force: true })

  const ssrDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'mfd-ssr-'))
  try {
    await viteBuild({
      root: templateDir,
      configFile: false,
      base: config.base,
      plugins,
      build: {
        outDir: ssrDir,
        emptyOutDir: true,
        ssr: path.resolve(templateDir, 'src/entry-server.ts'),
      },
      ssr: {
        // bundle vue/marked into the ssr bundle so the render needs no
        // additional dependencies at runtime
        noExternal: true,
      },
      logLevel: 'warn',
    })
  } catch (err) {
    fs.rmSync(ssrDir, { recursive: true, force: true })
    throw err
  }

  const serverEntry = path.join(ssrDir, 'entry-server.js')
  const mod = (await import(
    pathToFileURL(serverEntry).href
  )) as unknown as SsrRenderer
  const template = await fsp.readFile(path.join(outDir, 'index.html'), 'utf-8')

  return {
    async renderHtml(locale: MfdLocale): Promise<string> {
      const { html, title } = await mod.renderPage({ locale })
      let out = template.replace(
        '<div id="app"></div>',
        `<div id="app">${html}</div>`
      )
      if (title) {
        out = out.replace(
          /<title>.*?<\/title>/,
          `<title>${escapeHtml(title)}</title>`
        )
      }
      const state = `<script>window.__MFD_RENDER_LOCALE__ = ${JSON.stringify(locale)}</script>`
      out = out.includes('</head>')
        ? out.replace('</head>', `${state}</head>`)
        : state + out
      return out
    },
    cleanup(): void {
      fs.rmSync(ssrDir, { recursive: true, force: true })
    },
  }
}
