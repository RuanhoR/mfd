import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { generateVersion, SAPI_MODULES, type SapiModule } from './sapi'

export interface PatchedAddon {
  /** zip content with the behavior-pack manifests rewritten */
  data: Uint8Array
  /** patched zip entry paths */
  entries: string[]
}

interface PackDependency {
  module_name?: string
  uuid?: string
  version?: string
  [key: string]: unknown
}

interface PackManifest {
  modules?: Array<{ type?: string }>
  dependencies?: PackDependency[]
  [key: string]: unknown
}

function isSapiModule(name: unknown): name is SapiModule {
  return SAPI_MODULES.some((m) => m === name)
}

/**
 * Pure-frontend rewrite of an addon zip: scans every manifest.json
 * entry and, for the behavior pack(s) (modules[0].type === 'data'),
 * updates the `@minecraft/server` / `@minecraft/server-ui` dependency
 * versions to the SAPI version mapped from the selected Minecraft
 * version + isBeta (same values mbler build writes into pack
 * manifests). Runs entirely in the browser so any static host works.
 *
 * Throws when the payload is not a readable zip; callers should fall
 * back to serving the original file.
 */
export async function patchAddonZip(
  data: Uint8Array,
  mcVersion: string,
  isBeta = false
): Promise<PatchedAddon> {
  const files = unzipSync(data)

  const versions = new Map<SapiModule, string>()
  const resolveVersion = async (module: SapiModule): Promise<string> => {
    let v = versions.get(module)
    if (v === undefined) {
      v = await generateVersion(module, mcVersion, isBeta, false)
      versions.set(module, v)
    }
    return v
  }

  const out: Record<string, Uint8Array> = {}
  const entries: string[] = []
  for (const [name, content] of Object.entries(files)) {
    if (name.endsWith('manifest.json')) {
      try {
        const manifest = JSON.parse(strFromU8(content)) as PackManifest
        if (manifest.modules?.[0]?.type === 'data') {
          let changed = false
          for (const dep of manifest.dependencies ?? []) {
            if (!isSapiModule(dep.module_name)) continue
            dep.version = await resolveVersion(dep.module_name)
            changed = true
          }
          if (changed) {
            out[name] = strToU8(JSON.stringify(manifest, null, 2))
            entries.push(name)
            continue
          }
        }
      } catch {
        // malformed manifest json: keep the entry as-is
      }
    }
    out[name] = content
  }
  return { data: zipSync(out), entries }
}
