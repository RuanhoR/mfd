import type { MfdStyleApi } from '@mbler/mfd/style'

export default (api: MfdStyleApi): void => {
  // theme variables (keys without `--` get the `--mfd-` prefix)
  api.setThemeVars({
    'accent': '#8b5cf6',
    'accent-fg': '#ffffff',
  })

  api.setTitle('Example Addon')

  api.onManifest((m) => {
    console.log('[mfd.style] manifest loaded:', m.mcVersion)
  })

  api.onThemeChange((mode) => {
    console.log('[mfd.style] theme changed:', mode)
  })
}
