import { describe, it, expect, vi, afterEach } from 'vitest'
import { compareVersion, evalVersion } from '../../frontend/src/sapi'
import type * as SapiModule from '../../frontend/src/sapi'

// fake npm registry payload, same shape registry.npmjs.com returns
const fakeRegistry = {
  versions: {
    '1.0.0': {},
    '2.0.0-beta.1.21.0': {},
    '2.0.0-beta.1.21.0-stable': {},
    '2.1.0-beta.1.21.90': {},
    '2.1.0-beta.1.21.90-stable': {},
    '2.2.0-beta.1.21.100': {},
    '2.3.0-rc.1.22.0': {},
  },
}

function stubFetch(impl?: () => Promise<unknown>): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(
    impl ?? (async () => ({ ok: true, json: async () => fakeRegistry }))
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

// the sapi module keeps a module-level cache, load a fresh
// instance per test to keep them independent
async function loadSapi(): Promise<typeof SapiModule> {
  vi.resetModules()
  return await import('../../frontend/src/sapi')
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('compareVersion', () => {
  it('compares numerically by segment', () => {
    expect(compareVersion('1.21.9', '1.21.10')).toBeLessThan(0)
    expect(compareVersion('1.21.90', '1.21.90')).toBe(0)
    expect(compareVersion('1.22.0', '1.21.90')).toBeGreaterThan(0)
  })

  it('treats missing segments as zero', () => {
    expect(compareVersion('1.21', '1.21.0')).toBe(0)
  })
})

describe('evalVersion', () => {
  it('keeps only the first prerelease segment', () => {
    expect(evalVersion('2.1.0-beta.25.10.1')).toBe('2.1.0-beta')
    expect(evalVersion('2.1.0')).toBe('2.1.0')
  })
})

describe('generateServerVersion', () => {
  it('maps an exact mc version to the latest stable sapi version', async () => {
    stubFetch()
    const sapi = await loadSapi()
    expect(await sapi.generateServerVersion('1.21.90', false)).toBe('2.1.0')
    expect(await sapi.generateServerVersion('1.21.0', false)).toBe('2.0.0')
  })

  it('maps an exact mc version to the beta sapi version', async () => {
    stubFetch()
    const sapi = await loadSapi()
    expect(await sapi.generateServerVersion('1.21.90', true)).toBe('2.1.0-beta')
  })

  it('falls back to the closest lower mc version', async () => {
    stubFetch()
    const sapi = await loadSapi()
    // 1.21.50 has no entry -> candidate is 1.21.0
    expect(await sapi.generateServerVersion('1.21.50', false)).toBe('2.0.0')
  })

  it('falls back to rc versions when no beta/stable exists', async () => {
    stubFetch()
    const sapi = await loadSapi()
    // 1.22.0 only has an rc entry
    expect(await sapi.generateServerVersion('1.22.0', true)).toBe('2.3.0-rc')
  })

  it('caches the registry data across calls', async () => {
    const fetchMock = stubFetch()
    const sapi = await loadSapi()
    await sapi.generateServerVersion('1.21.90', false)
    await sapi.generateServerVersion('1.21.0', false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reloads after a failed fetch', async () => {
    stubFetch(async () => {
      throw new Error('network down')
    })
    const sapi = await loadSapi()
    await expect(sapi.loadSapiEntries('@minecraft/server')).rejects.toThrow('network down')

    stubFetch()
    vi.resetModules()
    const sapi2 = await import('../../frontend/src/sapi')
    expect(await sapi2.generateServerVersion('1.21.90', false)).toBe('2.1.0')
  })
})
