import { createSSRApp, h } from 'vue'
import type { Component } from 'vue'
import App from './App.vue'
import './style.css'
import { initTheme } from './theme'
import { initLocale, setI18nOverrides } from './i18n'
import { createStyleApi, loadCustomStyle } from './styleApi'
import { getClientManifest, configI18n } from './api'

async function bootstrap(): Promise<void> {
  setI18nOverrides(configI18n)
  const handle = createStyleApi()
  await loadCustomStyle(handle).catch((err) => {
    console.warn('[mfd] custom style module failed:', err)
  })

  const clientManifest = getClientManifest()
  let root: Component
  if (handle.customLayout) {
    // vitepress-like custom layout, receives the style api as a prop
    root = { render: () => h(handle.customLayout!, { api: handle.api }) }
  } else if (clientManifest) {
    root = { render: () => h(App, { initialManifest: clientManifest }) }
  } else {
    root = App
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
