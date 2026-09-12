import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  readMfdConfig,
  defineConfig,
  resolveLocalized,
  isLocalized,
  MFD_CONFIG_FILE,
} from '../config'

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

  it('accepts localized title/description and resolves distEntry', async () => {
    const dir = project({
      'dist.addon': 'payload',
      [MFD_CONFIG_FILE]: `export default {
  title: { zh: '标题', en: 'Title' },
  mcVersion: { min: '1.0.0', max: '2.0.0' },
  description: { zh: '# 中文', en: '# English' },
  distEntry: './dist-page',
  addon: './dist.addon',
}
`,
    })
    const config = await readMfdConfig(dir)
    expect(config.title).toEqual({ zh: '标题', en: 'Title' })
    expect(config.description).toEqual({ zh: '# 中文', en: '# English' })
    expect(config.distEntry).toBe(path.resolve(dir, 'dist-page'))
    expect(config.addon).toBe(path.resolve(dir, 'dist.addon'))
    expect(config.i18n).toBeNull()
  })

  it('leaves distEntry/addon/port unset when omitted', async () => {
    const dir = project({ [MFD_CONFIG_FILE]: validConfig })
    const config = await readMfdConfig(dir)
    expect(config.distEntry).toBeNull()
    expect(config.addon).toBeNull()
    expect(config.port).toBeNull()
    expect(config.isBeta).toBe(false)
    expect(config.base).toBe('/')
  })

  it('accepts isBeta and normalizes base', async () => {
    const dir = project({
      [MFD_CONFIG_FILE]: `export default {
  mcVersion: { min: '1.0.0', max: '2.0.0' },
  description: 'md',
  isBeta: true,
  base: 'my-addon',
}
`,
    })
    const config = await readMfdConfig(dir)
    expect(config.isBeta).toBe(true)
    expect(config.base).toBe('/my-addon/')
  })

  it('throws on an invalid isBeta', async () => {
    const dir = project({
      [MFD_CONFIG_FILE]: `export default {
  mcVersion: { min: '1.0.0', max: '2.0.0' },
  description: 'md',
  isBeta: 'yes',
}
`,
    })
    await expect(readMfdConfig(dir)).rejects.toThrow(/isBeta/)
  })

  it('validates the i18n record', async () => {
    const dir = project({
      [MFD_CONFIG_FILE]: `export default {
  mcVersion: { min: '1.0.0', max: '2.0.0' },
  description: 'md',
  i18n: { download: { zh: '下载', en: 'Download' } },
}
`,
    })
    const config = await readMfdConfig(dir)
    expect(config.i18n).toEqual({
      download: { zh: '下载', en: 'Download' },
    })
  })

  it('throws on an invalid i18n value', async () => {
    const dir = project({
      [MFD_CONFIG_FILE]: `export default {
  mcVersion: { min: '1.0.0', max: '2.0.0' },
  description: 'md',
  i18n: { download: 123 },
}
`,
    })
    await expect(readMfdConfig(dir)).rejects.toThrow(/i18n\.download/)
  })

  it('resolves addon and port', async () => {
    const dir = project({
      'build/addon.mcaddon': 'payload',
      [MFD_CONFIG_FILE]: `export default {
  mcVersion: { min: '1.0.0', max: '2.0.0' },
  description: 'md',
  addon: './build/addon.mcaddon',
  port: 9527,
}
`,
    })
    const config = await readMfdConfig(dir)
    expect(config.addon).toBe(path.resolve(dir, 'build/addon.mcaddon'))
    expect(config.port).toBe(9527)
  })

  it('throws when the addon file does not exist', async () => {
    const dir = project({
      [MFD_CONFIG_FILE]: `export default {
  mcVersion: { min: '1.0.0', max: '2.0.0' },
  description: 'md',
  addon: './nope.mcaddon',
}
`,
    })
    await expect(readMfdConfig(dir)).rejects.toThrow(/addon file not found/)
  })

  it('throws on an invalid port', async () => {
    const dir = project({
      [MFD_CONFIG_FILE]: `export default {
  mcVersion: { min: '1.0.0', max: '2.0.0' },
  description: 'md',
  port: 99999,
}
`,
    })
    await expect(readMfdConfig(dir)).rejects.toThrow(/port/)
  })

  it('throws on a non-localized description', async () => {
    const dir = project({
      [MFD_CONFIG_FILE]: `export default {
  mcVersion: { min: '1.0.0', max: '2.0.0' },
  description: { zh: 123 },
}
`,
    })
    await expect(readMfdConfig(dir)).rejects.toThrow(/description must be/)
  })
})

describe('resolveLocalized', () => {
  it('passes plain strings through', () => {
    expect(resolveLocalized('hello', 'en')).toBe('hello')
    expect(resolveLocalized('hello', 'zh')).toBe('hello')
  })

  it('picks the requested locale', () => {
    expect(resolveLocalized({ zh: '中', en: 'En' }, 'zh')).toBe('中')
    expect(resolveLocalized({ zh: '中', en: 'En' }, 'en')).toBe('En')
  })

  it('falls back to the other locale when one is missing', () => {
    expect(resolveLocalized({ zh: '中' }, 'en')).toBe('中')
    expect(resolveLocalized({ en: 'En' }, 'zh')).toBe('En')
    expect(resolveLocalized({}, 'en')).toBe('')
  })
})

describe('isLocalized', () => {
  it('accepts strings and { zh, en } objects', () => {
    expect(isLocalized('x')).toBe(true)
    expect(isLocalized({ zh: 'x' })).toBe(true)
    expect(isLocalized({ en: 'x' })).toBe(true)
    expect(isLocalized(123)).toBe(false)
    expect(isLocalized({ zh: 123 })).toBe(false)
    expect(isLocalized(null)).toBe(false)
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
