import { describe, expect, it } from 'vitest'
import messages from '../src/i18n/messages'
import { AVAILABLE_MODELS } from '../src/config/models'
import { MODEL_DESCRIPTION_KEYS, getModelDescriptionKey } from '../src/config/modelDescriptions'

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('i18n messages', () => {
  const enKeys = Object.keys(messages.en).sort()
  const zhKeys = Object.keys(messages.zh).sort()

  it('defines every English key in Chinese', () => {
    expect(enKeys.filter((key) => !zhKeys.includes(key))).toEqual([])
  })

  it('has no Chinese keys missing from English', () => {
    expect(zhKeys.filter((key) => !enKeys.includes(key))).toEqual([])
  })

  it('has no empty translations', () => {
    for (const locale of ['en', 'zh'] as const) {
      const empty = Object.entries(messages[locale]).filter(([, text]) => !String(text).trim()).map(([key]) => key)
      expect(empty, locale).toEqual([])
    }
  })

  it('uses the same placeholders in both languages', () => {
    const mismatched = enKeys.filter((key) => {
      const zh = (messages.zh as Record<string, string>)[key]
      return zh !== undefined && placeholders((messages.en as Record<string, string>)[key]).join() !== placeholders(zh).join()
    })
    expect(mismatched).toEqual([])
  })
})

describe('model descriptions', () => {
  it('has a localized description for every available model', () => {
    const missing = AVAILABLE_MODELS.filter((m) => !getModelDescriptionKey(m)).map((m) => `${m.provider}:${m.id}`)
    expect(missing).toEqual([])
  })

  it('has no entries for models that no longer exist', () => {
    const existing = new Set(AVAILABLE_MODELS.map((m) => `${m.provider}:${m.id}`))
    expect(Object.keys(MODEL_DESCRIPTION_KEYS).filter((key) => !existing.has(key))).toEqual([])
  })

  it('points only at defined message keys', () => {
    const undefinedKeys = Object.values(MODEL_DESCRIPTION_KEYS).filter((key) => !(key in messages.en))
    expect(undefinedKeys).toEqual([])
  })

  it('distinguishes providers that share a model id', () => {
    const id = 'google/gemini-3.1-flash-image'
    expect(getModelDescriptionKey({ id, provider: 'openrouter' })).toBe('modelORNanoBanana2Desc')
    expect(getModelDescriptionKey({ id, provider: 'vercel' })).toBe('modelVercelNanoBanana2Desc')
  })
})
