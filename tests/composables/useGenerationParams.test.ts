import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { useGenerationParams } from '../../src/composables/useGenerationParams'
import {
  AVAILABLE_MODELS,
  DEFAULT_MODEL,
  GEMINI_FLASH_IMAGE_MODEL,
  GEMINI_FLASH_LITE_IMAGE_MODEL,
  GEMINI_NANO_BANANA_2_1_MODEL,
  GPT_IMAGE_2_5_FLARE_MODEL,
  GPT_IMAGE_2_5_SUNBURST_MODEL,
  SEEDREAM_5_0_LITE_MODEL,
  SEEDREAM_5_0_PRO_MODEL,
  getModelsForProvider,
} from '../../src/config/models'
import type { HistoryEntry, ModelOption, Provider } from '../../src/types'

const PARAMS_KEY = 'banacanvas-params'

function model(id: string, provider: Provider): ModelOption {
  const found = AVAILABLE_MODELS.find((m) => m.id === id && m.provider === provider)
  if (!found) throw new Error(`Unknown model ${provider}:${id}`)
  return found
}

function persist(value: unknown) {
  localStorage.setItem(PARAMS_KEY, JSON.stringify(value))
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('banacanvas-locale', 'en')
})

describe('loading persisted params', () => {
  it('uses defaults when nothing is stored', () => {
    const params = useGenerationParams()

    expect(params.selectedProvider.value).toBe(DEFAULT_MODEL.provider)
    expect(params.selectedModel.value).toEqual(DEFAULT_MODEL)
    expect(params.config.value).toMatchObject({
      provider: DEFAULT_MODEL.provider,
      model: DEFAULT_MODEL.id,
      aspectRatio: '1:1',
      imageSize: '1K',
      imageQuality: 'medium',
      imageBackground: 'auto',
      thinkingLevel: 'MINIMAL',
      googleSearch: false,
      webGrounding: false,
      batchSize: 1,
    })
    expect(params.downloadFormat.value).toBe('png')
    expect(params.suggestAspectRatio.value).toBe(true)
  })

  it('restores the stored provider, model and config', () => {
    persist({
      provider: 'openrouter',
      modelId: GPT_IMAGE_2_5_FLARE_MODEL,
      downloadFormat: 'webp',
      config: { aspectRatio: '3:2', imageQuality: 'max', imageBackground: 'transparent', batchSize: 3 },
    })

    const params = useGenerationParams()

    expect(params.selectedModel.value).toEqual(model(GPT_IMAGE_2_5_FLARE_MODEL, 'openrouter'))
    expect(params.config.value).toMatchObject({
      provider: 'openrouter',
      model: GPT_IMAGE_2_5_FLARE_MODEL,
      aspectRatio: '3:2',
      imageQuality: 'max',
      imageBackground: 'transparent',
      batchSize: 3,
    })
    expect(params.downloadFormat.value).toBe('webp')
  })

  it('falls back to the provider\'s first model when the stored one no longer exists', () => {
    persist({ provider: 'openrouter', modelId: 'retired/model', config: { aspectRatio: '9:20', imageSize: '512' } })

    const params = useGenerationParams()

    const first = getModelsForProvider('openrouter')[0]
    expect(params.selectedProvider.value).toBe('openrouter')
    expect(params.selectedModel.value).toEqual(first)
    expect(params.config.value).toMatchObject({ provider: 'openrouter', model: first.id, aspectRatio: '1:1', imageSize: '1K' })
  })

  it('falls back to the default model for an unknown provider', () => {
    persist({ provider: 'retired-provider', modelId: 'x', config: {} })

    const params = useGenerationParams()

    expect(params.selectedModel.value).toEqual(DEFAULT_MODEL)
    expect(params.selectedProvider.value).toBe(DEFAULT_MODEL.provider)
    expect(params.config.value.provider).toBe(DEFAULT_MODEL.provider)
  })

  it('ignores corrupted storage', () => {
    localStorage.setItem(PARAMS_KEY, '{not json')

    expect(useGenerationParams().selectedModel.value).toEqual(DEFAULT_MODEL)
  })

  it('tolerates a stored entry without a config object', () => {
    persist({ provider: 'gemini', modelId: GEMINI_FLASH_IMAGE_MODEL })

    expect(useGenerationParams().config.value.aspectRatio).toBe('1:1')
  })

  it('migrates the legacy download format key', () => {
    localStorage.setItem('banacanvas-download-format', 'jpg')

    expect(useGenerationParams().downloadFormat.value).toBe('jpg')
    expect(localStorage.getItem('banacanvas-download-format')).toBeNull()
  })

  it('reads the aspect-ratio suggestion preference', () => {
    localStorage.setItem('banacanvas-suggest-aspect-ratio', 'false')

    expect(useGenerationParams().suggestAspectRatio.value).toBe(false)
  })
})

