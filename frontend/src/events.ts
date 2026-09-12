import type { MfdThemeMode, MfdLocale, MfdManifest } from './style-types'

type Cb<T> = (value: T) => void

export interface Bus<T> {
  /** register a listener; fires immediately with the current value if set */
  on(cb: Cb<T>): void
  emit(value: T): void
  readonly current: T | null
}

function createBus<T>(): Bus<T> {
  const listeners = new Set<Cb<T>>()
  let current: T | null = null
  return {
    on(cb) {
      listeners.add(cb)
      if (current !== null) cb(current)
    },
    emit(value) {
      current = value
      listeners.forEach((cb) => cb(value))
    },
    get current() {
      return current
    },
  }
}

export const themeBus = createBus<MfdThemeMode>()
export const localeBus = createBus<MfdLocale>()
export const manifestBus = createBus<MfdManifest>()
