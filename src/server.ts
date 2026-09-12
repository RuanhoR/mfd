import http from 'node:http'
import path from 'node:path'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { rolldown } from 'rolldown'
import type { MfdConfig, MfdLocale } from './config'
import { STYLE_ENTRY } from './config'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
}

export interface PageServerOptions {
  config: MfdConfig
  cwd?: string
  port?: number
  host?: string
  /** path to the addon file served at entryDistAddon, overrides config.distEntry */
  addon?: string
  /** override the static frontend dist directory */
  root?: string
}

/** frontend dist shipped with this package (dist/index.mjs -> ../frontend/dist) */
export function defaultFrontendDist(): string {
  return fileURLToPath(new URL('../frontend/dist', import.meta.url))
}

interface StyleBundle {
  mtimeMs: number
  code: string
}
const styleBundleCache = new Map<string, StyleBundle>()

async function bundleStyle(stylePath: string): Promise<string> {
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

function manifestFromConfig(config: MfdConfig): {
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

function pickLocale(acceptLanguage: string | undefined): MfdLocale {
  if (acceptLanguage && acceptLanguage.toLowerCase().includes('zh')) {
    return 'zh'
  }
  return 'en'
}

interface PageRenderer {
  renderPage: (
    manifest: unknown,
    options?: { locale?: MfdLocale; i18n?: Record<string, unknown> }
  ) => Promise<{ html: string; title: string }>
}

let pageRenderer: PageRenderer | null = null
let pageRendererTried = false
/** locale -> rendered static html */
const renderedIndexCache = new Map<string, string>()
/** serializes ssr renders (locale is module state in the renderer) */
let renderQueue: Promise<unknown> = Promise.resolve()

async function loadPageRenderer(root: string): Promise<PageRenderer | null> {
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

/**
 * vitepress-like SSG at runtime: render the page with the real
 * manifest from mfd.config.js into static html (good for SEO),
 * then the client bundle hydrates it. Rendered per requested
 * locale (Accept-Language) and cached.
 */
async function renderIndexHtml(
  root: string,
  config: MfdConfig,
  locale: MfdLocale
): Promise<string> {
  const cached = renderedIndexCache.get(locale)
  if (cached) return cached

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

  renderedIndexCache.set(locale, html)
  return html
}

function send(
  res: http.ServerResponse,
  status: number,
  data: string | Buffer,
  mime: string,
  headers: Record<string, string> = {}
): void {
  res.writeHead(status, { 'Content-Type': mime, ...headers })
  res.end(data)
}

async function serveStatic(
  root: string,
  pathname: string
): Promise<{ data: Buffer; mime: string } | null> {
  const rel = pathname.replace(/^\/+/, '')
  if (!rel) return null
  const file = path.resolve(root, rel)
  if (path.relative(root, file).startsWith('..')) return null
  try {
    const stat = await fsp.stat(file)
    if (stat.isDirectory()) return null
    const mime = MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream'
    return { data: await fsp.readFile(file), mime }
  } catch {
    return null
  }
}

export async function startPageServer(options: PageServerOptions): Promise<void> {
  const cwd = options.cwd ?? process.cwd()
  const root = path.resolve(options.root ?? defaultFrontendDist())
  // cli --addon overrides config.distEntry, fallback dist.addon
  const addonFile = path.resolve(cwd, options.addon ?? config_addon(options))
  const config = options.config

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return send(res, 405, 'method not allowed', 'text/plain; charset=utf-8')
      }
      const url = new URL(req.url ?? '/', 'http://localhost')
      const pathname = decodeURIComponent(url.pathname)

      if (pathname === config.entryAddonManifest) {
        const manifest = manifestFromConfig(config)
        return send(res, 200, JSON.stringify(manifest), 'application/json; charset=utf-8')
      }

      if (pathname === config.entryDistAddon) {
        try {
          const data = await fsp.readFile(addonFile)
          return send(res, 200, data, 'application/octet-stream', {
            'Content-Disposition': `attachment; filename="${path.basename(addonFile)}"`,
          })
        } catch {
          return send(res, 404, 'addon file not found', 'text/plain; charset=utf-8')
        }
      }

      if (pathname === STYLE_ENTRY) {
        if (!config.style) {
          return send(res, 404, 'no style module configured', 'text/plain; charset=utf-8')
        }
        const code = await bundleStyle(config.style)
        return send(res, 200, code, 'text/javascript; charset=utf-8')
      }

      const staticFile = await serveStatic(root, pathname)
      if (staticFile) {
        return send(res, 200, staticFile.data, staticFile.mime)
      }

      // SPA/SSG fallback, rendered per requested locale
      const locale = pickLocale(req.headers['accept-language'])
      const html = await renderIndexHtml(root, config, locale)
      send(res, 200, html, 'text/html; charset=utf-8')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      send(res, 500, msg, 'text/plain; charset=utf-8')
    }
  })

  const port = options.port ?? 9527
  const host = options.host ?? 'localhost'
  await new Promise<void>((resolve) => server.listen(port, host, resolve))
  const base = `http://${host}:${port}`
  console.log(`[mfd] page      ${base}`)
  console.log(`[mfd] manifest  ${base}${config.entryAddonManifest}`)
  console.log(`[mfd] addon     ${base}${config.entryDistAddon} <- ${addonFile}`)
  if (config.style) {
    console.log(`[mfd] style     ${base}${STYLE_ENTRY} <- ${config.style}`)
  }
  console.log('[mfd] ctrl+c to stop')
}

function config_addon(options: PageServerOptions): string {
  return options.config.distEntry ?? 'dist.addon'
}
