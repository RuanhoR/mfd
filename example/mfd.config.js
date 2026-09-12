// @ts-check
import { defineConfig } from '@mbler/mfd'

export default defineConfig({
  // display strings accept a plain string or a { zh, en } pair
  title: { zh: '示例模组', en: 'Example Addon' },
  mcVersion: { min: '1.21.0', max: '1.21.90' },
  description: {
    zh: '# 示例模组\n\n`@mbler/mfd` 的示例项目。\n\n在本目录运行 `npx mfd page` 并打开 http://localhost:9527。\n',
    en: '# Example Addon\n\nAn example project for `@mbler/mfd`.\n\nRun `npx mfd page` in this folder and open http://localhost:9527.\n',
  },
  // api endpoints can be redefined:
  entryAddonManifest: '/api/manifest.addon.json',
  entryDistAddon: '/api/dist.addon',
  // page build output directory (mfd page) and the built addon file:
  distEntry: './dist-page',
  addon: './dist.addon',
  // preview server port (mfd serve):
  port: 9527,
  // override built-in ui strings:
  i18n: {
    download: { zh: '下载模组', en: 'Download addon' },
  },
  // custom page theme/behavior (vitepress-like layout):
  style: './mfd.style.ts',
})
