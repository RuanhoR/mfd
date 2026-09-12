import { readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const dist = path.join(frontendRoot, 'dist')

const serverEntry = path.join(dist, 'server', 'entry-server.js')
const { renderPage } = await import(pathToFileURL(serverEntry).href)

const manifest = JSON.parse(
  readFileSync(path.join(frontendRoot, 'public', 'manifest.addon.json'), 'utf-8')
)

const { html, title } = await renderPage(manifest)

const templatePath = path.join(dist, 'index.html')
const template = readFileSync(templatePath, 'utf-8')
// keep the clean template for the mfd page server to render at runtime
copyFileSync(templatePath, path.join(dist, 'index.template.html'))

const escape = (s) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

let out = template.replace(
  '<div id="app"></div>',
  `<div id="app">${html}</div>`
)
out = out.replace('<title>MFD</title>', `<title>${escape(title)}</title>`)
const state = `<script>window.__MFD_MANIFEST__ = ${JSON.stringify(manifest).replaceAll('<', '\\u003c')}</script>`
out = out.replace('</head>', `${state}</head>`)

writeFileSync(templatePath, out)
console.log('[mfd] prerendered dist/index.html')
