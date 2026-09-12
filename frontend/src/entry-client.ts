import { createSSRApp, h } from 'vue'
import type { Component } from 'vue'
import App from './App.vue'
import './style.css'
import { initTheme } from './theme'
import { initLocale } from './i18n'
import { createStyleApi, loadCustomStyle } from './styleApi'
import { getClientManifest } from './api'

async function bootstrap(): Promise<void> {
  const handle = createStyleApi()
  await loadCustomStyle(handle).catch((err) => {
    console.warn('[mfd] custom style module failed:', err)
  })

  let root: Component = handle.customRoot ?? App
  const clientManifest = getClientManifest()
  if (!handle.customRoot && clientManifest) {
    root = { render: () => h(App, { initialManifest: clientManifest }) }
  }

  const app = createSSRApp(root)
  for (const [name, component] of handle.queuedComponents) {
    app.component(name, component as Component)
  }
  app.mount('#app')

  // restore user preferences after hydration to avoid SSR mismatches
  initTheme()
  initLocale()
}

void bootstrap()
