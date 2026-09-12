import path from 'node:path'
import fsp from 'node:fs/promises'
import type { MfdConfig, MfdLocale } from './config'
import { STYLE_ENTRY, withBase } from './config'
import { bundleStyle, manifestFromConfig } from './render'
import { prepareFrontend } from './build-frontend'

export interface PageBuildOptions {
  config: MfdConfig
  cwd?: string
  /** output root override (default: config.distEntry or 'dist-page'); the page lands in <root>/<base> */
  out?: string
  /**
   * locale for the static index.html render (default: en).
   * the client follows the system language after hydration,
   * so this only decides what crawlers see by default.
   */
  locale?: MfdLocale
  /** override the frontend template directory */
  root?: string
}

/** '/api/manifest.addon.json' + outDir -> outDir/api/manifest.addon.json
 * (outDir already includes the base path segment) */
function entryToPath(outDir: string, entry: string): string {
  return path.join(outDir, entry.replace(/^\/+/, ''))
}

/**
 * `mfd page`: vitepress-like static build. Runs a runtime vite build of
 * the shipped frontend template (with `base` as the vite base and the
 * manifest/i18n/entry paths baked in), prerenders index.html (+404.html
 * as the static-host fallback) and writes the manifest, the addon file
 * and the style module at their (redefinable) entry paths under
 * `<distEntry>/<base>`. The result is deployable to any static host.
 */
export async function buildPage(options: PageBuildOptions): Promise<string> {
  const cwd = path.resolve(options.cwd ?? process.cwd())
  const config = options.config
  const outRoot = path.resolve(
    cwd,
    options.out ?? config.distEntry ?? 'dist-page'
  )
  // the whole output root is emptied on every build
  const rel = path.relative(outRoot, cwd)
  const cwdInsideOutRoot = rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
  if (cwdInsideOutRoot) {
    throw new Error(
      `[mfd] refusing to build into the project directory: ${outRoot}`
    )
  }
  const base = config.base
  const outDir =
    base === '/' ? outRoot : path.join(outRoot, base.replace(/^\/+|\/+$/g, ''))
  const locale = options.locale ?? 'en'

  await fsp.rm(outRoot, { recursive: true, force: true })
  await fsp.mkdir(outDir, { recursive: true })

  const frontend = await prepareFrontend({
    config,
    outDir,
    root: options.root,
  })
  try {
    const html = await frontend.renderHtml(locale)
    await fsp.writeFile(path.join(outDir, 'index.html'), html, 'utf-8')
    await fsp.writeFile(path.join(outDir, '404.html'), html, 'utf-8')
  } finally {
    frontend.cleanup()
  }

  const manifest = manifestFromConfig(config)
  const manifestFile = entryToPath(outDir, config.entryAddonManifest)
  await fsp.mkdir(path.dirname(manifestFile), { recursive: true })
  await fsp.writeFile(manifestFile, JSON.stringify(manifest, null, 2), 'utf-8')

  if (config.addon) {
    const addonFile = entryToPath(outDir, config.entryDistAddon)
    await fsp.mkdir(path.dirname(addonFile), { recursive: true })
    await fsp.cp(config.addon, addonFile)
  } else {
    console.warn(
      `[mfd] no 'addon' configured, ${withBase(base, config.entryDistAddon)} will 404`
    )
  }

  if (config.style) {
    const code = await bundleStyle(config.style)
    const styleFile = entryToPath(outDir, STYLE_ENTRY)
    await fsp.mkdir(path.dirname(styleFile), { recursive: true })
    await fsp.writeFile(styleFile, code, 'utf-8')
  }

  console.log(`[mfd] page -> ${outDir} (base: ${base}, locale: ${locale})`)
  console.log(`[mfd]   index.html + 404.html`)
  console.log(`[mfd]   ${withBase(base, config.entryAddonManifest)}`)
  if (config.addon) {
    console.log(`[mfd]   ${withBase(base, config.entryDistAddon)} <- ${config.addon}`)
  } else {
    console.warn(
      `[mfd]   ${withBase(base, config.entryDistAddon)} <- missing (no 'addon' in mfd.config.js)`
    )
  }
  if (config.style) {
    console.log(`[mfd]   ${withBase(base, STYLE_ENTRY)} <- ${config.style}`)
  }
  console.log(
    '[mfd] deploy the folder to any static host, or preview with `mfd serve`'
  )
  return outDir
}
