<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import type { ManifestAddon } from '../api'
import { loadSapiEntries, generateServerVersion, compareVersion } from '../sapi'
import { t } from '../i18n'

const props = defineProps<{
  manifest: ManifestAddon
}>()

const sapiLoading = ref(true)
const sapiError = ref(false)
const versions = ref<string[]>([])
const selected = ref('')
const serverStable = ref('')
const serverBeta = ref('')

async function loadVersions(): Promise<void> {
  sapiLoading.value = true
  sapiError.value = false
  try {
    const entries = await loadSapiEntries()
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
          <dd><code>{{ serverStable || '—' }}</code></dd>
        </div>
        <div>
          <dt>{{ t('serverApiBeta') }}</dt>
          <dd><code>{{ serverBeta || '—' }}</code></dd>
        </div>
      </dl>
      <a class="btn primary" :href="manifest.distAddon" download>
        {{ t('download') }}
      </a>
    </template>
    <p v-else class="state">{{ t('noVersions') }}</p>
  </section>
</template>
