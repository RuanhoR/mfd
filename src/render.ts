import path from 'node:path'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { rolldown } from 'rolldown'
import type { MfdConfig, MfdLocale } from './config'
import { STYLE_ENTRY } from './config'

/** frontend dist shipped with this package (dist/index.mjs -> ../frontend/dist) */
export function defaultFrontendDist(): string {
  return fileURLToPath(new URL('../frontend/dist', import.meta.url))
}

export interface StyleBundle {
  mtimeMs: number
  code: string
}
const styleBundleCache = new Map<string, StyleBundle>()

/** bundle a TS style module with rolldown, cached by mtime */
export async function bundleStyle(stylePath: string): Promise<string> {
  const stat = await fsp.stat(stylePath)
  const cached = styleBundleCache.get(stylePath)
  if (cached && cached.mtimeMs === stat.mtimeMs) return cached.code
  const bundle = await rolldown({
    input: stylePath,
    platform: 'browser',
  })
  const { output } = await bundle.generate({ format: 'esm' })
  await bundle.close()
  const code = output[0]?.code ?? ''
  styleBundleCache.set(stylePath, { mtimeMs: stat.mtimeMs, code })
  return code
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export function manifestFromConfig(config: MfdConfig): {
  title?: MfdConfig['title']
  description: MfdConfig['description']
  distAddon: string
  mcVersion: { min: string; max: string }
} {
  return {
    title: config.title ?? undefined,
    description: config.description,
    distAddon: config.entryDistAddon,
    mcVersion: config.mcVersion,
  }
}

export interface PageRenderer {
  renderPage: (
    manifest: unknown,
    options?: { locale?: MfdLocale; i18n?: Record<string, unknown> }
  ) => Promise<{ html: string; title: string }>
}

let pageRenderer: PageRenderer | null = null
let pageRendererTried = false

/** load the ssr bundle shipped in frontend/dist/server */
export async function loadPageRenderer(root: string): Promise<PageRenderer | null> {
  if (pageRendererTried) return pageRenderer
  pageRendererTried = true
  const serverEntry = path.join(root, 'server', 'entry-server.js')
  if (!fs.existsSync(serverEntry)) return null
  try {
    const mod = (await import(
      pathToFileURL(serverEntry).href
    )) as unknown as PageRenderer
    if (typeof mod.renderPage === 'function') pageRenderer = mod
  } catch (err) {
    console.warn('[mfd] failed to load ssr bundle, fallback to plain html:',
      err instanceof Error ? err.message : err)
  }
  return pageRenderer
}

/** serialize ssr renders (locale is module state in the renderer) */
let renderQueue: Promise<unknown> = Promise.resolve()

/**
 * vitepress-like SSG: render the page with the real manifest from
 * mfd.config.js into static html (good for SEO), then the client
 * bundle hydrates it.
 */
export async function renderIndexHtml(
  root: string,
  config: MfdConfig,
  locale: MfdLocale
): Promise<string> {
  const templatePath = path.join(root, 'index.template.html')
  let template: string
  try {
    template = await fsp.readFile(templatePath, 'utf-8')
  } catch {
    template = await fsp.readFile(path.join(root, 'index.html'), 'utf-8')
  }

  const runtime = {
    entryAddonManifest: config.entryAddonManifest,
    entryStyle: config.style ? STYLE_ENTRY : null,
    locale,
    i18n: config.i18n ?? undefined,
  }
  const manifest = manifestFromConfig(config)

  let html = template
  const renderer = await loadPageRenderer(root)
  if (renderer) {
    // queue renders so concurrent requests of different locales
    // cannot interleave (locale is module state in the renderer)
    const run = renderQueue.then(async () => {
      const { html: body, title } = await renderer.renderPage(manifest, {
        locale,
        i18n: config.i18n ?? undefined,
      })
      return { body, title }
    })
    renderQueue = run.catch(() => undefined)
    const { body, title } = await run
    html = html.replace('<div id="app"></div>', `<div id="app">${body}</div>`)
    if (title) {
      html = html.replace('<title>MFD</title>', `<title>${escapeHtml(title)}</title>`)
    }
  }
  const state = `<script>window.__MFD_CONFIG__ = ${JSON.stringify(runtime).replaceAll('<', '\\u003c')};window.__MFD_MANIFEST__ = ${JSON.stringify(manifest).replaceAll('<', '\\u003c')}</script>`
  html = html.includes('</head>')
    ? html.replace('</head>', `${state}</head>`)
    : state + html

  return html
}
