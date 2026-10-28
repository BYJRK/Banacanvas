import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useImageGeneration, type GenerationRequest } from '../../src/composables/useImageGeneration'
import { useGemini } from '../../src/composables/useGemini'
import { useOpenRouter } from '../../src/composables/useOpenRouter'
import { useVercelAI } from '../../src/composables/useVercelAI'
import { useHistoryStore } from '../../src/stores/history'
import type { GenerationConfig, GenerationResult, HistoryEntry, Provider } from '../../src/types'
import { deferred, en, inputImage } from '../helpers'

async function fakeProvider() {
  const { ref } = await import('vue')
  const { vi } = await import('vitest')
  return {
    loading: ref(false),
    error: ref<string | null>(null),
    generateImage: vi.fn(),
    editImage: vi.fn(),
    cancel: vi.fn(),
  }
}

vi.mock('../../src/composables/useGemini', async () => {
  const api = await fakeProvider()
  return { useGemini: () => api }
})
vi.mock('../../src/composables/useOpenRouter', async () => {
  const api = await fakeProvider()
  return { useOpenRouter: () => api }
})
vi.mock('../../src/composables/useVercelAI', async () => {
  const api = await fakeProvider()
  return { useVercelAI: () => api }
})
vi.mock('../../src/stores/history', async () => {
  const { vi } = await import('vitest')
  const store = { addEntry: vi.fn() }
  return { useHistoryStore: () => store }
})

const providers = {
  gemini: vi.mocked(useGemini()),
  openrouter: vi.mocked(useOpenRouter()),
  vercel: vi.mocked(useVercelAI()),
} as const
const history = vi.mocked(useHistoryStore())
const toast = vi.fn()
const notify = vi.fn()

function result(n: number, usage?: GenerationResult['usage']): GenerationResult {
  return { imageBase64: `img-${n}`, imageMimeType: 'image/png', textResponse: `text-${n}`, usage }
}

const usage = (cost?: number) => ({
  promptTokenCount: 10,
  candidatesTokenCount: 20,
  thoughtsTokenCount: 5,
  totalTokenCount: 35,
  estimatedCost: cost,
})

function request(provider: Provider = 'gemini', overrides: Partial<GenerationConfig> = {}, images = 0): GenerationRequest {
  return {
    prompt: 'a cat',
    config: { provider, model: 'model-x', ...overrides },
    inputImages: Array.from({ length: images }, (_, i) => inputImage(i)),
  }
}

beforeEach(() => {
  for (const api of Object.values(providers)) {
    api.generateImage.mockReset()
    api.editImage.mockReset()
    api.cancel.mockReset()
    api.loading.value = false
  }
  history.addEntry.mockReset()
  toast.mockReset()
  notify.mockReset()
})

