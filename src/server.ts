import http from 'node:http'
import path from 'node:path'
import fsp from 'node:fs/promises'
import type { MfdConfig, MfdLocale } from './config'
import { STYLE_ENTRY } from './config'
import {
  bundleStyle,
  manifestFromConfig,
  renderIndexHtml,
  defaultFrontendDist,
} from './render'

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

export interface ServeOptions {
  config: MfdConfig
  cwd?: string
  /** overrides config.port */
  port?: number
  host?: string
  /** override the frontend dist directory shipped with the package */
  root?: string
}

/** locale -> rendered index.html cache */
const indexCache = new Map<string, string>()

function pickLocale(acceptLanguage: string | undefined): MfdLocale {
  if (acceptLanguage && acceptLanguage.toLowerCase().includes('zh')) {
    return 'zh'
  }
  return 'en'
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

/**
 * `mfd serve`: preview server for development. Serves the client
 * bundle with runtime SSG rendering, the manifest, the addon file
 * and the style module at their (redefinable) entry paths.
 * For production, prefer `mfd page` + any static host.
 */
export async function startServeServer(options: ServeOptions): Promise<void> {
  const config = options.config
  const root = path.resolve(options.root ?? defaultFrontendDist())
  const port = options.port ?? config.port ?? 9527
  const host = options.host ?? 'localhost'

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
        if (!config.addon) {
          return send(res, 404, "no 'addon' configured in mfd.config.js", 'text/plain; charset=utf-8')
        }
        try {
          const data = await fsp.readFile(config.addon)
          return send(res, 200, data, 'application/octet-stream', {
            'Content-Disposition': `attachment; filename="${path.basename(config.addon)}"`,
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
      let html = indexCache.get(locale)
      if (!html) {
        html = await renderIndexHtml(root, config, locale)
        indexCache.set(locale, html)
      }
      send(res, 200, html, 'text/html; charset=utf-8')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      send(res, 500, msg, 'text/plain; charset=utf-8')
    }
  })

  await new Promise<void>((resolve) => server.listen(port, host, resolve))
  const base = `http://${host}:${port}`
  console.log(`[mfd] page      ${base}`)
  console.log(`[mfd] manifest  ${base}${config.entryAddonManifest}`)
  if (config.addon) {
    console.log(`[mfd] addon     ${base}${config.entryDistAddon} <- ${config.addon}`)
  } else {
    console.warn(`[mfd] addon     ${base}${config.entryDistAddon} <- missing (no 'addon' in mfd.config.js)`)
  }
  if (config.style) {
    console.log(`[mfd] style     ${base}${STYLE_ENTRY} <- ${config.style}`)
  }
  console.log('[mfd] ctrl+c to stop')
}
