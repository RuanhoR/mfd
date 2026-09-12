import { defineConfig } from '@mbler/mfd'

export default defineConfig({
  mcVersion: { min: '1.21.0', max: '1.21.90' },
  description:
    '# Example Addon\n\nAn example project for `@mbler/mfd`.\n\nRun `npx mfd page` in this folder and open http://localhost:9527.\n',
  // api endpoints can be redefined:
  entryAddonManifest: '/api/manifest.addon.json',
  entryDistAddon: '/api/dist.addon',
  // custom page theme/behavior:
  style: './mfd.style.ts',
})
