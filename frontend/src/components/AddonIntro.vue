<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import { t, locale } from '../i18n'
import { resolveLocalized, type Localized } from '../localized'

const props = defineProps<{
  /** addon introduction in markdown (string or { zh, en }) */
  description: Localized
}>()

// marked.parse is synchronous here (async option off), so the
// description renders during SSR as real html for SEO
const html = computed(() =>
  String(marked.parse(resolveLocalized(props.description, locale.value) || ''))
)
</script>

<template>
  <section class="card">
    <h2>{{ t('sectionIntro') }}</h2>
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div class="md-body" v-html="html"></div>
  </section>
</template>

<style scoped>
/* v-html content carries no scope attributes, target it via :deep() */
.md-body :deep(h1),
.md-body :deep(h2),
.md-body :deep(h3) {
  border-bottom: 1px solid var(--mfd-border);
  padding-bottom: 4px;
  line-height: 1.3;
}

.md-body :deep(img) {
  max-width: 100%;
}

.md-body :deep(pre) {
  background: var(--mfd-code-bg);
  border-radius: 8px;
  padding: 12px;
  overflow-x: auto;
}

.md-body :deep(pre code) {
  background: transparent;
  padding: 0;
}

.md-body :deep(blockquote) {
  margin: 8px 0;
  padding: 4px 12px;
  border-left: 3px solid var(--mfd-accent);
  color: var(--mfd-muted);
}

.md-body :deep(a) {
  color: var(--mfd-accent);
}

.md-body :deep(table) {
  border-collapse: collapse;
}

.md-body :deep(th),
.md-body :deep(td) {
  border: 1px solid var(--mfd-border);
  padding: 6px 10px;
}
</style>