describe('single generation', () => {
  it.each(['gemini', 'openrouter', 'vercel'] as const)('routes to the %s provider', async (provider) => {
    providers[provider].generateImage.mockResolvedValue(result(1))

    await useImageGeneration({ toast, notify }).generate(request(provider))

    for (const [name, api] of Object.entries(providers)) {
      expect(api.generateImage).toHaveBeenCalledTimes(name === provider ? 1 : 0)
    }
  })

  it('shows the result, saves it to history and notifies', async () => {
    providers.gemini.generateImage.mockResolvedValue(result(1, usage(0.05)))
    const gen = useImageGeneration({ toast, notify })
    const req = request()

    await gen.generate(req)

    expect(providers.gemini.generateImage).toHaveBeenCalledWith('a cat', req.config)
    expect(gen.resultImage.value).toBe('img-1')
    expect(gen.resultMimeType.value).toBe('image/png')
    expect(gen.resultText.value).toBe('text-1')
    expect(gen.resultUsage.value).toMatchObject({ ...usage(0.05), elapsedMs: expect.any(Number) })
    expect(gen.errorMessage.value).toBeNull()
    expect(history.addEntry).toHaveBeenCalledWith({
      prompt: 'a cat',
      config: req.config,
      imageBase64: 'img-1',
      imageMimeType: 'image/png',
      inputImages: [],
      textResponse: 'text-1',
    })
    expect(toast).toHaveBeenCalledWith(en.imageGenerated, 'success')
    expect(notify).toHaveBeenCalledWith(true)
  })

  it('edits with reference images and stores them without ids', async () => {
    providers.openrouter.editImage.mockResolvedValue(result(1))
    const req = request('openrouter', {}, 2)

    await useImageGeneration({ toast, notify }).generate(req)

    expect(providers.openrouter.editImage).toHaveBeenCalledWith(req.inputImages, 'a cat', req.config)
    expect(providers.openrouter.generateImage).not.toHaveBeenCalled()
    expect(history.addEntry.mock.calls[0][0].inputImages).toEqual(
      req.inputImages.map(({ base64, mimeType }) => ({ base64, mimeType })))
  })

  it('reports zero usage with elapsed time when the provider returns none', async () => {
    providers.gemini.generateImage.mockResolvedValue(result(1))
    const gen = useImageGeneration({ toast, notify })

    await gen.generate(request())

    expect(gen.resultUsage.value).toEqual({
      promptTokenCount: 0,
      candidatesTokenCount: 0,
      thoughtsTokenCount: 0,
      totalTokenCount: 0,
      elapsedMs: expect.any(Number),
    })
  })

  it('shows errors without saving history', async () => {
    providers.gemini.generateImage.mockRejectedValue(new Error('quota exceeded'))
    const gen = useImageGeneration({ toast, notify })

    await gen.generate(request())

    expect(gen.errorMessage.value).toBe('quota exceeded')
    expect(gen.resultImage.value).toBeUndefined()
    expect(history.addEntry).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith('quota exceeded', 'error')
    expect(notify).toHaveBeenCalledWith(false)
  })

  it('stays silent when the user cancels', async () => {
    const pending = deferred<GenerationResult>()
    providers.gemini.generateImage.mockReturnValue(pending.promise)
    const gen = useImageGeneration({ toast, notify })

    const run = gen.generate(request())
    gen.cancel()
    pending.reject(new Error(en.generationCancelled))
    await run

    for (const api of Object.values(providers)) expect(api.cancel).toHaveBeenCalled()
    expect(gen.errorMessage.value).toBeNull()
    expect(toast).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
  })

  it('clears the previous result before a new run', async () => {
    providers.gemini.generateImage.mockResolvedValueOnce(result(1))
    providers.gemini.generateImage.mockRejectedValueOnce(new Error('boom'))
    const gen = useImageGeneration({ toast, notify })

    await gen.generate(request())
    await gen.generate(request())

    expect(gen.resultImage.value).toBeUndefined()
    expect(gen.resultUsage.value).toBeUndefined()
    expect(gen.errorMessage.value).toBe('boom')
  })

  it('reflects the provider loading state', () => {
    const gen = useImageGeneration({ toast, notify })
    expect(gen.loading.value).toBe(false)

    providers.vercel.loading.value = true

    expect(gen.loading.value).toBe(true)
  })
})

