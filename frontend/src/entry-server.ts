import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import App from './App.vue'
import type { ManifestAddon } from './api'

export interface RenderedPage {
  /** inner html of <div id="app"> */
  html: string
  /** page title derived from the manifest */
  title: string
}

/**
 * Server-side render of the page (vitepress-like SSG):
 * the mfd page server calls this at runtime with the real
 * manifest built from mfd.config.js, so crawlers get the
 * actual content as static html.
 */
export async function renderPage(
  manifest: ManifestAddon
): Promise<RenderedPage> {
  const app = createSSRApp({
    render: () => h(App, { initialManifest: manifest }),
  })
  const html = await renderToString(app)
  return { html, title: manifest.name || 'MFD' }
}