describe('persisting params', () => {
  it('saves config and download format changes', async () => {
    const params = useGenerationParams()

    params.config.value = { ...params.config.value, aspectRatio: '16:9', batchSize: 4 }
    params.downloadFormat.value = 'jpg'
    await nextTick()

    const saved = JSON.parse(localStorage.getItem(PARAMS_KEY)!)
    expect(saved).toMatchObject({
      provider: 'gemini',
      modelId: DEFAULT_MODEL.id,
      downloadFormat: 'jpg',
      config: { aspectRatio: '16:9', batchSize: 4 },
    })
  })

  it('round-trips through a fresh instance', async () => {
    const first = useGenerationParams()
    first.changeProvider('vercel')
    await nextTick()

    const second = useGenerationParams()
    expect(second.selectedProvider.value).toBe('vercel')
    expect(second.selectedModel.value).toEqual(first.selectedModel.value)
  })

  it('saves the aspect-ratio suggestion preference', async () => {
    const params = useGenerationParams()

    params.suggestAspectRatio.value = false
    await nextTick()

    expect(localStorage.getItem('banacanvas-suggest-aspect-ratio')).toBe('false')
  })
})

describe('changeModel', () => {
  it('resets ratio, size and Google Search the new model does not support', () => {
    const params = useGenerationParams()
    params.config.value = { ...params.config.value, aspectRatio: '8:1', imageSize: '512', googleSearch: true }

    params.changeModel(model(GEMINI_FLASH_LITE_IMAGE_MODEL, 'gemini'))

    expect(params.selectedModel.value.id).toBe(GEMINI_FLASH_LITE_IMAGE_MODEL)
    expect(params.config.value).toMatchObject({
      model: GEMINI_FLASH_LITE_IMAGE_MODEL,
      provider: 'gemini',
      aspectRatio: '1:1',
      imageSize: '1K',
      googleSearch: false,
    })
  })

  it('keeps options the new model supports', () => {
    const params = useGenerationParams()
    params.config.value = { ...params.config.value, aspectRatio: '16:9', imageSize: '2K', googleSearch: true }

    params.changeModel(model(GEMINI_NANO_BANANA_2_1_MODEL, 'gemini'))

    expect(params.config.value).toMatchObject({ aspectRatio: '16:9', imageSize: '2K', googleSearch: true })
  })

  it('resets thinking levels the new model does not accept', () => {
    const params = useGenerationParams()
    params.changeModel(model(GEMINI_NANO_BANANA_2_1_MODEL, 'gemini'))
    params.config.value = { ...params.config.value, thinkingLevel: 'MEDIUM' }

    params.changeModel(model(GEMINI_FLASH_IMAGE_MODEL, 'gemini'))

    expect(params.config.value.thinkingLevel).toBe('MINIMAL')
  })

  it('replaces sizes the provider cannot deliver (512 on OpenRouter)', () => {
    const params = useGenerationParams()
    params.config.value = { ...params.config.value, imageSize: '512' }

    params.changeModel(model(`google/${GEMINI_FLASH_IMAGE_MODEL}`, 'openrouter'))

    expect(params.config.value.imageSize).toBe('1K')
  })

  it('switches to the first valid size when the current one is unavailable', () => {
    const params = useGenerationParams()
    params.config.value = { ...params.config.value, imageSize: '1K' }

    params.changeModel(model(SEEDREAM_5_0_LITE_MODEL, 'openrouter'))

    expect(params.config.value.imageSize).toBe('2K')
  })

  it('drops the seed for models without seed support', () => {
    const params = useGenerationParams()
    params.changeModel(model(SEEDREAM_5_0_LITE_MODEL, 'openrouter'))
    params.config.value = { ...params.config.value, seed: 7 }

    params.changeModel(model(SEEDREAM_5_0_PRO_MODEL, 'openrouter'))

    expect(params.config.value).not.toHaveProperty('seed')
  })

  it('uses the GPT Image default quality when entering GPT Image, but keeps it between GPT models', () => {
    const params = useGenerationParams()
    params.config.value = { ...params.config.value, imageQuality: 'low' }

    params.changeModel(model(GPT_IMAGE_2_5_FLARE_MODEL, 'vercel'))
    expect(params.config.value.imageQuality).toBe('high')

    params.config.value = { ...params.config.value, imageQuality: 'max' }
    params.changeModel(model(GPT_IMAGE_2_5_SUNBURST_MODEL, 'vercel'))
    expect(params.config.value.imageQuality).toBe('max')

    params.changeModel(model(GEMINI_FLASH_IMAGE_MODEL, 'gemini'))
    expect(params.config.value.imageQuality).toBe('medium')
  })
})

