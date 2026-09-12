// smoke test: builds are expected in dist/ + frontend/dist/
// starts `mfd page` in ./example and checks all endpoints,
// then repeats with a default-endpoint config in a temp dir.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const pkgRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const bin = path.join(pkgRoot, 'bin', 'mfd.js')
const exampleDir = path.join(pkgRoot, 'example')

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

function startServer(cwd, args) {
  const child = spawn(process.execPath, [bin, 'page', ...args], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', (d) => (output += d))
  child.stderr.on('data', (d) => (output += d))
  child.output = () => output
  return child
}

async function waitForServer(base, child, tries = 50) {
  for (let i = 0; i < tries; i++) {
    if (child.exitCode !== null) {
      throw new Error(`server exited early:\n${child.output()}`)
    }
    try {
      const res = await fetch(`${base}/`)
      if (res.ok) return
    } catch {
      /* not ready yet */
    }
    await wait(200)
  }
  throw new Error(`server did not start:\n${child.output()}`)
}

let failures = 0
function check(name, cond, extra = '') {
  if (cond) {
    console.log(`  ok  ${name}`)
  } else {
    failures++
    console.error(`FAIL  ${name} ${extra}`)
  }
}

async function testInstance(cwd, base, args, endpoints, expectCustom) {
  const child = startServer(cwd, args)
  try {
    await waitForServer(base, child)

    const manifestRes = await fetch(base + endpoints.manifest)
    const manifest = await manifestRes.json()
    check(
      `GET ${endpoints.manifest} -> 200 json`,
      manifestRes.ok &&
        manifestRes.headers.get('content-type').includes('application/json')
    )
    check('manifest has description (md)', typeof manifest.description === 'string' && manifest.description.startsWith('#'))
    check('manifest has distAddon', typeof manifest.distAddon === 'string')
    check(
      'manifest has mcVersion min/max',
      typeof manifest.mcVersion?.min === 'string' &&
        typeof manifest.mcVersion?.max === 'string'
    )

    const addonRes = await fetch(base + endpoints.addon)
    const addonText = await addonRes.text()
    check(`GET ${endpoints.addon} -> 200 octet-stream`, addonRes.ok && addonRes.headers.get('content-type').includes('octet-stream'))
    check('addon payload matches file', addonText.includes('placeholder'))

    const indexRes = await fetch(base + '/')
    const indexHtml = await indexRes.text()
    check('GET / -> 200 html', indexRes.ok && indexRes.headers.get('content-type').includes('text/html'))
    check('index.html is ssr rendered (markdown html present)', indexHtml.includes('<h1>') || indexHtml.includes('<h2>'))
    check('index.html injects __MFD_CONFIG__', indexHtml.includes('__MFD_CONFIG__'))
    check('index.html injects __MFD_MANIFEST__', indexHtml.includes('__MFD_MANIFEST__'))
    check('index.html injects entryAddonManifest', indexHtml.includes(endpoints.manifest))
    if (expectCustom) {
      check('custom style module served', (await fetch(base + '/mfd.style.js')).ok)
    } else {
      check('no style module -> 404', (await fetch(base + '/mfd.style.js')).status === 404)
    }
    check('spa fallback works', (await fetch(base + '/some/deep/route')).ok)
  } finally {
    child.kill()
    await wait(200)
  }
}

// 1) example dir: custom endpoints + style module
console.log('example config (custom endpoints + style)')
await testInstance(
  exampleDir,
  'http://localhost:9527',
  ['--port', '9527'],
  { manifest: '/api/manifest.addon.json', addon: '/api/dist.addon' },
  true
)

// 2) temp dir: default endpoints, no style
console.log('default config (temp dir)')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mfd-smoke-'))
fs.writeFileSync(
  path.join(tmp, 'mfd.config.js'),
  `export default {\n  mcVersion: { min: '1.20.0', max: '1.21.90' },\n  description: '# Smoke\\n',\n}\n`
)
fs.writeFileSync(path.join(tmp, 'dist.addon'), 'placeholder .addon payload for the smoke test\n')
await testInstance(
  tmp,
  'http://localhost:9528',
  ['--port', '9528'],
  { manifest: '/manifest.addon.json', addon: '/dist.addon' },
  false
)

// 3) cli commands
const { execFileSync } = await import('node:child_process')
const version = execFileSync(process.execPath, [bin, 'version'], { cwd: pkgRoot, encoding: 'utf-8' })
check('mfd version prints', /mfd v\d+\.\d+\.\d+/.test(version.trim()))
const help = execFileSync(process.execPath, [bin, 'help'], { cwd: pkgRoot, encoding: 'utf-8' })
check('mfd help lists page', help.includes('page'))

fs.rmSync(tmp, { recursive: true, force: true })

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nall checks passed')
