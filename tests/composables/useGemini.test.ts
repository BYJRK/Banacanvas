import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGemini } from '../../src/composables/useGemini'
import { useApiKeyStore } from '../../src/stores/apiKey'
import { GEMINI_FLASH_IMAGE_MODEL } from '../../src/config/models'
import type { GenerationConfig } from '../../src/types'
import { IMAGE_B64, en, inputImage, waitForAbort } from '../helpers'

const sdk = vi.hoisted(() => ({
  constructed: vi.fn(),
  generateContentStream: vi.fn(),
}))

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContentStream: sdk.generateContentStream }
    constructor(options: unknown) { sdk.constructed(options) }
  },
}))

type Chunk = Record<string, unknown>

async function* stream(...chunks: Chunk[]) {
  for (const chunk of chunks) yield chunk
}

const imagePart = (data: string, mimeType = 'image/png') => ({ inlineData: { data, mimeType } })
const chunkWith = (...parts: unknown[]): Chunk => ({ candidates: [{ content: { parts } }] })

function config(overrides: Partial<GenerationConfig> = {}): GenerationConfig {
  return { provider: 'gemini', model: GEMINI_FLASH_IMAGE_MODEL, ...overrides }
}

function lastCall() {
  return sdk.generateContentStream.mock.calls.at(-1)![0]
}

beforeEach(() => {
  localStorage.setItem('banacanvas-api-key', 'gem-key')
  setActivePinia(createPinia())
  sdk.constructed.mockReset()
  sdk.generateContentStream.mockReset()
})

describe('request building', () => {
  it('maps config to the Gemini API request', async () => {
    sdk.generateContentStream.mockResolvedValue(stream(chunkWith(imagePart(IMAGE_B64))))

    await useGemini().generateImage('a cat', config({
      thinkingLevel: 'HIGH',
      aspectRatio: '3:2',
      imageSize: '2K',
      personGeneration: 'ALLOW_ADULT',
      googleSearch: true,
    }))

    expect(sdk.constructed).toHaveBeenCalledWith({ apiKey: 'gem-key' })
    const call = lastCall()
    expect(call.model).toBe(GEMINI_FLASH_IMAGE_MODEL)
    expect(call.contents).toEqual([{ role: 'user', parts: [{ text: 'a cat' }] }])
    expect(call.config).toMatchObject({
      responseModalities: ['IMAGE', 'TEXT'],
      thinkingConfig: { thinkingLevel: 'HIGH' },
      imageConfig: { aspectRatio: '3:2', imageSize: '2K', personGeneration: 'ALLOW_ADULT' },
      tools: [{ googleSearch: {} }],
    })
    expect(call.config.abortSignal).toBeInstanceOf(AbortSignal)
  })

  it('omits optional config that is not set', async () => {
    sdk.generateContentStream.mockResolvedValue(stream(chunkWith(imagePart(IMAGE_B64))))

    await useGemini().generateImage('a cat', config())

    expect(lastCall().config).not.toHaveProperty('imageConfig')
    expect(lastCall().config).not.toHaveProperty('tools')
    expect(lastCall().config).not.toHaveProperty('thinkingConfig')
  })

  it('sends reference images as inline data before the prompt', async () => {
    sdk.generateContentStream.mockResolvedValue(stream(chunkWith(imagePart(IMAGE_B64))))
    const images = [inputImage(0), inputImage(1, 'image/webp')]

    await useGemini().editImage(images, 'make it blue', config())

    expect(lastCall().contents[0].parts).toEqual([
      { inlineData: { mimeType: 'image/png', data: images[0].base64 } },
      { inlineData: { mimeType: 'image/webp', data: images[1].base64 } },
      { text: 'make it blue' },
    ])
  })

  it('reuses the SDK client until the API key changes', async () => {
    sdk.generateContentStream.mockImplementation(async () => stream(chunkWith(imagePart(IMAGE_B64))))
    const api = useGemini()

    await api.generateImage('one', config())
    await api.generateImage('two', config())
    expect(sdk.constructed).toHaveBeenCalledTimes(1)

    useApiKeyStore().setKey('gemini', 'new-key')
    await api.generateImage('three', config())
    expect(sdk.constructed).toHaveBeenCalledTimes(2)
    expect(sdk.constructed).toHaveBeenLastCalledWith({ apiKey: 'new-key' })
  })
})

