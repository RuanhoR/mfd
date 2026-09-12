import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import App from './App.vue'
import { setI18nOverrides, locale } from './i18n'
import { bakedConfig } from './runtime'
import { resolveLocalized } from './localized'
import type { Locale } from './localized'

export interface RenderedPage {
  /** inner html of <div id="app"> */
  html: string
  /** page title derived from the manifest */
  title: string
}

export interface RenderOptions {
  /** locale to render the static html with (default: en) */
  locale?: Locale
}

// ui string overrides are baked at build time (mfd.config.js `i18n`)
setI18nOverrides(bakedConfig.i18n)

/**
 * Server-side render of the page (vitepress-like SSG): the manifest
 * comes from the virtual module baked at build time, so crawlers get
 * the actual content as static html. `mfd serve` calls this per
 * requested locale; `mfd page` renders its configured locale.
 */
export async function renderPage(
  options: RenderOptions = {}
): Promise<RenderedPage> {
  const renderLocale = options.locale ?? 'en'
  locale.value = renderLocale

  const manifest = bakedConfig.manifest
  const app = createSSRApp({
    render: () => h(App, { initialManifest: manifest }),
  })
  const html = await renderToString(app)

  const rawTitle = manifest.title ?? manifest.name
  const title =
    (rawTitle ? resolveLocalized(rawTitle, renderLocale) : '') || 'MFD'
  return { html, title }
}
