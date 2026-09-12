import { entryAddonManifest } from './runtime'
import type { Localized } from './localized'

export type { Localized }
export type { MfdBakedConfig } from './runtime'

export interface MfdMcVersionRange {
  min: string
  max: string
}

export interface ManifestAddon {
  /** page/addon title (falls back to legacy `name`) */
  title?: Localized
  /** legacy plain title from older manifests */
  name?: string
  description: Localized
  distAddon: string
  mcVersion: MfdMcVersionRange
  /** use the beta @minecraft/server api (consistent with mbler script.UseBeta) */
  isBeta?: boolean
}

declare global {
  interface Window {
    __MFD_RENDER_LOCALE__?: 'en' | 'zh'
  }
}

export async function fetchManifest(): Promise<ManifestAddon> {
  const res = await fetch(entryAddonManifest)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${entryAddonManifest}`)
  }
  return (await res.json()) as ManifestAddon
}
