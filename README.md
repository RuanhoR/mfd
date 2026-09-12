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

Then build the static page (put your built `.addon`/`.mcaddon` file path in
`addon`):

```sh
mfd page
# -> dist-page/, deploy to any static host
mfd serve   # optional preview server, http://localhost:9527
```

## CLI

```
mfd page      build the static download page (vitepress-like SSG output)
  -o, --out <dir>      output directory, overrides distEntry in mfd.config.js
  --locale <locale>    locale for the static render: en | zh (default: en)
  --root <dir>         custom frontend dist directory
mfd serve     preview server for the page, manifest and addon endpoints
  -p, --port <port>    port, overrides port in mfd.config.js (default: 9527)
  -H, --host <host>    host to bind (default: localhost)
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
| `distEntry`           | `string`                                 | no       | `dist-page`            | output directory for `mfd page`; the `--out` cli flag overrides it |
| `addon`               | `string`                                 | no       | -                      | path to the built addon file (`.addon`/`.mcaddon`), copied to `entryDistAddon` / served there |
| `port`                | `number`                                 | no       | `9527`                 | port for `mfd serve`                             |
| `isBeta`              | `boolean`                                | no       | `false`                | use the beta `@minecraft/server` api, consistent with mbler's `script.UseBeta` |
| `base`                | `string`                                 | no       | `/`                    | url base path like vite's `base`; `mfd page` builds into `<distEntry>/<base>` and `mfd serve` serves under it |
| `i18n`                | `Record<string, string \| { zh, en }>`    | no       | -                      | override built-in ui strings by message key      |
| `style`               | `string`                                 | no       | -                      | path to a TS style module (see below)            |

The manifest api (`manifest.addon.json`) is generated from the config and
served as:

```json
{
  "title": { "zh": "我的模组", "en": "My Addon" },
  "description": "# markdown...",
  "distAddon": "/dist.addon",
  "mcVersion": { "min": "1.21.0", "max": "1.21.90" },
  "isBeta": false
}
```

## Static generation (SSG, SEO)

Like vitepress, `mfd page` generates a self-contained static folder.
The package ships the frontend source as a template and builds it with
vite (rolldown-vite) **at runtime**, so your config affects the actual
build:

- `base` is passed to vite as the build base — asset urls match the
  deployment path and the page lands in `<distEntry>/<base>`
- the manifest (from `mcVersion`/`description`/`title`/`isBeta`/...),
  the `i18n` overrides and the (redefinable) entry paths are baked into
  the bundle via a virtual module
- `index.html` (+ `404.html` as the static-host fallback) is
  server-side rendered from the real manifest, so crawlers get the
  actual content without executing JS, and the client bundle hydrates
  that markup afterwards (the ui language then follows the system
  language)
- the manifest is written at `entryAddonManifest`, the addon file at
  `entryDistAddon`, and the bundled style module at `/mfd.style.js`

Deploy the folder to any static host; use `mfd serve` to preview locally
(it runs the same runtime build into a temp dir first).

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
