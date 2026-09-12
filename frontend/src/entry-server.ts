import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import App from './App.vue'
import { setI18nOverrides, locale } from './i18n'
import { resolveLocalized } from './localized'
import type { ManifestAddon } from './api'
import type { Locale, Localized } from './localized'

export interface RenderedPage {
  /** inner html of <div id="app"> */
  html: string
  /** page title derived from the manifest */
  title: string
}

export interface RenderOptions {
  /** locale to render the static html with (default: en) */
  locale?: Locale
  /** ui string overrides from the mfd.config.js `i18n` field */
  i18n?: Record<string, Localized>
}

/**
 * Server-side render of the page (vitepress-like SSG):
 * the mfd page server calls this at runtime with the real
 * manifest built from mfd.config.js, so crawlers get the
 * actual content as static html, then the client bundle hydrates it.
 */
export async function renderPage(
  manifest: ManifestAddon,
  options: RenderOptions = {}
): Promise<RenderedPage> {
  const renderLocale = options.locale ?? 'en'
  setI18nOverrides(options.i18n)
  locale.value = renderLocale

  const app = createSSRApp({
    render: () => h(App, { initialManifest: manifest }),
  })
  const html = await renderToString(app)

  const rawTitle = manifest.title ?? manifest.name
  const title =
    (rawTitle ? resolveLocalized(rawTitle, renderLocale) : '') || 'MFD'
  return { html, title }
}
