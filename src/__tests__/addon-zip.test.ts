import { describe, it, expect, vi, afterEach } from 'vitest'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { patchAddonZip } from '../../frontend/src/addonZip'

// fake npm registry payloads, per module
const fakeRegistries: Record<string, { versions: Record<string, unknown> }> = {
  '/@minecraft/server': {
    versions: {
      '2.0.0-beta.1.21.0': {},
      '2.0.0-beta.1.21.0-stable': {},
      '2.1.0-beta.1.21.90': {},
      '2.1.0-beta.1.21.90-stable': {},
    },
  },
  '/@minecraft/server-ui': {
    versions: {
      '1.13.0-beta.1.21.0': {},
      '1.13.0-beta.1.21.0-stable': {},
    },
  },
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

function stubFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL | Request) => {
      const path = new URL(String(url)).pathname
      return { ok: true, json: async () => fakeRegistries[path] }
    })
  )
}

interface PackManifestLike {
  dependencies?: Array<{ module_name?: string; version?: string }>
  [key: string]: unknown
}

const behaviorManifest = JSON.stringify({
  modules: [{ type: 'data' }],
  dependencies: [
    { module_name: '@minecraft/server', version: '1.0.0' },
    { module_name: '@minecraft/server-ui', version: '1.0.0' },
    { module_name: 'other-dep', version: '2.0.0' },
  ],
})

function makeZip(spec: Record<string, string>): Uint8Array {
  const files: Record<string, Uint8Array> = {}
  for (const [name, content] of Object.entries(spec)) {
    files[name] = strToU8(content)
  }
  return zipSync(files)
}

function readEntry(data: Uint8Array, entryName: string): PackManifestLike {
  return JSON.parse(strFromU8(unzipSync(data)[entryName]!))
}

describe('patchAddonZip', () => {
  it('rewrites sapi dependencies of the behavior pack only', async () => {
    stubFetch()
    const zip = makeZip({
      'behavior/manifest.json': behaviorManifest,
      'resources/manifest.json': JSON.stringify({
        modules: [{ type: 'resources' }],
        dependencies: [{ module_name: '@minecraft/server', version: '9.9.9' }],
      }),
    })
    const result = await patchAddonZip(zip, '1.21.0', false)

    expect(result.entries).toEqual(['behavior/manifest.json'])
    const behavior = readEntry(result.data, 'behavior/manifest.json')
    expect(behavior.dependencies).toEqual([
      { module_name: '@minecraft/server', version: '2.0.0' },
      { module_name: '@minecraft/server-ui', version: '1.13.0' },
      { module_name: 'other-dep', version: '2.0.0' },
    ])
    const resources = readEntry(result.data, 'resources/manifest.json')
    expect(resources.dependencies?.[0].version).toBe('9.9.9')
  })

  it('writes beta versions when isBeta is set', async () => {
    stubFetch()
    const zip = makeZip({ 'manifest.json': behaviorManifest })
    const result = await patchAddonZip(zip, '1.21.90', true)
    const behavior = readEntry(result.data, 'manifest.json')
    expect(behavior.dependencies?.[0].version).toBe('2.1.0-beta')
  })

  it('does not patch when modules[0].type is not data', async () => {
    stubFetch()
    const zip = makeZip({
      'packs/bp/manifest.json': JSON.stringify({
        modules: [{ type: 'script' }, { type: 'data' }],
        dependencies: [{ module_name: '@minecraft/server', version: '1.0.0' }],
      }),
    })
    const result = await patchAddonZip(zip, '1.21.90', false)
    expect(result.entries).toEqual([])
  })

  it('throws on non-zip payloads', async () => {
    await expect(
      patchAddonZip(strToU8('not a zip'), '1.21.0', false)
    ).rejects.toThrow()
  })
})
