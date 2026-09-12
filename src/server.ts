import http from 'node:http'
import path from 'node:path'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { rolldown } from 'rolldown'
import type { MfdConfig } from './config'
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
  /** path to the .addon file served at entryDistAddon, relative to cwd */
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
  description: string
  distAddon: string
  mcVersion: { min: string; max: string }
} {
  return {
    description: config.description,
    distAddon: config.entryDistAddon,
    mcVersion: config.mcVersion,
  }
}

interface PageRenderer {
  renderPage: (manifest: unknown) => Promise<{ html: string; title: string }>
}

let pageRenderer: PageRenderer | null = null
let pageRendererTried = false
let renderedIndex: string | null = null

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
 * then the client bundle hydrates it.
 */
async function renderIndexHtml(root: string, config: MfdConfig): Promise<string> {
  if (renderedIndex) return renderedIndex

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
  }
  const manifest = manifestFromConfig(config)

  let html = template
  const renderer = await loadPageRenderer(root)
  if (renderer) {
    const { html: body, title } = await renderer.renderPage(manifest)
    html = html.replace('<div id="app"></div>', `<div id="app">${body}</div>`)
    if (title) {
      html = html.replace('<title>MFD</title>', `<title>${escapeHtml(title)}</title>`)
    }
  }
  const state = `<script>window.__MFD_CONFIG__ = ${JSON.stringify(runtime).replaceAll('<', '\\u003c')};window.__MFD_MANIFEST__ = ${JSON.stringify(manifest).replaceAll('<', '\\u003c')}</script>`
  html = html.includes('</head>')
    ? html.replace('</head>', `${state}</head>`)
    : state + html

  renderedIndex = html
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
  const addonFile = path.resolve(cwd, options.addon ?? 'dist.addon')
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

      // SPA/SSG fallback
      const html = await renderIndexHtml(root, config)
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
