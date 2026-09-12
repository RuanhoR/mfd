// @ts-check
import { defineConfig } from 'rolldown'
import { dts } from 'rolldown-plugin-dts'

export default defineConfig([
  {
    input: {
      index: 'src/index.ts',
      'style-types': 'src/style-types.ts',
    },
    output: {
      dir: 'dist',
      entryFileNames: '[name].mjs',
      format: 'esm',
      sourcemap: false,
    },
    plugins: [dts()],
    external: [/^node:/, 'cac', 'rolldown'],
  },
])
