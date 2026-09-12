import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [vue()],
  base: './',
  publicDir: isSsrBuild ? false : 'public',
  build: {
    outDir: isSsrBuild ? 'dist/server' : 'dist',
    emptyOutDir: !isSsrBuild,
  },
  ssr: {
    // bundle vue/marked into the server bundle so the mfd cli can
    // render pages at runtime without these dependencies installed
    noExternal: true,
  },
}))
