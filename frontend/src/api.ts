export interface MfdMcVersionRange {
  min: string
  max: string
}

export interface ManifestAddon {
  name?: string
  description: string
  distAddon: string
  mcVersion: MfdMcVersionRange
}

export interface MfdRuntimeConfig {
  entryAddonManifest?: string
  entryStyle?: string | null
}

declare global {
  interface Window {
    __MFD_CONFIG__?: MfdRuntimeConfig
    __MFD_MANIFEST__?: ManifestAddon
  }
}

const runtimeConfig: MfdRuntimeConfig | undefined =
  typeof window !== 'undefined' ? window.__MFD_CONFIG__ : undefined

/** injected by the mfd page server, falls back to defaults in vite dev */
export const entryAddonManifest: string =
  runtimeConfig?.entryAddonManifest ?? '/manifest.addon.json'

export const entryStyle: string | null = runtimeConfig?.entryStyle ?? null

/** hydration state injected by the mfd page server / prerender step */
export function getClientManifest(): ManifestAddon | null {
  if (typeof window === 'undefined') return null
  return window.__MFD_MANIFEST__ ?? null
}

export async function fetchManifest(): Promise<ManifestAddon> {
  const res = await fetch(entryAddonManifest)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${entryAddonManifest}`)
  }
  return (await res.json()) as ManifestAddon
}
