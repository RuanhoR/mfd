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
