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

export interface PageBuildOptions {
  config: MfdConfig
  cwd?: string
  /** output directory override (default: config.distEntry or 'dist-page') */
  out?: string
  /**
   * locale for the static index.html render (default: en).
   * the client follows the system language after hydration,
   * so this only decides what crawlers see by default.
   */
  locale?: MfdLocale
  /** override the frontend dist directory shipped with the package */
  root?: string
}

/** '/api/manifest.addon.json' + outDir -> outDir/api/manifest.addon.json */
function entryToPath(outDir: string, entry: string): string {
  return path.join(outDir, entry.replace(/^\/+/, ''))
}

/**
 * `mfd page`: vitepress-like static build. Copies the client bundle,
 * renders index.html (plus 404.html as the static-host fallback) with
 * the real manifest from mfd.config.js, and writes the manifest, the
 * addon file and the style module at their (redefinable) entry paths.
 * The result is a self-contained folder deployable to any static host.
 */
export async function buildPage(options: PageBuildOptions): Promise<string> {
  const cwd = options.cwd ?? process.cwd()
  const config = options.config
  const root = path.resolve(options.root ?? defaultFrontendDist())
  const outDir = path.resolve(
    cwd,
    options.out ?? config.distEntry ?? 'dist-page'
  )
  const locale = options.locale ?? 'en'

  await fsp.rm(outDir, { recursive: true, force: true })
  await fsp.mkdir(outDir, { recursive: true })
  await fsp.cp(root, outDir, { recursive: true })
  // internal artifacts of the shipped bundle
  await fsp.rm(path.join(outDir, 'server'), { recursive: true, force: true })
  await fsp.rm(path.join(outDir, 'index.template.html'), { force: true })
  // the dev-only demo manifest must not ship
  await fsp.rm(path.join(outDir, 'manifest.addon.json'), { force: true })

  const html = await renderIndexHtml(root, config, locale)
  await fsp.writeFile(path.join(outDir, 'index.html'), html, 'utf-8')
  await fsp.writeFile(path.join(outDir, '404.html'), html, 'utf-8')

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
      `[mfd] no 'addon' configured, ${config.entryDistAddon} will 404`
    )
  }

  if (config.style) {
    const code = await bundleStyle(config.style)
    const styleFile = entryToPath(outDir, STYLE_ENTRY)
    await fsp.mkdir(path.dirname(styleFile), { recursive: true })
    await fsp.writeFile(styleFile, code, 'utf-8')
  }

  console.log(`[mfd] page -> ${outDir} (locale: ${locale})`)
  console.log(`[mfd]   index.html + 404.html`)
  console.log(`[mfd]   ${config.entryAddonManifest}`)
  if (config.addon) {
    console.log(`[mfd]   ${config.entryDistAddon} <- ${config.addon}`)
  } else {
    console.warn(`[mfd]   ${config.entryDistAddon} <- missing (no 'addon' in mfd.config.js)`)
  }
  if (config.style) {
    console.log(`[mfd]   ${STYLE_ENTRY} <- ${config.style}`)
  }
  console.log('[mfd] deploy the folder to any static host, or preview with `mfd serve`')
  return outDir
}
