<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import type { ManifestAddon } from '../api'
import { generateServerVersion, loadSapiEntries, compareVersion } from '../sapi'
import { patchAddonZip } from '../addonZip'
import { t } from '../i18n'

const props = defineProps<{
  manifest: ManifestAddon
}>()

const sapiLoading = ref(true)
const sapiError = ref(false)
const downloading = ref(false)
const versions = ref<string[]>([])
const selected = ref('')
const serverStable = ref('')
const serverBeta = ref('')

async function loadVersions(): Promise<void> {
  sapiLoading.value = true
  sapiError.value = false
  try {
    const entries = await loadSapiEntries('@minecraft/server')
    const { min, max } = props.manifest.mcVersion
    versions.value = entries
      .map((e) => e.version)
      .filter(
        (v) => compareVersion(v, min) >= 0 && compareVersion(v, max) <= 0
      )
    const preferred =
      max && versions.value.includes(max)
        ? max
        : (versions.value[versions.value.length - 1] ?? '')
    selected.value = preferred
  } catch {
    sapiError.value = true
  } finally {
    sapiLoading.value = false
  }
}

watch(selected, async (v) => {
  if (!v) return
  serverStable.value = await generateServerVersion(v, false).catch(() => '')
  serverBeta.value = await generateServerVersion(v, true).catch(() => '')
})

function addonFileName(): string {
  return (
    props.manifest.distAddon.split(/[?#]/)[0]?.split('/').pop() || 'addon'
  )
}

/**
 * pure-frontend download: fetch the zip, rewrite the behavior-pack
 * SAPI dependencies for the selected Minecraft version and save the
 * patched file as a blob — no server support required
 */
async function download(): Promise<void> {
  if (downloading.value || !selected.value) return
  downloading.value = true
  try {
    const res = await fetch(props.manifest.distAddon)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    let data: Uint8Array<ArrayBufferLike> = new Uint8Array(
      await res.arrayBuffer()
    )
    try {
      data = (
        await patchAddonZip(data, selected.value, !!props.manifest.isBeta)
      ).data
    } catch {
      // not a zip: download the original payload as-is
    }
    const url = URL.createObjectURL(
      new Blob([data.slice().buffer as ArrayBuffer], {
        type: 'application/octet-stream',
      })
    )
    const a = document.createElement('a')
    a.href = url
    a.download = addonFileName()
    a.click()
    URL.revokeObjectURL(url)
  } finally {
    downloading.value = false
  }
}

onMounted(loadVersions)
</script>

<template>
  <section class="card">
    <h2>{{ t('sectionVersion') }}</h2>
    <p class="range">
      {{ t('supportedRange') }}:
      <strong>{{ manifest.mcVersion.min }}</strong>
      ~
      <strong>{{ manifest.mcVersion.max }}</strong>
    </p>

    <div v-if="sapiLoading" class="state">{{ t('loading') }}</div>
    <div v-else-if="sapiError" class="state error">{{ t('sapiFailed') }}</div>
    <template v-else-if="versions.length">
      <label class="field">
        <span>{{ t('mcVersion') }}</span>
        <select v-model="selected">
          <option v-for="v in versions" :key="v" :value="v">{{ v }}</option>
        </select>
      </label>
      <dl class="mapped">
        <div>
          <dt>{{ t('serverApi') }}</dt>
          <dd>
            <code>{{
              manifest.isBeta
                ? serverBeta || '—'
                : serverStable || '—'
            }}</code>
          </dd>
        </div>
        <div>
          <dt>{{ manifest.isBeta ? t('serverApiStable') : t('serverApiBeta') }}</dt>
          <dd>
            <code>{{
              manifest.isBeta
                ? serverStable || '—'
                : serverBeta || '—'
            }}</code>
          </dd>
        </div>
      </dl>
      <button
        class="btn primary"
        :disabled="downloading"
        @click="download"
      >
        {{ downloading ? t('downloading') : t('download') }}
      </button>
    </template>
    <p v-else class="state">{{ t('noVersions') }}</p>
  </section>
</template>

<style scoped>
.range {
  color: var(--mfd-muted);
  margin: 0 0 16px;
}

.range strong {
  color: var(--mfd-fg);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
  max-width: 320px;
}

select {
  background: var(--mfd-bg);
  color: var(--mfd-fg);
  border: 1px solid var(--mfd-border);
  border-radius: 8px;
  padding: 8px 12px;
  font: inherit;
}

.mapped {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0 0 20px;
}

.mapped dt {
  color: var(--mfd-muted);
  font-size: 0.85rem;
}

.mapped dd {
  margin: 2px 0 0;
}

.btn.primary {
  background: var(--mfd-accent);
  color: var(--mfd-accent-fg);
  border-color: transparent;
  padding: 10px 24px;
  font-weight: 600;
}
</style>
