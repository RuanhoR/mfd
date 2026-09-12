<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { marked } from 'marked'
import { fetchManifest } from './api'
import type { ManifestAddon } from './api'
import { loadSapiEntries, generateServerVersion, compareVersion } from './sapi'
import { t, locale, toggleLocale } from './i18n'
import { theme, toggleTheme } from './theme'
import { emitManifest } from './styleApi'

const props = defineProps<{
  /** hydration state from the mfd page server / prerender step */
  initialManifest?: ManifestAddon | null
}>()

const manifest = ref<ManifestAddon | null>(props.initialManifest ?? null)
const error = ref('')
const loading = ref(!manifest.value)

const sapiLoading = ref(true)
const sapiError = ref(false)
const versions = ref<string[]>([])
const selected = ref('')
const serverStable = ref('')
const serverBeta = ref('')

const title = computed(() => manifest.value?.name || t('title'))

// marked.parse is synchronous here (async option off), so the
// description renders during SSR as real html for SEO
const descriptionHtml = computed(() =>
  manifest.value ? String(marked.parse(manifest.value.description || '')) : ''
)

function applyManifest(m: ManifestAddon): void {
  manifest.value = m
  emitManifest(m)
  if (m.name) document.title = m.name
}

async function fetchManifestNow(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    applyManifest(await fetchManifest())
    await loadVersions()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

async function loadVersions(): Promise<void> {
  const m = manifest.value
  if (!m) return
  sapiLoading.value = true
  sapiError.value = false
  try {
    const entries = await loadSapiEntries()
    const { min, max } = m.mcVersion
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

onMounted(() => {
  if (manifest.value) {
    emitManifest(manifest.value)
    void loadVersions()
  } else {
    void fetchManifestNow()
  }
})
</script>

<template>
  <div class="page">
    <header class="page-header">
      <div class="brand">
        <h1>{{ title }}</h1>
        <p class="tagline">{{ t('tagline') }}</p>
      </div>
      <div class="controls">
        <button
          class="btn ghost"
          :title="t('lang')"
          @click="toggleLocale"
        >
          {{ t('lang') }}
        </button>
        <button
          class="btn ghost"
          :title="theme === 'dark' ? t('themeToLight') : t('themeToDark')"
          @click="toggleTheme"
        >
          {{ theme === 'dark' ? '☀️' : '🌙' }}
        </button>
      </div>
    </header>

    <main v-if="loading" class="card state">{{ t('loading') }}</main>

    <main v-else-if="error" class="card state error">
      <p>{{ t('loadFailed') }}</p>
      <p class="detail">{{ error }}</p>
      <button class="btn" @click="fetchManifestNow">{{ t('retry') }}</button>
    </main>

    <main v-else-if="manifest" class="content">
      <section class="card">
        <h2>{{ t('sectionIntro') }}</h2>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="md-body" v-html="descriptionHtml"></div>
      </section>

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
    </main>

    <footer class="footer">{{ t('footer') }}</footer>
  </div>
</template>
