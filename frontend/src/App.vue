<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { fetchManifest } from './api'
import type { ManifestAddon } from './api'
import { t, locale } from './i18n'
import { theme, toggleTheme } from './theme'
import { emitManifest } from './styleApi'
import { resolveLocalized } from './localized'
import AddonIntro from './components/AddonIntro.vue'
import AddonVersions from './components/AddonVersions.vue'

const props = defineProps<{
  /** hydration state from the mfd page server / prerender step */
  initialManifest?: ManifestAddon | null
}>()

const manifest = ref<ManifestAddon | null>(props.initialManifest ?? null)
const error = ref('')
const loading = ref(!manifest.value)

const title = computed(() => {
  const m = manifest.value
  const raw = m ? (m.title ?? m.name) : undefined
  if (raw) {
    const resolved = resolveLocalized(raw, locale.value)
    if (resolved) return resolved
  }
  return t('title')
})

function applyManifest(m: ManifestAddon): void {
  manifest.value = m
  emitManifest(m)
  const raw = m.title ?? m.name
  const resolved = raw ? resolveLocalized(raw, locale.value) : ''
  if (resolved) document.title = resolved
}

async function fetchManifestNow(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    applyManifest(await fetchManifest())
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (manifest.value) {
    emitManifest(manifest.value)
  } else {
    void fetchManifestNow()
  }
})
</script>
<style lang="css" scoped>
.icon {
  width: 100%;
  height: 100%;
  position: relative;
}

.page {
  max-width: 860px;
  margin: 0 auto;
  padding: 24px 16px 48px;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.page-header {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.brand h1 {
  margin: 0;
  font-size: 1.6rem;
}

.tagline {
  margin: 2px 0 0;
  color: var(--mfd-muted);
  font-size: 0.9rem;
}

.controls {
  display: flex;
  gap: 8px;
}

.controls .btn {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
}

.detail {
  font-size: 0.85rem;
  word-break: break-all;
}

.btn.ghost {
  background: transparent;
}

.footer {
  margin-top: 32px;
  text-align: center;
  color: var(--mfd-muted);
  font-size: 0.85rem;
}

.footer-link {
  color: inherit;
}
</style>
<template>
  <div class="page">
    <header class="page-header">
      <div class="brand">
        <h1>{{ title }}</h1>
        <p class="tagline">{{ t('tagline') }}</p>
      </div>
      <div class="controls">
        <button class="btn ghost" :title="theme === 'dark' ? t('themeToLight') : t('themeToDark')" @click="toggleTheme">
          <img class="icon" v-if="theme == 'dark'" src="./assets/moon.svg">
          <img class="icon" v-if="theme == 'light'" src="./assets/sun.svg">
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
      <AddonIntro :description="manifest.description" />
      <AddonVersions :manifest="manifest" />
    </main>

    <footer class="footer">
      {{ t('footerPrefix')
      }}<a
        class="footer-link"
        href="https://www.npmjs.com/package/@mbler/mfd"
        target="_blank"
        rel="noopener"
        >@mbler/mfd</a
      >{{ t('footerSuffix') }}
    </footer>
  </div>
</template>
