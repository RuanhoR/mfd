// smoke test: builds are expected in dist/ + frontend/dist/
// 1) `mfd page` static build in ./example (custom endpoints, style, localized strings)
// 2) `mfd page` with a default config in a temp dir
// 3) `mfd serve` honoring the config `port` + endpoints
// 4) cli version/help
import { spawn, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const pkgRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const bin = path.join(pkgRoot, 'bin', 'mfd.js')
const exampleDir = path.join(pkgRoot, 'example')
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mfd-smoke-'))

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

let failures = 0
function check(name, cond, extra = '') {
  if (cond) {
    console.log(`  ok  ${name}`)
  } else {
    failures++
    console.error(`FAIL  ${name} ${extra}`)
  }
}

function runCli(args, cwd) {
  return execFileSync(process.execPath, [bin, ...args], { cwd, encoding: 'utf-8' })
}

function exists(dir, rel) {
  return fs.existsSync(path.join(dir, rel))
}

function read(dir, rel) {
  return fs.readFileSync(path.join(dir, rel), 'utf-8')
}

// 1) static build with the example config (custom endpoints + style)
console.log('mfd page (example: custom endpoints + style + localized)')
const out1 = path.join(tmpRoot, 'page-example')
runCli(['page', '--out', out1], exampleDir)
check('index.html rendered (en title)', read(out1, 'index.html').includes('<h1>Example Addon</h1>'))
check('index.html is ssr rendered (markdown body)', read(out1, 'index.html').includes('An example project for'))
check('index.html injects render locale', read(out1, 'index.html').includes('__MFD_RENDER_LOCALE__'))
const assetsDir1 = path.join(out1, 'assets')
const assetJs1 = fs.readdirSync(assetsDir1).filter((f) => f.endsWith('.js')).map((f) => read(out1, 'assets/' + f)).join('\n')
check('config baked into bundle (entryAddonManifest)', assetJs1.includes('/api/manifest.addon.json'))
check('config baked into bundle (style entry)', assetJs1.includes('/mfd.style.js'))
check('404.html written', exists(out1, '404.html'))
check('manifest at custom entry', exists(out1, 'api/manifest.addon.json'))
const manifest = JSON.parse(read(out1, 'api/manifest.addon.json'))
check('manifest title localized', manifest.title?.en === 'Example Addon' && manifest.title?.zh === '示例模组')
check('manifest distAddon', manifest.distAddon === '/api/dist.addon')
check('addon copied to custom entry', read(out1, 'api/dist.addon').includes('placeholder'))
check('style module bundled', read(out1, 'mfd.style.js').includes('accent'))
check('ssr bundle not shipped', !exists(out1, 'server'))
check('demo manifest not shipped', !exists(out1, 'manifest.addon.json'))

console.log('mfd page --locale zh')
const out1zh = path.join(tmpRoot, 'page-example-zh')
runCli(['page', '--out', out1zh, '--locale', 'zh'], exampleDir)
check('zh render used', read(out1zh, 'index.html').includes('<h1>示例模组</h1>'))

// 2) static build with a default config
console.log('mfd page (temp dir: defaults)')
const proj2 = path.join(tmpRoot, 'proj')
const out2 = path.join(tmpRoot, 'page-default')
fs.mkdirSync(proj2, { recursive: true })
fs.writeFileSync(
  path.join(proj2, 'mfd.config.js'),
  `export default {
  mcVersion: { min: '1.20.0', max: '1.21.90' },
  description: '# Smoke\\n',
  addon: './dist.addon',
}
`
)
fs.writeFileSync(path.join(proj2, 'dist.addon'), 'placeholder .addon payload for the smoke test\n')
runCli(['page'], proj2)
check('default out dir is dist-page', exists(proj2, 'dist-page'))
check('manifest at default entry', exists(proj2, 'dist-page/manifest.addon.json'))
check('addon at default entry', read(proj2, 'dist-page/dist.addon').includes('placeholder'))
check('no style module output', !exists(proj2, 'dist-page/mfd.style.js'))

// 3) serve honors the config port
console.log('mfd serve (config port)')
const proj3 = path.join(tmpRoot, 'serve')
fs.mkdirSync(proj3, { recursive: true })
fs.writeFileSync(
  path.join(proj3, 'mfd.config.js'),
  `export default {
  mcVersion: { min: '1.20.0', max: '1.21.90' },
  description: { zh: '# 冒烟', en: '# Smoke' },
  addon: './dist.addon',
  port: 9599,
}
`
)
fs.writeFileSync(path.join(proj3, 'dist.addon'), 'placeholder .addon payload for the smoke test\n')
const serve = spawn(process.execPath, [bin, 'serve'], { cwd: proj3, stdio: ['ignore', 'pipe', 'pipe'] })
let serveOut = ''
serve.stdout.on('data', (d) => (serveOut += d))
serve.stderr.on('data', (d) => (serveOut += d))
try {
  let up = false
  for (let i = 0; i < 50 && !up; i++) {
    if (serve.exitCode !== null) throw new Error(`serve exited early:\n${serveOut}`)
    try {
      await fetch('http://localhost:9599/')
      up = true
    } catch {
      await wait(200)
    }
  }
  check('serve uses config port 9599', up)
  const html = await (await fetch('http://localhost:9599/')).text()
  check('serve ssr render', html.includes('<h1>Smoke</h1>'))
  check('serve manifest endpoint', (await (await fetch('http://localhost:9599/manifest.addon.json')).json()).distAddon === '/dist.addon')
  check('serve addon endpoint', (await (await fetch('http://localhost:9599/dist.addon')).text()).includes('placeholder'))
  const zhHtml = await (
    await fetch('http://localhost:9599/', { headers: { 'Accept-Language': 'zh-CN' } })
  ).text()
  check('serve ssr per Accept-Language', zhHtml.includes('<h1>冒烟</h1>'))
} finally {
  serve.kill()
  await wait(200)
}

// 4) cli commands
const version = runCli(['version'], pkgRoot)
check('mfd version prints', /mfd v\d+\.\d+\.\d+/.test(version.trim()))
const help = runCli(['help'], pkgRoot)
check('mfd help lists page and serve', help.includes('page') && help.includes('serve'))

fs.rmSync(tmpRoot, { recursive: true, force: true })

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nall checks passed')
