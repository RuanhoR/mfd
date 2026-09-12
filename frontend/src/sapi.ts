/**
 * Browser port of the sapi logic used by `mbler build`
 * (mcbe/mbler/src/build/sapi.ts): maps a Minecraft version to the
 * matching @minecraft/server(-ui) version from the npm registry.
 */
const REGISTRY = 'https://registry.npmjs.com'

export const SAPI_MODULES = [
  '@minecraft/server',
  '@minecraft/server-ui',
] as const

export type SapiModule = (typeof SAPI_MODULES)[number]

export function compareVersion(a: string, b: string): number {
  const pa = a.split('.').map((x) => parseInt(x, 10) || 0)
  const pb = b.split('.').map((x) => parseInt(x, 10) || 0)
  for (let i = 0; i < 3; i++) {
    const na = pa[i] || 0
    const nb = pb[i] || 0
    if (na !== nb) return na - nb
  }
  return 0
}

function mcVersionFrom(str: string): string | null {
  const m = str.match(/-(?:rc|beta)(?:\.[^-.]+)*?\.((?:\d+\.){2}\d+)/)
  return m ? m[1]! : null
}

export interface SapiEntry {
  version: string
  formal: string
  beta: string
}

async function fetchJson(pathname: string, attempt = 1): Promise<unknown> {
  const r = await fetch(REGISTRY + pathname, {
    signal: AbortSignal.timeout(30_000),
  })
  if (!r.ok && attempt < 3) {
    await new Promise((res) => setTimeout(res, 1000 * attempt))
    return fetchJson(pathname, attempt + 1)
  }
  return r.json()
}

const cache = new Map<string, Promise<SapiEntry[]>>()

export function loadSapiEntries(module: SapiModule): Promise<SapiEntry[]> {
  let p = cache.get(module)
  if (!p) {
    p = fetchEntries(module).catch((err) => {
      cache.delete(module)
      throw err
    })
    cache.set(module, p)
  }
  return p
}

async function fetchEntries(module: SapiModule): Promise<SapiEntry[]> {
  const data = (await fetchJson(`/${module}`)) as {
    versions?: Record<string, unknown>
  }
  const map: Record<string, { formal: string; beta: string }> = {}
  for (const v of Object.keys(data.versions ?? {})) {
    const mc = mcVersionFrom(v)
    if (!mc) continue
    const isStable = /(?:-stable)(?:$|[-.])/.test(v)
    const entry = (map[mc] ??= { formal: '', beta: '' })
    if (isStable) {
      if (!entry.formal || compareVersion(v, entry.formal) > 0) entry.formal = v
    } else {
      if (!entry.beta || compareVersion(v, entry.beta) > 0) entry.beta = v
    }
  }
  const arr = Object.entries(map).map(([version, e]) => ({
    version,
    formal: e.formal,
    beta: e.beta,
  }))
  arr.sort((a, b) => compareVersion(a.version, b.version))
  return arr
}

export function evalVersion(result: string): string {
  const parts = result.split('-')
  if (parts.length < 2) return result
  const pre = parts[1]!
  return parts[0] + '-' + pre.split('.')[0]
}

/**
 * Convert a Minecraft version to the module's SAPI version, same
 * fallback behavior as mbler build's sapi.
 */
export async function generateVersion(
  module: SapiModule,
  mcVersion: string,
  isBeta = false,
  withFull = false
): Promise<string> {
  const entries = await loadSapiEntries(module)
  if (!entries.length) {
    throw new Error('no SAPI version data')
  }
  let entry = entries.find((e) => e.version === mcVersion)
  if (!entry) {
    let candidate: SapiEntry | null = null
    for (const e of entries) {
      if (compareVersion(e.version, mcVersion) <= 0) candidate = e
      else break
    }
    entry = candidate ?? entries[0]!
  }
  let result = isBeta ? entry.beta : entry.formal
  if (!result) result = entry.formal || entry.beta
  if (withFull) return result
  result = evalVersion(result || 'error')
  if (!isBeta) result = result.split('-')[0] || result
  return result
}

/** map the @minecraft/server version (display convenience wrapper) */
export function generateServerVersion(
  mcVersion: string,
  isBeta = false,
  withFull = false
): Promise<string> {
  return generateVersion('@minecraft/server', mcVersion, isBeta, withFull)
}