describe('batch generation', () => {
  it('runs requests in parallel with their own signals and summarises the outcome', async () => {
    providers.gemini.generateImage
      .mockResolvedValueOnce(result(1, usage(0.01)))
      .mockRejectedValueOnce(new Error('rate limited'))
      .mockResolvedValueOnce(result(3, usage(0.02)))
    const gen = useImageGeneration({ toast, notify })

    await gen.generate(request('gemini', { batchSize: 3 }))

    const signals = providers.gemini.generateImage.mock.calls.map((call) => call[2])
    expect(signals).toHaveLength(3)
    expect(new Set(signals).size).toBe(3)
    for (const signal of signals) expect(signal).toBeInstanceOf(AbortSignal)

    expect(gen.batchResults.value).toHaveLength(3)
    expect(gen.batchResults.value.filter((r) => r.imageBase64).map((r) => r.imageBase64)).toEqual(['img-1', 'img-3'])
    expect(gen.batchResults.value.find((r) => r.error)?.error).toBe('rate limited')
    expect(gen.batchProgress.value).toEqual({ current: 3, total: 3 })
    expect(gen.resultImage.value).toBeUndefined()
    expect(history.addEntry).toHaveBeenCalledTimes(2)
    expect(gen.loading.value).toBe(false)

    expect(gen.resultUsage.value).toMatchObject({
      promptTokenCount: 20,
      candidatesTokenCount: 40,
      thoughtsTokenCount: 10,
      totalTokenCount: 70,
      elapsedMs: expect.any(Number),
    })
    expect(gen.resultUsage.value?.estimatedCost).toBeCloseTo(0.03, 9)

    expect(toast).toHaveBeenCalledWith(en.batchComplete.replace('{success}', '2').replace('{total}', '3'), 'info')
    expect(notify).toHaveBeenCalledWith(true)
  })

  it('uses editImage with references for every request', async () => {
    providers.vercel.editImage.mockResolvedValue(result(1))
    const req = request('vercel', { batchSize: 2 }, 1)

    await useImageGeneration({ toast, notify }).generate(req)

    expect(providers.vercel.editImage).toHaveBeenCalledTimes(2)
    expect(providers.vercel.editImage.mock.calls[0].slice(0, 3)).toEqual([req.inputImages, 'a cat', req.config])
  })

  it('reports full success', async () => {
    providers.gemini.generateImage.mockResolvedValue(result(1))

    await useImageGeneration({ toast, notify }).generate(request('gemini', { batchSize: 2 }))

    expect(toast).toHaveBeenCalledWith(en.batchComplete.replace('{success}', '2').replace('{total}', '2'), 'success')
    expect(notify).toHaveBeenCalledWith(true)
  })

  it('reports total failure', async () => {
    providers.gemini.generateImage.mockRejectedValue(new Error('down'))

    await useImageGeneration({ toast, notify }).generate(request('gemini', { batchSize: 2 }))

    expect(toast).toHaveBeenCalledWith(en.batchComplete.replace('{success}', '0').replace('{total}', '2'), 'error')
    expect(notify).toHaveBeenCalledWith(false)
  })

  it('drops the cost total when a successful item has unknown cost', async () => {
    providers.gemini.generateImage
      .mockResolvedValueOnce(result(1, usage(0.01)))
      .mockResolvedValueOnce(result(2))
    const gen = useImageGeneration({ toast, notify })

    await gen.generate(request('gemini', { batchSize: 2 }))

    expect(gen.resultUsage.value?.estimatedCost).toBeUndefined()
  })

  it('tracks progress and loading while running', async () => {
    const first = deferred<GenerationResult>()
    const second = deferred<GenerationResult>()
    providers.gemini.generateImage.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const gen = useImageGeneration({ toast, notify })

    const run = gen.generate(request('gemini', { batchSize: 2 }))
    expect(gen.loading.value).toBe(true)
    expect(gen.batchProgress.value).toEqual({ current: 0, total: 2 })

    first.resolve(result(1))
    await vi.waitFor(() => expect(gen.batchProgress.value).toEqual({ current: 1, total: 2 }))

    second.resolve(result(2))
    await run
    expect(gen.loading.value).toBe(false)
  })

  it('aborts every request on cancel and stays silent', async () => {
    providers.gemini.generateImage.mockImplementation((_p, _c, signal) =>
      new Promise((_, reject) => signal?.addEventListener('abort', () => reject(new Error(en.generationCancelled)))))
    const gen = useImageGeneration({ toast, notify })

    const run = gen.generate(request('gemini', { batchSize: 3 }))
    gen.cancel()
    await run

    for (const call of providers.gemini.generateImage.mock.calls) expect(call[2]?.aborted).toBe(true)
    expect(gen.loading.value).toBe(false)
    expect(gen.batchProgress.value).toBeNull()
    expect(toast).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
  })
})

