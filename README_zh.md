# @mbler/mfd

Minecraft 基岩版模组下载站点 & 命令行工具。

`mfd` 为你的模组提供一个预渲染（类 vitepress SSG）的下载页面：markdown 格式的
模组介绍、基于与 `mbler build` 相同 SAPI 逻辑（`mcVersion` ->
`@minecraft/server`）的 Minecraft 版本选择器，以及 `.addon` 文件下载链接。
前端支持深色模式和英文/中文国际化。

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

然后启动页面服务（把打包好的 `.addon` 放在 `dist.addon`，或用
`--addon path/to/file.addon` 指定）：

```sh
mfd page
# 打开 http://localhost:9527
```

## 命令

```
mfd page      启动模组下载页面服务
  -p, --port <port>    监听端口（默认 9527）
  -H, --host <host>    绑定地址（默认 localhost）
  --addon <file>       .addon 文件路径，相对于 cwd（默认 dist.addon）
  --root <dir>         自定义前端 dist 目录
mfd version   打印版本号
mfd help      显示帮助
```

## 配置：`mfd.config.js`

从 `process.cwd()` 读取，通过 `pathToFileURL` 动态 `import()` 加载，Windows 与
POSIX 路径行为一致。

| 字段                  | 类型                           | 必填 | 默认值                 | 说明                                  |
| --------------------- | ------------------------------ | ---- | ---------------------- | ------------------------------------- |
| `mcVersion`           | `{ min: string, max: string }` | 是   | -                      | 支持的 Minecraft 版本范围              |
| `description`         | `string`（markdown）           | 是   | -                      | 页面渲染的模组介绍                     |
| `entryAddonManifest`  | `string`                       | 否   | `/manifest.addon.json` | 提供 manifest 的 api 路径              |
| `entryDistAddon`      | `string`                       | 否   | `/dist.addon`          | 提供 `.addon` 文件（下载）的 api 路径  |
| `style`               | `string`                       | 否   | -                      | TS 样式模块路径（见下文）              |

manifest api（`manifest.addon.json`）由配置生成，格式如下：

```json
{
  "description": "# markdown...",
  "distAddon": "/dist.addon",
  "mcVersion": { "min": "1.21.0", "max": "1.21.90" }
}
```

## 静态生成（SSG，SEO 优化）

与 vitepress 类似，页面通过服务端渲染成静态 HTML：

- 构建期：随包发布的 `frontend/dist/index.html` 使用演示 manifest
  （[frontend/public/manifest.addon.json](frontend/public/manifest.addon.json)）预渲染；
- 运行期：`mfd page` 用 `mfd.config.js` 生成的真实 manifest 重新渲染，
  爬虫无需执行 JS 即可拿到实际内容，客户端 bundle 再对标记做水合。

## 自定义样式模块

设置 `style: './mfd.style.ts'` 即可自定义页面主题与行为。TS 模块会用 rolldown
打包、在 `/mfd.style.js` 提供，页面挂载前加载。用 `@mbler/mfd/style` 导出的
`defineStyle` 可以获得 IDE 提示：

```ts
import type { MfdStyleApi } from '@mbler/mfd/style'

export default (api: MfdStyleApi): void => {
  // 主题变量（不带 `--` 前缀的 key 会加上 `--mfd-`）
  api.setThemeVars({ accent: '#8b5cf6' })
  api.setTitle('我的模组')
  api.onManifest((m) => console.log(m.mcVersion))
  api.onThemeChange((mode) => console.log(mode))
  api.onLocaleChange((locale) => console.log(locale))
  // 完全接管：用自己的组件替换默认页面
  // api.replaceRoot(api.vue.defineComponent({ ... }))
}
```

API（`MfdStyleApi`）：`root`、`vue`（vue 运行时导出，无需 import vue）、
`manifest`、`theme`、`locale`、`setThemeVars`、`setTheme`、`onThemeChange`、
`setLocale`、`onLocaleChange`、`onManifest`、`setTitle`、`replaceRoot`、
`registerComponent`。

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
