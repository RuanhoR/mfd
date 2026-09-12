#!/usr/bin/env node
import { createCliApp } from '../dist/index.mjs'

try {
  createCliApp().parse()
} catch (err) {
  console.error(err)
  process.exitCode = 1
}
