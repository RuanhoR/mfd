# @mbler/mfd

Minecraft Bedrock addon downloader website & CLI.

`mfd` serves a pre-rendered (vitepress-like SSG) download page for your addon:
a markdown introduction, a Minecraft version selector backed by the same SAPI
mapping logic as `mbler build` (`mcVersion` -> `@minecraft/server`), and a
download link for your `.addon` file. The frontend supports dark mode, and
the ui language (en/zh) follows the system language automatically.

## Install

```sh
npm i -g @mbler/mfd
# or
pnpm add -D @mbler/mfd
```

## Quick start

Create `mfd.config.js` in your project:

```js
import { defineConfig } from '@mbler/mfd'

export default defineConfig({
  mcVersion: { min: '1.21.0', max: '1.21.90' },
  description: '# My Addon\n\nMarkdown introduction shown on the page.',
  // optional: redefine the api endpoints
  // entryAddonManifest: '/manifest.addon.json',
  // entryDistAddon: '/dist.addon',
  // optional: custom page theme/behavior module
  // style: './mfd.style.ts',
})
```

Then serve the page (put your built `.addon` file at `dist.addon`, or pass
`--addon path/to/file.addon`):

```sh
mfd page
# open http://localhost:9527
```

## CLI

```
mfd page      serve the addon downloader website
  -p, --port <port>    port to listen on (default: 9527)
  -H, --host <host>    host to bind (default: localhost)
  --addon <file>       path to the .addon file, relative to cwd (default: dist.addon)
  --root <dir>         custom frontend dist directory
mfd version   print the version
mfd help      show help
```

## Config: `mfd.config.js`

Read from `process.cwd()`. Loaded with a dynamic `import()` through
`pathToFileURL`, so it works the same on Windows and POSIX paths.

Display strings accept either a plain `string` (same for every locale) or a
`{ zh: string, en: string }` pair picked by the ui locale.

| field                 | type                                     | required | default                | description                                     |
| --------------------- | ---------------------------------------- | -------- | ---------------------- | ----------------------------------------------- |
| `title`               | `string \| { zh, en }`                   | no       | -                      | page/addon title (header + document title)       |
| `mcVersion`           | `{ min: string, max: string }`            | yes      | -                      | supported Minecraft version range                |
| `description`         | `string \| { zh, en }` (markdown)         | yes      | -                      | introduction rendered on the page                |
| `entryAddonManifest`  | `string`                                 | no       | `/manifest.addon.json` | api path serving the manifest                    |
| `entryDistAddon`      | `string`                                 | no       | `/dist.addon`          | api path serving the addon file (download)       |
| `distEntry`           | `string`                                 | no       | `dist.addon`           | path to the built addon file (`.addon`/`.mcaddon`); the `--addon` cli flag overrides it |
| `i18n`                | `Record<string, string \| { zh, en }>`    | no       | -                      | override built-in ui strings by message key      |
| `style`               | `string`                                 | no       | -                      | path to a TS style module (see below)            |

The manifest api (`manifest.addon.json`) is generated from the config and
served as:

```json
{
  "title": { "zh": "我的模组", "en": "My Addon" },
  "description": "# markdown...",
  "distAddon": "/dist.addon",
  "mcVersion": { "min": "1.21.0", "max": "1.21.90" }
}
```

## Static generation (SSG, SEO)

Like vitepress, the page is server-side rendered to static html:

- at build time the shipped `frontend/dist/index.html` is pre-rendered from a
  demo manifest ([demo manifest.addon.json](frontend/public/manifest.addon.json))
- at runtime `mfd page` re-renders it with the real manifest from
  `mfd.config.js`, so crawlers get the actual content without executing JS,
  and the client bundle hydrates that markup.

## Custom style modules

Set `style: './mfd.style.ts'` to customize the page, vitepress-like. The TS
module is bundled with rolldown, served at `/mfd.style.js` and loaded by the
page before mount. Get IDE hints via `defineStyle` from `@mbler/mfd/style`:

```ts
import type { MfdStyleApi } from '@mbler/mfd/style'

export default (api: MfdStyleApi): void => {
  // theme variables (keys without `--` get the `--mfd-` prefix)
  api.setThemeVars({ accent: '#8b5cf6' })
  api.setTitle('My Addon')
  api.onManifest((m) => console.log(m.mcVersion))
  api.onThemeChange((mode) => console.log(mode))
  api.onLocaleChange((locale) => console.log(locale))
  // full takeover: provide your own layout component (receives the api as
  // a prop) and compose the ready-made building blocks
  // api.setLayout(api.vue.defineComponent({ ... }))
}
```

Or export a `layout` component directly from the module:

```ts
import { defineStyle } from '@mbler/mfd/style'

export default defineStyle({
  theme: { accent: '#8b5cf6' },
  // vitepress-like custom layout; the ready-made pieces are on api.components
  layout: (props) => props.api.vue.h('div', 'my page'),
})
```

The API surface (`MfdStyleApi`): `root`, `vue` (live vue runtime exports, no
`vue` import needed), `components` (ready-made page pieces: `AddonIntro`,
`AddonVersions`), `manifest`, `theme`, `locale`, `t`, `setThemeVars`,
`setTheme`, `onThemeChange`, `setLocale`, `onLocaleChange`, `onManifest`,
`setTitle`, `setLayout` / `replaceRoot`, `registerComponent`.

## Development

```sh
pnpm install          # frontend is part of the pnpm workspace
pnpm build            # frontend (rolldown-vite client + ssr + prerender) then cli (rolldown)
pnpm dev:frontend     # vite dev server, uses frontend/public/manifest.addon.json demo
pnpm check            # eslint + vitest + tsc --noEmit + frontend vue-tsc
pnpm test             # vitest unit tests (config loader, sapi mapping)
node scripts/smoke.mjs # smoke tests: serves example/ and a temp config, checks endpoints
node bin/mfd.js page  # run the cli from source builds
```

Repository layout:

```
bin/          mfd.js cli launcher
src/          cli (cac) + page server + config loader
frontend/     vite & vue app (rolldown-vite, SSG entries, i18n en/zh, dark mode)
frontend/public/manifest.addon.json   demo manifest used in dev & prerender
example/      example project with custom endpoints + style module
```

## License

[MIT](./LICENSE)
