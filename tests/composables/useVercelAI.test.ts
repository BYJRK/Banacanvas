import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useVercelAI } from '../../src/composables/useVercelAI'
import {
  GEMINI_PRO_IMAGE_MODEL,
  GPT_IMAGE_2_5_FLARE_MODEL,
  MAI_IMAGE_2_6_MODEL,
} from '../../src/config/models'
import type { GenerationConfig } from '../../src/types'
import { IMAGE_B64, en, inputImage, waitForAbort } from '../helpers'

const sdk = vi.hoisted(() => ({
  createGateway: vi.fn(),
  generateText: vi.fn(),
  generateImage: vi.fn(),
}))

vi.mock('ai', () => ({
  createGateway: sdk.createGateway,
  generateText: sdk.generateText,
  generateImage: sdk.generateImage,
}))

function config(overrides: Partial<GenerationConfig> = {}): GenerationConfig {
  return { provider: 'vercel', model: `google/${GEMINI_PRO_IMAGE_MODEL}`, ...overrides }
}

function textResult(overrides: Record<string, unknown> = {}) {
  return {
    files: [{ mediaType: 'image/png', base64: IMAGE_B64 }],
    text: '',
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    ...overrides,
  }
}

function imageResult(overrides: Record<string, unknown> = {}) {
  return {
    images: [{ base64: IMAGE_B64, mediaType: 'image/png' }],
    usage: { inputTokens: 100, outputTokens: 1000, totalTokens: undefined },
    providerMetadata: {},
    ...overrides,
  }
}

beforeEach(() => {
  localStorage.setItem('banacanvas-vercel-key', 'vc-key')
  setActivePinia(createPinia())
  for (const fn of Object.values(sdk)) fn.mockReset()
  sdk.createGateway.mockImplementation(() =>
    Object.assign((id: string) => ({ kind: 'language', id }), { imageModel: (id: string) => ({ kind: 'image', id }) }))
})

describe('Gemini models via generateText', () => {
  it('sends the prompt with Google image options', async () => {
    sdk.generateText.mockResolvedValue(textResult())

    await useVercelAI().generateImage('a cat', config({ aspectRatio: '4:3', imageSize: '2K' }))

    expect(sdk.createGateway).toHaveBeenCalledWith({ apiKey: 'vc-key' })
    const args = sdk.generateText.mock.calls[0][0]
    expect(args.model).toEqual({ kind: 'language', id: `google/${GEMINI_PRO_IMAGE_MODEL}` })
    expect(args.messages).toEqual([{ role: 'user', content: 'a cat' }])
    expect(args.providerOptions).toEqual({
      google: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '4:3', imageSize: '2K' } },
    })
    expect(args.abortSignal).toBeInstanceOf(AbortSignal)
  })

  it('sends reference images before the prompt when editing', async () => {
    sdk.generateText.mockResolvedValue(textResult())
    const images = [inputImage(0)]

    await useVercelAI().editImage(images, 'make it blue', config())

    expect(sdk.generateText.mock.calls[0][0].messages[0].content).toEqual([
      { type: 'image', image: `data:image/png;base64,${images[0].base64}` },
      { type: 'text', text: 'make it blue' },
    ])
  })

  it('returns the last image file, text and token-based cost', async () => {
    sdk.generateText.mockResolvedValue(textResult({
      files: [
        { mediaType: 'image/png', base64: 'aW50ZXJpbQ==' },
        { mediaType: 'text/plain', base64: 'bm90ZXM=' },
        { mediaType: 'image/webp', base64: IMAGE_B64 },
      ],
      text: 'Done',
      usage: { inputTokens: 1000, outputTokens: 1120, totalTokens: undefined },
    }))

    const result = await useVercelAI().generateImage('a cat', config())

    expect(result.imageBase64).toBe(IMAGE_B64)
    expect(result.imageMimeType).toBe('image/webp')
    expect(result.textResponse).toBe('Done')
    expect(result.usage?.totalTokenCount).toBe(2120)
    // 1000 input at $2/M + 1120 image tokens at $120/M
    expect(result.usage?.estimatedCost).toBeCloseTo(0.1364, 9)
  })

  it('throws when no image file is returned', async () => {
    sdk.generateText.mockResolvedValue(textResult({ files: [], text: 'No.' }))

    await expect(useVercelAI().generateImage('a cat', config())).rejects.toThrow(en.noImageGenerated)
  })
})

