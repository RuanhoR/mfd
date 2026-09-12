import { ref } from 'vue'
import { themeBus } from './events'

export type ThemeMode = 'light' | 'dark'

const KEY = 'mfd.theme'

/** starts as 'light' so SSR markup matches the first client render */
export const theme = ref<ThemeMode>('light')

export function applyTheme(): void {
  document.documentElement.classList.toggle('dark', theme.value === 'dark')
}

/** restore saved theme / system preference after hydration (client only) */
export function initTheme(): void {
  const saved = localStorage.getItem(KEY)
  const mode: ThemeMode =
    saved === 'light' || saved === 'dark'
      ? saved
      : window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
  theme.value = mode
  applyTheme()
}

export function setTheme(mode: ThemeMode): void {
  theme.value = mode
  applyTheme()
  localStorage.setItem(KEY, mode)
  themeBus.emit(mode)
}

export function toggleTheme(): void {
  setTheme(theme.value === 'dark' ? 'light' : 'dark')
}
