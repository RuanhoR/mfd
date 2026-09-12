export type Locale = 'en' | 'zh'

/**
 * A display string: plain string (same for every locale) or a
 * `{ zh, en }` pair picked by the current ui locale.
 */
export type Localized = string | { zh?: string; en?: string }

export function resolveLocalized(value: Localized, locale: Locale): string {
  if (typeof value === 'string') return value
  return value[locale] ?? value.en ?? value.zh ?? ''
}
