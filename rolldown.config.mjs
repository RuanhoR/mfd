// @ts-check
import { defineConfig } from 'rolldown'
import { dts } from 'rolldown-plugin-dts'
import { readFileSync } from 'node:fs'
import * as path from 'node:path'

const pkg = JSON.parse(
  readFileSync(path.join(import.meta.dirname, 'package.json'), 'utf-8')
)

const external = [/^node:/, ...Object.keys(pkg.dependencies || {})]

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
    external,
  },
])