describe('result helpers', () => {
  const entry = (n: number): HistoryEntry => ({
    id: `h${n}`,
    timestamp: n,
    prompt: 'p',
    config: { provider: 'gemini', model: 'm' },
    imageBase64: `img-${n}`,
    imageMimeType: 'image/webp',
    textResponse: `text-${n}`,
  })

  it('shows a single history entry as the main result', () => {
    const gen = useImageGeneration({ toast, notify })
    gen.errorMessage.value = 'old error'

    gen.showHistoryEntries([entry(1)])

    expect(gen.resultImage.value).toBe('img-1')
    expect(gen.resultMimeType.value).toBe('image/webp')
    expect(gen.resultText.value).toBe('text-1')
    expect(gen.errorMessage.value).toBeNull()
    expect(gen.batchResults.value).toEqual([])
  })

  it('shows several history entries as a batch gallery', () => {
    const gen = useImageGeneration({ toast, notify })

    gen.showHistoryEntries([entry(1), entry(2)])

    expect(gen.resultImage.value).toBeUndefined()
    expect(gen.batchResults.value).toEqual([
      { imageBase64: 'img-1', imageMimeType: 'image/webp', textResponse: 'text-1' },
      { imageBase64: 'img-2', imageMimeType: 'image/webp', textResponse: 'text-2' },
    ])
  })

  it('clearResult resets all result state', () => {
    const gen = useImageGeneration({ toast, notify })
    gen.showHistoryEntries([entry(1), entry(2)])
    gen.batchProgress.value = { current: 1, total: 2 }

    gen.clearResult()

    expect(gen.batchResults.value).toEqual([])
    expect(gen.batchProgress.value).toBeNull()
    expect(gen.resultImage.value).toBeUndefined()
  })
})

