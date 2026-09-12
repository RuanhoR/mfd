import { stat as fspStat } from 'node:fs/promises'
import { rolldown } from 'rolldown'
import type { MfdConfig } from './config'
import { withBase } from './config'

export interface StyleBundle {
  mtimeMs: number
  code: string
}
const styleBundleCache = new Map<string, StyleBundle>()

/** bundle a TS style module with rolldown, cached by mtime */
export async function bundleStyle(stylePath: string): Promise<string> {
  const stat = await fspStat(stylePath)
  const cached = styleBundleCache.get(stylePath)
  if (cached && cached.mtimeMs === stat.mtimeMs) return cached.code
  const bundle = await rolldown({
    input: stylePath,
    platform: 'browser',
  })
  const { output } = await bundle.generate({ format: 'esm' })
  await bundle.close()
  const code = output[0]?.code ?? ''
  styleBundleCache.set(stylePath, { mtimeMs: stat.mtimeMs, code })
  return code
}

export function manifestFromConfig(config: MfdConfig): {
  title?: MfdConfig['title']
  description: MfdConfig['description']
  distAddon: string
  mcVersion: { min: string; max: string }
  isBeta: boolean
} {
  return {
    title: config.title ?? undefined,
    description: config.description,
    distAddon: withBase(config.base, config.entryDistAddon),
    mcVersion: config.mcVersion,
    isBeta: config.isBeta,
  }
}
