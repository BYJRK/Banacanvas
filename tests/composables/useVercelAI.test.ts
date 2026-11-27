import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useVercelAI } from '../../src/composables/useVercelAI'
import {
  MINIMAX_H3_IMAGE_MODEL,
  MUSE_IMAGE_VERCEL_MODEL,
  RECRAFT_V4_1_FLASH_V2_MODEL,
  GEMINI_PRO_IMAGE_MODEL,
  GPT_IMAGE_2_5_FLARE_MODEL,
  GPT_IMAGE_2_5_SUNBURST_MODEL,
  GPT_IMAGE_2_6_FLARE_MODEL,
  GPT_IMAGE_2_6_SUNBURST_MODEL,
  MAI_IMAGE_2_6_MODEL,
  MAI_IMAGE_2_7_MODEL,
} from '../../src/config/models'
import type { GenerationConfig } from '../../src/types'
import { IMAGE_B64, en, inputImage, waitForAbort } from '../helpers'

const sdk = vi.hoisted(() => ({
  createGateway: vi.fn(),
  generateText: vi.fn(),
  generateImage: vi.fn(),
}))

const GPT_IMAGE_MODELS = [GPT_IMAGE_2_5_FLARE_MODEL, GPT_IMAGE_2_5_SUNBURST_MODEL, GPT_IMAGE_2_6_FLARE_MODEL, GPT_IMAGE_2_6_SUNBURST_MODEL]

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
  it.each(GPT_IMAGE_MODELS)('sends %s size and OpenAI options', async (model) => {
    sdk.generateImage.mockResolvedValue(imageResult({ providerMetadata: { openai: { images: [{ imageTokens: 0 }] } } }))

    const result = await useVercelAI().generateImage('a logo', config({
      model,
      aspectRatio: '16:9',
      imageSize: '2K',
    }))

    const args = sdk.generateImage.mock.calls[0][0]
    expect(args.model).toEqual({ kind: 'image', id: model })
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

  it('sends a transparent background and 2K size only for MAI-Image-2.7', async () => {
    sdk.generateImage.mockResolvedValue(imageResult({ usage: { inputTokens: 100, outputTokens: 4096, totalTokens: 4196 } }))

    const result = await useVercelAI().generateImage('a sticker', config({
      model: MAI_IMAGE_2_7_MODEL, aspectRatio: '1:1', imageSize: '2K', imageBackground: 'transparent',
    }))

    const args = sdk.generateImage.mock.calls[0][0]
    expect(args.size).toBe('2048x2048')
    expect(args.providerOptions).toEqual({ azure: { autoAspectRatio: false, webGrounding: false, background: 'transparent' } })
    // 100 input at $5/M + 4096 output at $34/M
    expect(result.usage?.estimatedCost).toBeCloseTo(0.000_5 + 0.139264, 9)

    sdk.generateImage.mockClear()
    await useVercelAI().generateImage('a sticker', config({ model: MAI_IMAGE_2_6_MODEL, imageBackground: 'transparent' }))
    expect(sdk.generateImage.mock.calls[0][0].providerOptions).toEqual({ azure: { autoAspectRatio: false, webGrounding: false } })
  })

  it.each(GPT_IMAGE_MODELS)('bills %s input at the image rate when per-image token metadata is missing', async (model) => {
    sdk.generateImage.mockResolvedValue(imageResult())

    const result = await useVercelAI().editImage([inputImage()], 'edit', config({ model }))

    // 100 input at $8/M + 1000 output at $30/M
    expect(result.usage?.estimatedCost).toBeCloseTo(0.0308, 9)
  })

  describe.each([GPT_IMAGE_2_6_FLARE_MODEL, GPT_IMAGE_2_6_SUNBURST_MODEL])('%s editing', (model) => {
    it('sends references and OpenAI options with auto sizing and itemized input cost', async () => {
      sdk.generateImage.mockResolvedValue(imageResult({
        usage: { inputTokens: 1000, outputTokens: 2000 },
        providerMetadata: { openai: { images: [{ imageTokens: 400 }] } },
      }))
      const images = Array.from({ length: 16 }, (_, i) => inputImage(i))

      const result = await useVercelAI().editImage(images, 'restyle', config({
        model, aspectRatio: 'auto', imageSize: '4K', imageQuality: 'max', imageBackground: 'transparent',
      }))

      const args = sdk.generateImage.mock.calls[0][0]
      expect(args.model).toEqual({ kind: 'image', id: model })
      expect(args.prompt).toEqual({ text: 'restyle', images: images.map((image) => `data:${image.mimeType};base64,${image.base64}`) })
      expect(args.size).toBeUndefined()
      expect(args.providerOptions).toEqual({ openai: { quality: 'max', background: 'transparent', outputFormat: 'png' } })
      expect(sdk.generateText).not.toHaveBeenCalled()
      expect(result.imageBase64).toBe(IMAGE_B64)
      expect(result.usage?.estimatedCost).toBeCloseTo(0.0662, 9)
    })

    it('rejects more than 16 references without calling the SDK', async () => {
      const images = Array.from({ length: 17 }, (_, i) => inputImage(i))
      await expect(useVercelAI().editImage(images, 'edit', config({ model })))
        .rejects.toThrow(en.referenceImagesLimitReached.replace('{count}', '16'))
      expect(sdk.generateImage).not.toHaveBeenCalled()
    })
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


describe('MiniMax text-to-image', () => {
  it.each([['1K', '1376x768'], ['2K', '2720x1536'], ['4K', '5472x3072']] as const)('sends %s dimensions with MiniMax options and no automatic retries', async (imageSize, size) => {
    sdk.generateImage.mockResolvedValue(imageResult({ usage: { inputTokens: 1000, outputTokens: 2000 } }))
    const result = await useVercelAI().generateImage('a cat', config({
      model: MINIMAX_H3_IMAGE_MODEL, imageSize, aspectRatio: '16:9',
      imageQuality: 'max', imageBackground: 'transparent', googleSearch: true,
    }))
    const args = sdk.generateImage.mock.calls[0][0]
    expect(args).toMatchObject({
      model: { kind: 'image', id: MINIMAX_H3_IMAGE_MODEL }, prompt: 'a cat', size,
      n: 1, maxRetries: 0, providerOptions: { minimax: { outputFormat: 'png' } },
    })
    expect(args.abortSignal).toBeInstanceOf(AbortSignal)
    expect(sdk.generateText).not.toHaveBeenCalled()
    expect(result.imageBase64).toBe(IMAGE_B64)
    expect(result.usage?.estimatedCost).toBeCloseTo(0.0099, 9)
    expect(result.usage?.totalTokenCount).toBe(3000)
  })

  it('uses square 1K defaults and reference pricing if output usage is unavailable', async () => {
    sdk.generateImage.mockResolvedValue(imageResult({ usage: {} }))
    const result = await useVercelAI().generateImage('a cat', config({ model: MINIMAX_H3_IMAGE_MODEL }))
    expect(sdk.generateImage.mock.calls[0][0].size).toBe('1024x1024')
    expect(result.usage?.estimatedCost).toBeCloseTo(0.02179, 9)
  })

  it('passes the batch signal through and handles cancellation', async () => {
    sdk.generateImage.mockImplementation(({ abortSignal }) => waitForAbort(abortSignal))
    const api = useVercelAI()
    const controller = new AbortController()
    const pending = api.generateImage('a cat', config({ model: MINIMAX_H3_IMAGE_MODEL }), controller.signal)
    await vi.waitFor(() => expect(sdk.generateImage).toHaveBeenCalled())
    expect(sdk.generateImage.mock.calls[0][0].abortSignal).toBe(controller.signal)
    expect(api.loading.value).toBe(false)
    controller.abort()
    await expect(pending).rejects.toThrow(en.generationCancelled)
  })
})

describe('Recraft V4.1 Flash V2 text-to-image', () => {
  it('sends aspectRatio without size via gateway.imageModel and uses flat $0.007 pricing', async () => {
    sdk.generateImage.mockResolvedValue(imageResult({ usage: {} }))
    const result = await useVercelAI().generateImage('a cat', config({
      model: RECRAFT_V4_1_FLASH_V2_MODEL, aspectRatio: '16:9', imageSize: '1K',
    }))
    const args = sdk.generateImage.mock.calls[0][0]
    expect(args).toMatchObject({
      model: { kind: 'image', id: RECRAFT_V4_1_FLASH_V2_MODEL }, prompt: 'a cat', aspectRatio: '16:9', n: 1,
    })
    expect(args.size).toBeUndefined()
    expect(result.usage?.estimatedCost).toBeCloseTo(0.007, 9)
  })

  it('omits aspectRatio when set to auto and rejects reference images', async () => {
    sdk.generateImage.mockResolvedValue(imageResult({ usage: {} }))
    await useVercelAI().generateImage('a cat', config({ model: RECRAFT_V4_1_FLASH_V2_MODEL, aspectRatio: 'auto' }))
    expect(sdk.generateImage.mock.calls[0][0].aspectRatio).toBeUndefined()

    await expect(useVercelAI().editImage([inputImage()], 'edit', config({ model: RECRAFT_V4_1_FLASH_V2_MODEL })))
      .rejects.toThrow(en.referenceImagesLimitReached.replace('{count}', '0'))
  })
})

describe('Muse Image text-to-image and editing', () => {
  it('calls gateway.imageModel without size/aspectRatio and uses flat $0.01 pricing', async () => {
    sdk.generateImage.mockResolvedValue(imageResult({ usage: {} }))
    const result = await useVercelAI().generateImage('a cat', config({
      model: MUSE_IMAGE_VERCEL_MODEL, aspectRatio: '16:9', imageSize: '2K',
    }))
    const args = sdk.generateImage.mock.calls[0][0]
    expect(args).toMatchObject({
      model: { kind: 'image', id: MUSE_IMAGE_VERCEL_MODEL }, prompt: 'a cat', n: 1,
    })
    expect(args.size).toBeUndefined()
    expect(args.aspectRatio).toBeUndefined()
    expect(result.usage?.estimatedCost).toBeCloseTo(0.01, 9)
  })

  it('passes up to 4 reference images and rejects more than 4', async () => {
    sdk.generateImage.mockResolvedValue(imageResult({ usage: {} }))
    const img = inputImage()
    await useVercelAI().editImage([img, img], 'blend', config({ model: MUSE_IMAGE_VERCEL_MODEL }))
    expect(sdk.generateImage.mock.calls[0][0].prompt).toEqual({
      text: 'blend',
      images: [`data:${img.mimeType};base64,${img.base64}`, `data:${img.mimeType};base64,${img.base64}`],
    })

    await expect(useVercelAI().editImage([img, img, img, img, img], 'blend', config({ model: MUSE_IMAGE_VERCEL_MODEL })))
      .rejects.toThrow(en.referenceImagesLimitReached.replace('{count}', '4'))
  })
})
