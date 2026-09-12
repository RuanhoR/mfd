# @mbler/mfd

Minecraft 基岩版模组下载站点 & 命令行工具。

`mfd` 为你的模组提供一个预渲染（类 vitepress SSG）的下载页面：markdown 格式的
模组介绍、基于与 `mbler build` 相同 SAPI 逻辑（`mcVersion` ->
`@minecraft/server`）的 Minecraft 版本选择器，以及 `.addon` 文件下载链接。
前端支持深色模式，界面语言（en/zh）自动跟随系统语言。

## 安装

```sh
npm i -g @mbler/mfd
# 或
pnpm add -D @mbler/mfd
```

## 快速开始

在项目目录创建 `mfd.config.js`：

```js
import { defineConfig } from '@mbler/mfd'

export default defineConfig({
  mcVersion: { min: '1.21.0', max: '1.21.90' },
  description: '# 我的模组\n\n页面展示的 markdown 介绍。',
  // 可选：重定义 api 端点
  // entryAddonManifest: '/manifest.addon.json',
  // entryDistAddon: '/dist.addon',
  // 可选：自定义页面主题/行为模块
  // style: './mfd.style.ts',
})
```

然后构建静态页面（把打包好的 `.addon`/`.mcaddon` 文件路径写进 `addon`）：

```sh
mfd page
# -> dist-page/，部署到任意静态托管
mfd serve   # 可选的预览服务器，http://localhost:9527
```

## 命令

```
mfd page      构建静态下载页面（类 vitepress SSG 产物）
  -o, --out <dir>      输出目录，覆盖 mfd.config.js 的 distEntry
  --locale <locale>    静态渲染语言：en | zh（默认 en）
  --root <dir>         自定义前端 dist 目录
mfd serve     页面 / manifest / 模组文件的预览服务器
  -p, --port <port>    端口，覆盖 mfd.config.js 的 port（默认 9527）
  -H, --host <host>    绑定地址（默认 localhost）
  --root <dir>         自定义前端 dist 目录
mfd version   打印版本号
mfd help      显示帮助
```

## 配置：`mfd.config.js`

从 `process.cwd()` 读取，通过 `pathToFileURL` 动态 `import()` 加载，Windows 与
POSIX 路径行为一致。

展示性字符串可以是普通 `string`（各语言相同），也可以是按界面语言取值的
`{ zh: string, en: string }`。

| 字段                  | 类型                                      | 必填 | 默认值                 | 说明                                  |
| --------------------- | ----------------------------------------- | ---- | ---------------------- | ------------------------------------- |
| `title`               | `string \| { zh, en }`                    | 否   | -                      | 页面/模组标题（页头 + 文档标题）       |
| `mcVersion`           | `{ min: string, max: string }`             | 是   | -                      | 支持的 Minecraft 版本范围              |
| `description`         | `string \| { zh, en }`（markdown）         | 是   | -                      | 页面渲染的模组介绍                     |
| `entryAddonManifest`  | `string`                                  | 否   | `/manifest.addon.json` | 提供 manifest 的 api 路径              |
| `entryDistAddon`      | `string`                                  | 否   | `/dist.addon`          | 提供模组文件（下载）的 api 路径        |
| `distEntry`           | `string`                                  | 否   | `dist-page`            | `mfd page` 的输出目录；命令行 `--out` 可覆盖 |
| `addon`               | `string`                                  | 否   | -                      | 构建产物文件路径（`.addon`/`.mcaddon`），复制到 `entryDistAddon` / 在该路径提供 |
| `port`                | `number`                                  | 否   | `9527`                 | `mfd serve` 的端口                     |
| `isBeta`              | `boolean`                                 | 否   | `false`                | 使用 beta 版 `@minecraft/server`，与 mbler 的 `script.UseBeta` 一致 |
| `base`                | `string`                                  | 否   | `/`                    | 类 vite 的 url 基础路径；`mfd page` 构建到 `<distEntry>/<base>`，`mfd serve` 挂在 base 下 |
| `i18n`                | `Record<string, string \| { zh, en }>`     | 否   | -                      | 按消息 key 覆盖内置界面文案           |
| `style`               | `string`                                  | 否   | -                      | TS 样式模块路径（见下文）              |

manifest api（`manifest.addon.json`）由配置生成，格式如下：

