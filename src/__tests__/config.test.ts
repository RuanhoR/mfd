import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { readMfdConfig, defineConfig, MFD_CONFIG_FILE } from '../config'

function makeProject(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mfd-config-'))
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(dir, name)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, content, 'utf-8')
  }
  return dir
}

const validConfig = `
export default {
  mcVersion: { min: '1.21.0', max: '1.21.90' },
  description: '# Hello',
}
`

describe('readMfdConfig', () => {
  let dirs: string[] = []

  beforeEach(() => {
    dirs = []
  })

  afterEach(() => {
    for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true })
  })

  function project(files: Record<string, string>): string {
    const dir = makeProject(files)
    dirs.push(dir)
    return dir
  }

  it('reads a valid config with default endpoints', async () => {
    const dir = project({ [MFD_CONFIG_FILE]: validConfig })
    const config = await readMfdConfig(dir)
    expect(config.mcVersion).toEqual({ min: '1.21.0', max: '1.21.90' })
    expect(config.description).toBe('# Hello')
    expect(config.entryAddonManifest).toBe('/manifest.addon.json')
    expect(config.entryDistAddon).toBe('/dist.addon')
    expect(config.style).toBeNull()
  })

  it('normalizes custom endpoints and resolves the style path', async () => {
    const dir = project({
      [MFD_CONFIG_FILE]: `
export default {
  mcVersion: { min: '1.0.0', max: '2.0.0' },
  description: 'md',
  entryAddonManifest: 'api/manifest',
  entryDistAddon: '/api/addon',
  style: './style/mfd.style.ts',
}
`,
      'style/mfd.style.ts': 'export default () => {}',
    })
    const config = await readMfdConfig(dir)
    expect(config.entryAddonManifest).toBe('/api/manifest')
    expect(config.entryDistAddon).toBe('/api/addon')
    expect(config.style).toBe(path.resolve(dir, 'style/mfd.style.ts'))
  })

  it('accepts an absolute style path', async () => {
    const stylePath = path.resolve(makeProject({}), 'abs.style.ts')
    dirs.push(path.dirname(stylePath))
    fs.writeFileSync(stylePath, 'export default () => {}', 'utf-8')
    const dir = project({
      [MFD_CONFIG_FILE]: `export default {
  mcVersion: { min: '1.0.0', max: '2.0.0' },
  description: 'md',
  style: ${JSON.stringify(stylePath.split(path.sep).join(path.posix.sep))},
}
`,
    })
    const config = await readMfdConfig(dir)
    expect(config.style).not.toBeNull()
  })

  it('throws when the config file is missing', async () => {
    const dir = project({})
    await expect(readMfdConfig(dir)).rejects.toThrow(/not found/)
  })

  it('throws when mcVersion is missing', async () => {
    const dir = project({
      [MFD_CONFIG_FILE]: `export default { description: '# x' }`,
    })
    await expect(readMfdConfig(dir)).rejects.toThrow(/mcVersion/)
  })

  it('throws when description is missing', async () => {
    const dir = project({
      [MFD_CONFIG_FILE]: `export default { mcVersion: { min: '1.0.0', max: '2.0.0' } }`,
    })
    await expect(readMfdConfig(dir)).rejects.toThrow(/description/)
  })

  it('throws when the style path does not exist', async () => {
    const dir = project({
      [MFD_CONFIG_FILE]: `export default {
  mcVersion: { min: '1.0.0', max: '2.0.0' },
  description: 'md',
  style: './nope.ts',
}
`,
    })
    await expect(readMfdConfig(dir)).rejects.toThrow(/style module not found/)
  })
})

describe('defineConfig', () => {
  it('returns the config object unchanged', () => {
    const config = {
      mcVersion: { min: '1.0.0', max: '2.0.0' },
      description: '# x',
    }
    expect(defineConfig(config)).toBe(config)
  })
})
