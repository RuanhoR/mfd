# @mbler/mfd — Agent Guide

Minecraft Bedrock addon downloader: SSG download-page generator + CLI (`mfd page` / `mfd serve`) + npm library. Live example: [addon.wei.qzz.io](https://addon.wei.qzz.io).

## Commands (pnpm only)

```bash
pnpm install
pnpm build           # build:frontend (client + SSR + prerender) → build:cli (rolldown)
pnpm dev:frontend    # vite dev for the Vue frontend
pnpm cli             # run local CLI: node bin/mfd.js
pnpm lint            # eslint src/ only; lint:fix to auto-fix
pnpm test            # vitest — src/__tests__: config / sapi / addon-zip / e2e
pnpm type-check      # tsc --noEmit, covers src/ only
pnpm check           # lint + test + type-check + frontend type-check (vue-tsc)
pnpm format          # prettier ./src --write
```

- Root `type-check` does **not** cover `frontend/` — that is `vue-tsc` inside the workspace; `check` runs both.
- `e2e.test.ts` performs real page builds (vite build per case) — much slower than the unit suites; run targeted tests while iterating: `pnpm vitest run src/__tests__/config.test.ts`.

## Layout

```
src/              CLI + library: index.ts (cac CLI), config.ts, page.ts, render.ts,
                  server.ts, build-frontend.ts (runtime vite build of the template)
src/__tests__/    config / sapi / addon-zip / e2e (e2e does full page builds)
frontend/         @mbler/mfd-frontend — Vue 3 + vite SSR app, shipped as build template
  src/sapi.ts     mcVersion → @minecraft/server version mapping (same logic as mbler build)
  scripts/prerender.mjs   renders index.html + 404.html from the real manifest
bin/mfd.js        CLI shim → dist/index.mjs
```

- `frontend/` **source** ships inside the npm package (`files: ["frontend", "!frontend/dist", "!frontend/node_modules"]`) and is built **at user runtime** by `mfd page`: the user's config is baked into the bundle via a virtual module, `base` is passed to vite as the build base.
- `frontend/dist` is a local build artifact only. Code that runs from the installed package must resolve the template via `frontendTemplateDir()` (`src/build-frontend.ts`), never a relative path into `dist`.

## Gotchas

- `fflate` is a **runtime** dependency — the shipped frontend template imports it (addon zip download). Demoting it to devDependencies produces a package whose CLI builds fine but whose generated pages crash; there is no test that catches this at CLI level.
- `mfd.config.js` is loaded from the user's cwd via dynamic `import(pathToFileURL(...))` — keep all user-path handling through that helper so Windows and POSIX behave the same.
- `base` in config changes both the vite build base and the output path (`<distEntry>/<base>`); `mfd serve` must respect it too. Do not assume page lives at `<distEntry>/index.html`.
- The `./style` export (`src/style-types.ts`) is the public theme module contract — breaking its types breaks user `style` modules silently at runtime, not at install time.
- Versioning: `frontend/` and `src/` ship as one package — bump only the root `package.json`. Publish from the repo root with `pnpm publish` (files: dist, bin, frontend).