describe('stream collection', () => {
  it('reads every chunk: final image, joined text and last usage metadata', async () => {
    sdk.generateContentStream.mockResolvedValue(stream(
      { ...chunkWith(imagePart('aW50ZXJpbQ=='), { text: 'Hello ' }), usageMetadata: { promptTokenCount: 1 } },
      chunkWith({ text: 'world' }, imagePart(IMAGE_B64, 'image/jpeg')),
      {
        usageMetadata: {
          promptTokenCount: 1000,
          candidatesTokenCount: 1220,
          thoughtsTokenCount: 200,
          totalTokenCount: 2420,
          candidatesTokensDetails: [
            { modality: 'IMAGE', tokenCount: 1120 },
            { modality: 'TEXT', tokenCount: 100 },
          ],
        },
      },
    ))

    const result = await useGemini().generateImage('a cat', config())

    expect(result.imageBase64).toBe(IMAGE_B64)
    expect(result.imageMimeType).toBe('image/jpeg')
    expect(result.textResponse).toBe('Hello world')
    expect(result.usage).toMatchObject({
      promptTokenCount: 1000,
      candidatesTokenCount: 1220,
      thoughtsTokenCount: 200,
      totalTokenCount: 2420,
    })
    // $0.50/M input + (100 text + 200 thought) at $3/M + 1120 image at $60/M
    expect(result.usage?.estimatedCost).toBeCloseTo(0.0005 + 0.0009 + 0.0672, 9)
  })

  it('treats all candidate tokens as image output without a modality breakdown', async () => {
    sdk.generateContentStream.mockResolvedValue(stream(
      chunkWith(imagePart(IMAGE_B64)),
      { usageMetadata: { promptTokenCount: 0, candidatesTokenCount: 1120, totalTokenCount: 1120 } },
    ))

    const { usage } = await useGemini().generateImage('a cat', config())

    expect(usage?.estimatedCost).toBeCloseTo(0.0672, 9)
  })

  it('returns no usage when the stream has no metadata', async () => {
    sdk.generateContentStream.mockResolvedValue(stream(chunkWith(imagePart(IMAGE_B64))))

    const result = await useGemini().generateImage('a cat', config())

    expect(result.usage).toBeUndefined()
    expect(result.textResponse).toBeUndefined()
  })

  it('throws when the stream contains no image', async () => {
    sdk.generateContentStream.mockResolvedValue(stream(chunkWith({ text: 'Sorry, I cannot.' })))
    const api = useGemini()

    await expect(api.generateImage('a cat', config())).rejects.toThrow(en.noImageGenerated)
    expect(api.error.value).toBe(en.noImageGenerated)
    expect(api.loading.value).toBe(false)
  })
})

describe('errors and cancellation', () => {
  it('requires an API key', async () => {
    localStorage.removeItem('banacanvas-api-key')
    setActivePinia(createPinia())

    await expect(useGemini().generateImage('a cat', config())).rejects.toThrow(en.apiKeyNotSet)
    expect(sdk.constructed).not.toHaveBeenCalled()
  })

  it('surfaces SDK errors verbatim, even when they mention "abort"', async () => {
    sdk.generateContentStream.mockRejectedValue(new Error('Model aborted: safety'))
    const api = useGemini()

    await expect(api.generateImage('a cat', config())).rejects.toThrow('Model aborted: safety')
    expect(api.error.value).toBe('Model aborted: safety')
  })

  it('reports cancel() mid-stream as a cancellation even if the stream fails differently', async () => {
    sdk.generateContentStream.mockImplementation(async ({ config: apiConfig }) => {
      await waitForAbort(apiConfig.abortSignal, new Error('stream closed unexpectedly'))
    })
    const api = useGemini()

    const pending = api.editImage([inputImage()], 'edit', config())
    expect(api.loading.value).toBe(true)
    api.cancel()

    await expect(pending).rejects.toThrow(en.generationCancelled)
    expect(api.loading.value).toBe(false)
    expect(api.error.value).toBeNull()
  })

  it('passes an external signal through without managing loading', async () => {
    sdk.generateContentStream.mockImplementation(async ({ config: apiConfig }) => waitForAbort(apiConfig.abortSignal))
    const api = useGemini()
    const controller = new AbortController()

    const pending = api.generateImage('a cat', config(), controller.signal)
    expect(api.loading.value).toBe(false)
    controller.abort()

    await expect(pending).rejects.toThrow(en.generationCancelled)
    expect(lastCall().config.abortSignal).toBe(controller.signal)
  })
})