describe('history saving failures', () => {
  it('keeps a successful image, usage and success notification when saving fails', async () => {
    providers.gemini.generateImage.mockResolvedValue(result(1, usage(0.05)))
    history.addEntry.mockRejectedValue(new DOMException('Full', 'QuotaExceededError'))
    const gen = useImageGeneration({ toast, notify })
    await gen.generate(request())
    expect(gen.resultImage.value).toBe('img-1')
    expect(gen.resultUsage.value?.estimatedCost).toBe(0.05)
    expect(gen.errorMessage.value).toBeNull()
    const warning = en.historySaveFailed.replace('{count}', '1').replace('{error}', en.historyStorageFull)
    expect(gen.historySaveError.value).toBe(warning)
    expect(toast).toHaveBeenCalledWith(warning, 'info')
    expect(notify).toHaveBeenCalledExactlyOnceWith(true)
    expect(gen.loading.value).toBe(false)
  })

  it('adds exactly one result per batch request even when every save fails', async () => {
    providers.gemini.generateImage.mockResolvedValue(result(1, usage(0.01)))
    history.addEntry.mockRejectedValue(new Error('Disk failed'))
    const gen = useImageGeneration({ toast, notify })
    await gen.generate(request('gemini', { batchSize: 3 }))
    expect(gen.batchResults.value).toHaveLength(3)
    expect(gen.batchResults.value.every((item) => item.imageBase64 && !item.error)).toBe(true)
    expect(gen.batchProgress.value).toEqual({ current: 3, total: 3 })
    expect(gen.resultUsage.value?.estimatedCost).toBeCloseTo(0.03)
    expect(gen.historySaveError.value).toBe(en.historySaveFailed.replace('{count}', '3').replace('{error}', 'Disk failed'))
    expect(toast).toHaveBeenCalledWith(en.batchComplete.replace('{success}', '3').replace('{total}', '3'), 'success')
    expect(notify).toHaveBeenCalledExactlyOnceWith(true)
  })

  it('preserves real generation failures alongside independent save failures', async () => {
    providers.gemini.generateImage.mockResolvedValueOnce(result(1)).mockRejectedValueOnce(new Error('API failed'))
    history.addEntry.mockRejectedValue(new Error('Disk failed'))
    const gen = useImageGeneration({ toast, notify })
    await gen.generate(request('gemini', { batchSize: 2 }))
    expect(gen.batchResults.value).toHaveLength(2)
    expect(gen.batchResults.value.filter((item) => item.error)).toEqual([{ error: 'API failed' }])
    expect(gen.historySaveError.value).toContain('Disk failed')
    expect(toast).toHaveBeenCalledWith(en.batchComplete.replace('{success}', '1').replace('{total}', '2'), 'info')
  })

  it('retries only unsaved history and never invokes the provider again', async () => {
    providers.gemini.generateImage.mockResolvedValue(result(1))
    history.addEntry.mockRejectedValueOnce(new Error('Disk failed')).mockResolvedValueOnce({} as HistoryEntry)
    const gen = useImageGeneration({ toast, notify })
    const req = request()
    await gen.generate(req)
    req.config.model = 'changed-after-generation'
    await gen.retrySaveHistory()
    expect(history.addEntry).toHaveBeenCalledTimes(2)
    expect(history.addEntry.mock.calls[1][0].config.model).toBe('model-x')
    expect(providers.gemini.generateImage).toHaveBeenCalledTimes(1)
    expect(gen.historySaveError.value).toBeNull()
    expect(gen.resultImage.value).toBe('img-1')
    expect(toast).toHaveBeenCalledWith(en.historySaveSuccess, 'success')
    await gen.retrySaveHistory()
    expect(history.addEntry).toHaveBeenCalledTimes(2)
  })

  it('retries failed entries without duplicating successful saves across partial retries', async () => {
    providers.gemini.generateImage.mockResolvedValue(result(1))
    history.addEntry.mockRejectedValue(new Error('Disk failed'))
    const gen = useImageGeneration({ toast, notify })
    await gen.generate(request('gemini', { batchSize: 2 }))
    history.addEntry.mockResolvedValueOnce({} as HistoryEntry).mockRejectedValueOnce(new Error('Still full'))
    await gen.retrySaveHistory()
    expect(gen.historySaveError.value).toBe(en.historySaveFailed.replace('{count}', '1').replace('{error}', 'Still full'))
    history.addEntry.mockResolvedValue({} as HistoryEntry)
    await gen.retrySaveHistory()
    expect(history.addEntry).toHaveBeenCalledTimes(5)
    expect(providers.gemini.generateImage).toHaveBeenCalledTimes(2)
    expect(gen.historySaveError.value).toBeNull()
  })

  it('keeps loading while saving and ignores duplicate retry clicks', async () => {
    providers.gemini.generateImage.mockResolvedValue(result(1))
    history.addEntry.mockRejectedValueOnce(new Error('Disk failed'))
    const gen = useImageGeneration({ toast, notify })
    await gen.generate(request())
    const saving = deferred<HistoryEntry>()
    history.addEntry.mockReturnValue(saving.promise)
    const retry = gen.retrySaveHistory()
    expect(gen.savingHistory.value).toBe(true)
    expect(gen.loading.value).toBe(true)
    await gen.retrySaveHistory()
    expect(history.addEntry).toHaveBeenCalledTimes(2)
    saving.resolve({} as HistoryEntry)
    await retry
    expect(gen.savingHistory.value).toBe(false)
    expect(gen.loading.value).toBe(false)
  })

  it('keeps single generation loading until its history write finishes', async () => {
    providers.gemini.generateImage.mockResolvedValue(result(1))
    const saving = deferred<HistoryEntry>()
    history.addEntry.mockReturnValue(saving.promise)
    const gen = useImageGeneration({ toast, notify })
    const run = gen.generate(request())
    await vi.waitFor(() => expect(gen.resultImage.value).toBe('img-1'))
    expect(gen.loading.value).toBe(true)
    saving.resolve({} as HistoryEntry)
    await run
    expect(gen.loading.value).toBe(false)
  })

  it('clears stale persistence warnings with the result', async () => {
    providers.gemini.generateImage.mockResolvedValue(result(1))
    history.addEntry.mockRejectedValue(new Error('Disk failed'))
    const gen = useImageGeneration({ toast, notify })
    await gen.generate(request())
    gen.clearResult()
    expect(gen.historySaveError.value).toBeNull()
    await gen.retrySaveHistory()
    expect(history.addEntry).toHaveBeenCalledTimes(1)
  })
})