describe('image models via generateImage', () => {
  it('sends GPT Image size and OpenAI options', async () => {
    sdk.generateImage.mockResolvedValue(imageResult({ providerMetadata: { openai: { images: [{ imageTokens: 0 }] } } }))

    const result = await useVercelAI().generateImage('a logo', config({
      model: GPT_IMAGE_2_5_FLARE_MODEL,
      aspectRatio: '16:9',
      imageSize: '2K',
    }))

    const args = sdk.generateImage.mock.calls[0][0]
    expect(args.model).toEqual({ kind: 'image', id: GPT_IMAGE_2_5_FLARE_MODEL })
    expect(args.prompt).toBe('a logo')
    expect(args.n).toBe(1)
    expect(args.size).toBe('2720x1536')
    expect(args.providerOptions).toEqual({ openai: { quality: 'high', background: 'auto', outputFormat: 'png' } })
    // 100 text tokens at $5/M + 1000 output tokens at $30/M
    expect(result.usage?.estimatedCost).toBeCloseTo(0.0305, 9)
    expect(result.usage?.totalTokenCount).toBe(1100)
  })

  it('sends MAI references and web grounding, adding the grounding fee', async () => {
    sdk.generateImage.mockResolvedValue(imageResult({
      usage: { inputTokens: 300, outputTokens: 1000, totalTokens: 1300 },
      providerMetadata: { azure: { images: [{ imageTokens: 50 }] } },
    }))
    const images = [inputImage(0)]

    const result = await useVercelAI().editImage(images, 'edit', config({
      model: MAI_IMAGE_2_6_MODEL,
      aspectRatio: '1:1',
      imageSize: '1.5K',
      webGrounding: true,
    }))

    const args = sdk.generateImage.mock.calls[0][0]
    expect(args.prompt).toEqual({ text: 'edit', images: [`data:image/png;base64,${images[0].base64}`] })
    expect(args.size).toBe('1536x1536')
    expect(args.providerOptions).toEqual({ azure: { autoAspectRatio: false, webGrounding: true } })
    // (250 text at $5/M + 50 image at $8/M + 1000 output at $38/M) + $0.014 grounding
    expect(result.usage?.estimatedCost).toBeCloseTo(0.03965 + 0.014, 9)
  })

  it('bills all input at the image rate when per-image token metadata is missing', async () => {
    sdk.generateImage.mockResolvedValue(imageResult())

    const result = await useVercelAI().editImage([inputImage()], 'edit', config({ model: GPT_IMAGE_2_5_FLARE_MODEL }))

    // 100 input at $8/M + 1000 output at $30/M
    expect(result.usage?.estimatedCost).toBeCloseTo(0.0308, 9)
  })

  it('rejects too many reference images without calling the SDK', async () => {
    const images = [0, 1, 2, 3, 4, 5].map((i) => inputImage(i))

    await expect(useVercelAI().editImage(images, 'edit', config({ model: MAI_IMAGE_2_6_MODEL })))
      .rejects.toThrow(en.referenceImagesLimitReached.replace('{count}', '5'))
    expect(sdk.generateImage).not.toHaveBeenCalled()
  })

  it('throws when no image is returned', async () => {
    sdk.generateImage.mockResolvedValue(imageResult({ images: [] }))

    await expect(useVercelAI().generateImage('a logo', config({ model: GPT_IMAGE_2_5_FLARE_MODEL })))
      .rejects.toThrow(en.noImageGenerated)
  })
})

describe('errors and cancellation', () => {
  it('requires an API key', async () => {
    localStorage.removeItem('banacanvas-vercel-key')
    setActivePinia(createPinia())

    await expect(useVercelAI().generateImage('a cat', config())).rejects.toThrow(en.apiKeyNotSet)
    expect(sdk.createGateway).not.toHaveBeenCalled()
  })

  it('surfaces SDK errors and resets loading', async () => {
    sdk.generateText.mockRejectedValue(new Error('Gateway request aborted by provider'))
    const api = useVercelAI()

    await expect(api.generateImage('a cat', config())).rejects.toThrow('Gateway request aborted by provider')
    expect(api.error.value).toBe('Gateway request aborted by provider')
    expect(api.loading.value).toBe(false)
  })

  it('reports cancel() as a cancellation', async () => {
    sdk.generateText.mockImplementation(({ abortSignal }) => waitForAbort(abortSignal, new Error('Request failed')))
    const api = useVercelAI()

    const pending = api.generateImage('a cat', config())
    expect(api.loading.value).toBe(true)
    api.cancel()

    await expect(pending).rejects.toThrow(en.generationCancelled)
    expect(api.loading.value).toBe(false)
    expect(api.error.value).toBeNull()
  })

  it('passes an external signal to the image SDK', async () => {
    sdk.generateImage.mockImplementation(({ abortSignal }) => waitForAbort(abortSignal))
    const controller = new AbortController()
    const api = useVercelAI()

    const pending = api.generateImage('a logo', config({ model: GPT_IMAGE_2_5_FLARE_MODEL }), controller.signal)
    expect(api.loading.value).toBe(false)
    await vi.waitFor(() => expect(sdk.generateImage).toHaveBeenCalled())
    controller.abort()

    await expect(pending).rejects.toThrow(en.generationCancelled)
    expect(sdk.generateImage.mock.calls[0][0].abortSignal).toBe(controller.signal)
  })
})
