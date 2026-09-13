// end-to-end tests for the built cli (bin/mfd.js over dist/):
// `pnpm build` must have run before these execute.
import { describe, it, expect, afterAll } from 'vitest'
import { spawn, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { strToU8, zipSync, unzipSync } from 'fflate'

const pkgRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
)
const bin = path.join(pkgRoot, 'bin', 'mfd.js')
const exampleDir = path.join(pkgRoot, 'example')
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mfd-e2e-'))

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

function runCli(args: string[], cwd: string): string {
  return execFileSync(process.execPath, [bin, ...args], {
    cwd,
    encoding: 'utf-8',
  })
}

function exists(dir: string, rel: string): boolean {
  return fs.existsSync(path.join(dir, rel))
}

function read(dir: string, rel: string): string {
  return fs.readFileSync(path.join(dir, rel), 'utf-8')
}

let serveChild: ReturnType<typeof spawn> | null = null

afterAll(() => {
  serveChild?.kill()
  fs.rmSync(tmpRoot, { recursive: true, force: true })
})

describe('mfd page (static build)', () => {
  it(
    'builds the example project: custom endpoints, style module, localized strings',
    () => {
      const out = path.join(tmpRoot, 'page-example')
      runCli(['page', '--out', out], exampleDir)

      expect(exists(out, 'index.html')).toBe(true)
      expect(read(out, 'index.html')).toContain('<h1>Example Addon</h1>')
      expect(read(out, 'index.html')).toContain('An example project for')
      expect(read(out, 'index.html')).toContain('__MFD_RENDER_LOCALE__')
      expect(exists(out, '404.html')).toBe(true)

      // config baked into the client bundle
      const assetJs = fs
        .readdirSync(path.join(out, 'assets'))
        .filter((f) => f.endsWith('.js'))
        .map((f) => read(out, 'assets/' + f))
        .join('\n')
      expect(assetJs).toContain('/api/manifest.addon.json')
      expect(assetJs).toContain('/mfd.style.js')

      // manifest + addon + style at their redefined entry paths
      const manifest = JSON.parse(read(out, 'api/manifest.addon.json'))
      expect(manifest.title).toEqual({ zh: '示例模组', en: 'Example Addon' })
      expect(manifest.distAddon).toBe('/api/dist.addon')
      expect(read(out, 'api/dist.addon')).toContain('placeholder')
      expect(read(out, 'mfd.style.js')).toContain('accent')

      // internal artifacts must not ship
      expect(exists(out, 'server')).toBe(false)
      expect(exists(out, 'manifest.addon.json')).toBe(false)
    },
    180_000
  )

  it(
    'renders the requested locale with --locale',
    () => {
      const out = path.join(tmpRoot, 'page-example-zh')
      runCli(['page', '--out', out, '--locale', 'zh'], exampleDir)
      expect(read(out, 'index.html')).toContain('<h1>示例模组</h1>')
    },
    180_000
  )

  it(
    'builds a default config into dist-page and passes zip addons through',
    () => {
      const proj = path.join(tmpRoot, 'proj-default')
      fs.mkdirSync(proj, { recursive: true })
      fs.writeFileSync(
        path.join(proj, 'mfd.config.js'),
        `export default {
  mcVersion: { min: '1.20.0', max: '1.21.90' },
  description: '# Smoke\\n',
  addon: './dist.addon',
}
`
      )
      const addonBytes = zipSync({
        'behavior/manifest.json': strToU8(
          JSON.stringify({ modules: [{ type: 'data' }] })
        ),
        'resources/manifest.json': strToU8(
          JSON.stringify({ modules: [{ type: 'resources' }] })
        ),
      })
      fs.writeFileSync(path.join(proj, 'dist.addon'), addonBytes)

      runCli(['page'], proj)

      expect(exists(proj, 'dist-page')).toBe(true)
      expect(exists(proj, 'dist-page/manifest.addon.json')).toBe(true)
      const outBytes = fs.readFileSync(path.join(proj, 'dist-page/dist.addon'))
      // the zip is served as-is; sapi rewriting happens in the browser
      expect(Buffer.compare(Buffer.from(addonBytes), outBytes)).toBe(0)
      const entries = Object.keys(
        unzipSync(new Uint8Array(outBytes))
      ).sort()
      expect(entries).toEqual([
        'behavior/manifest.json',
        'resources/manifest.json',
      ])
      expect(exists(proj, 'dist-page/mfd.style.js')).toBe(false)
    },
    180_000
  )
})

describe('mfd serve', () => {
  it(
    'serves ssr pages, manifest and addon on the configured port',
    async () => {
      const proj = path.join(tmpRoot, 'proj-serve')
      fs.mkdirSync(proj, { recursive: true })
      fs.writeFileSync(
        path.join(proj, 'mfd.config.js'),
        `export default {
  mcVersion: { min: '1.20.0', max: '1.21.90' },
  description: { zh: '# 冒烟', en: '# Smoke' },
  addon: './dist.addon',
  port: 9599,
}
`
      )
      fs.writeFileSync(
        path.join(proj, 'dist.addon'),
        'placeholder .addon payload for the smoke test\n'
      )

      serveChild = spawn(process.execPath, [bin, 'serve'], {
        cwd: proj,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      let serveOut = ''
      serveChild.stdout?.on('data', (d) => (serveOut += d))
      serveChild.stderr?.on('data', (d) => (serveOut += d))

      let up = false
      for (let i = 0; i < 50 && !up; i++) {
        if (serveChild.exitCode !== null) {
          throw new Error(`serve exited early:\n${serveOut}`)
        }
        try {
          await fetch('http://localhost:9599/')
          up = true
        } catch {
          await wait(200)
        }
      }
      expect(up).toBe(true)

      // ssr per requested locale (en default)
      const html = await (await fetch('http://localhost:9599/')).text()
      expect(html).toContain('<h1>Smoke</h1>')
      const zhHtml = await (
        await fetch('http://localhost:9599/', {
          headers: { 'Accept-Language': 'zh-CN' },
        })
      ).text()
      expect(zhHtml).toContain('<h1>冒烟</h1>')

      const manifest = await (
        await fetch('http://localhost:9599/manifest.addon.json')
      ).json()
      expect(manifest.distAddon).toBe('/dist.addon')
      expect(
        await (await fetch('http://localhost:9599/dist.addon')).text()
      ).toContain('placeholder')
    },
    180_000
  )
})

describe('mfd cli', () => {
  it('prints the version', () => {
    expect(runCli(['version'], pkgRoot)).toMatch(/mfd v\d+\.\d+\.\d+/)
  })

  it('lists commands in help', () => {
    const help = runCli(['help'], pkgRoot)
    expect(help).toContain('page')
    expect(help).toContain('serve')
  })
})