```json
{
  "title": { "zh": "我的模组", "en": "My Addon" },
  "description": "# markdown...",
  "distAddon": "/dist.addon",
  "mcVersion": { "min": "1.21.0", "max": "1.21.90" },
  "isBeta": false
}
```

## 静态生成（SSG，SEO 优化）

与 vitepress 类似，`mfd page` 生成一个自包含的静态目录。包内携带 frontend
源码作为模板，运行时用 vite（rolldown-vite）**实际构建**，所以配置会真正
影响构建产物：

- `base` 会作为 vite 构建的 base 传入——资源 url 与部署路径一致，页面
  产物落在 `<distEntry>/<base>`；
- manifest（由 `mcVersion`/`description`/`title`/`isBeta`/... 生成）、
  `i18n` 覆盖和（可重定义的）端点路径通过虚拟模块烘焙进 bundle；
- `index.html`（外加静态托管兜底用的 `404.html`）由真实 manifest 服务端
  渲染，爬虫无需执行 JS 即可拿到实际内容，客户端 bundle 再做水合
  （界面语言随系统语言切换）；
- manifest 写在 `entryAddonManifest`、模组文件写在 `entryDistAddon`、
  打包后的样式模块写在 `/mfd.style.js`。

把整个目录部署到任意静态托管即可；本地预览用 `mfd serve`（会先在临时目录
跑一次同样的运行时构建）。

## 自定义样式模块

设置 `style: './mfd.style.ts'` 即可自定义页面，方式类似 vitepress。TS 模块会用
rolldown 打包、在 `/mfd.style.js` 提供，页面挂载前加载。用 `@mbler/mfd/style`
导出的 `defineStyle` 可以获得 IDE 提示：

```ts
import type { MfdStyleApi } from '@mbler/mfd/style'

export default (api: MfdStyleApi): void => {
  // 主题变量（不带 `--` 前缀的 key 会加上 `--mfd-`）
  api.setThemeVars({ accent: '#8b5cf6' })
  api.setTitle('我的模组')
  api.onManifest((m) => console.log(m.mcVersion))
  api.onThemeChange((mode) => console.log(mode))
  api.onLocaleChange((locale) => console.log(locale))
  // 完全接管：提供自己的 layout 组件（会收到 api 作为 prop），
  // 并用暴露好的页面构件自由组合
  // api.setLayout(api.vue.defineComponent({ ... }))
}
```

也可以直接从模块导出 `layout` 组件：

```ts
import { defineStyle } from '@mbler/mfd/style'

export default defineStyle({
  theme: { accent: '#8b5cf6' },
  // 类 vitepress 自定义 layout；现成构件在 api.components 上
  layout: (props) => props.api.vue.h('div', 'my page'),
})
```

API（`MfdStyleApi`）：`root`、`vue`（vue 运行时导出，无需 import vue）、
`components`（现成页面构件：`AddonIntro`、`AddonVersions`）、`manifest`、
`theme`、`locale`、`t`、`setThemeVars`、`setTheme`、`onThemeChange`、
`setLocale`、`onLocaleChange`、`onManifest`、`setTitle`、`setLayout` /
`replaceRoot`、`registerComponent`。

## 开发

```sh
pnpm install          # frontend 是上层 pnpm workspace 的一部分
pnpm build            # 先 frontend（rolldown-vite client + ssr + prerender），再 cli（rolldown）
pnpm dev:frontend     # vite 开发服务器，使用 frontend/public/manifest.addon.json 演示数据
pnpm check            # eslint + vitest + tsc --noEmit + frontend vue-tsc
pnpm test             # vitest 单元测试（配置加载、sapi 映射）
node scripts/smoke.mjs # smoke 测试：启动 example/ 与临时配置服务，检查各端点
node bin/mfd.js page  # 从构建产物直接运行 cli
```

目录结构：

```
bin/          mfd.js 命令入口
src/          cli（cac）+ 页面服务器 + 配置加载
frontend/     vite & vue 应用（rolldown-vite、SSG 入口、i18n en/zh、深色模式）
frontend/public/manifest.addon.json   开发与预渲染用的演示 manifest
example/      自定义端点 + 样式模块的示例项目
```

## 开源许可证

[MIT](./LICENSE)