describe('changeProvider', () => {
  it('selects the first model of the new provider', () => {
    const params = useGenerationParams()

    params.changeProvider('vercel')

    const first = getModelsForProvider('vercel')[0]
    expect(params.selectedProvider.value).toBe('vercel')
    expect(params.selectedModel.value).toEqual(first)
    expect(params.config.value).toMatchObject({ provider: 'vercel', model: first.id })
  })
})

describe('applyHistoryConfig', () => {
  const entry = (config: Partial<HistoryEntry['config']>): HistoryEntry => ({
    id: 'h1',
    timestamp: 0,
    prompt: 'p',
    imageBase64: '',
    imageMimeType: 'image/webp',
    config: { provider: 'gemini', model: GEMINI_FLASH_IMAGE_MODEL, ...config } as HistoryEntry['config'],
  })

  it('restores the stored model and config', () => {
    const params = useGenerationParams()

    const fallback = params.applyHistoryConfig(entry({ provider: 'openrouter', model: SEEDREAM_5_0_LITE_MODEL, aspectRatio: '21:9', seed: 9 }))

    expect(fallback).toBeUndefined()
    expect(params.selectedProvider.value).toBe('openrouter')
    expect(params.selectedModel.value).toEqual(model(SEEDREAM_5_0_LITE_MODEL, 'openrouter'))
    expect(params.config.value).toMatchObject({ aspectRatio: '21:9', seed: 9 })
  })

  it('matches the model on its provider when several providers share an id', () => {
    const params = useGenerationParams()
    const id = `google/${GEMINI_FLASH_IMAGE_MODEL}`

    const fallback = params.applyHistoryConfig(entry({ provider: 'vercel', model: id }))

    expect(fallback).toBeUndefined()
    expect(params.selectedModel.value).toEqual(model(id, 'vercel'))
    expect(params.selectedProvider.value).toBe('vercel')
    expect(params.config.value.provider).toBe('vercel')
  })

  it('defaults legacy entries without a provider to Gemini', () => {
    const params = useGenerationParams()

    const fallback = params.applyHistoryConfig(entry({ provider: undefined }))

    expect(fallback).toBeUndefined()
    expect(params.selectedProvider.value).toBe('gemini')
    expect(params.selectedModel.value).toEqual(model(GEMINI_FLASH_IMAGE_MODEL, 'gemini'))
    expect(params.config.value.provider).toBe('gemini')
  })

  it('resets options the model no longer supports', () => {
    const params = useGenerationParams()

    params.applyHistoryConfig(entry({ model: GEMINI_FLASH_LITE_IMAGE_MODEL, googleSearch: true, aspectRatio: '8:1', imageSize: '4K' }))

    expect(params.config.value).toMatchObject({ googleSearch: false, aspectRatio: '1:1', imageSize: '1K' })
  })

  it('falls back to the provider\'s first model when the model was removed', () => {
    const params = useGenerationParams()

    const fallback = params.applyHistoryConfig(entry({ provider: 'openrouter', model: 'retired/model', aspectRatio: '9:20', imageSize: '512', seed: 3 }))

    const first = getModelsForProvider('openrouter')[0]
    expect(fallback).toEqual({ unavailableModel: 'retired/model', fallback: first })
    expect(params.selectedModel.value).toEqual(first)
    expect(params.selectedProvider.value).toBe('openrouter')
    expect(params.config.value).toMatchObject({ model: first.id, provider: 'openrouter', aspectRatio: '1:1', imageSize: '1K' })
    expect(params.config.value).not.toHaveProperty('seed')
  })

  it('falls back to the default model when the provider was removed', () => {
    const params = useGenerationParams()

    const fallback = params.applyHistoryConfig(entry({ provider: 'retired-provider' as Provider, model: 'x' }))

    expect(fallback).toEqual({ unavailableModel: 'x', fallback: DEFAULT_MODEL })
    expect(params.selectedProvider.value).toBe(DEFAULT_MODEL.provider)
    expect(params.config.value).toMatchObject({ model: DEFAULT_MODEL.id, provider: DEFAULT_MODEL.provider })
  })
})
