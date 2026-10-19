import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useOpenRouter } from '../../src/composables/useOpenRouter'
import {
  GEMINI_FLASH_IMAGE_MODEL,
  GPT_IMAGE_2_5_FLARE_MODEL,
  GROK_IMAGE_2_MODEL,
  GROK_IMAGE_MODEL,
  MAI_IMAGE_2_6_MODEL,
  MUSE_IMAGE_MODEL,
  RIVERFLOW_V2_5_FAST_MODEL,
  SEEDREAM_5_0_LITE_MODEL,
} from '../../src/config/models'
import type { GenerationConfig } from '../../src/types'
import { IMAGE_B64, en, inputImage, jsonResponse, waitForAbort } from '../helpers'

const CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions'
const IMAGES_URL = 'https://openrouter.ai/api/v1/images'
const fetchMock = vi.fn<typeof fetch>()

function config(overrides: Partial<GenerationConfig> = {}): GenerationConfig {
  return { provider: 'openrouter', model: `google/${GEMINI_FLASH_IMAGE_MODEL}`, ...overrides }
}

function lastRequest() {
  const [url, init] = fetchMock.mock.calls.at(-1)!
  return { url: String(url), init: init!, body: JSON.parse(init!.body as string) }
}

function chatResponse(message: Record<string, unknown>, usage?: Record<string, unknown>) {
  return jsonResponse({ choices: [{ message }], ...(usage && { usage }) })
}

beforeEach(() => {
  localStorage.setItem('banacanvas-openrouter-key', 'or-key')
  setActivePinia(createPinia())
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

describe('chat completions models', () => {
  it('sends a text prompt with image config and auth', async () => {
    fetchMock.mockResolvedValue(chatResponse({ images: [{ image_url: { url: `data:image/png;base64,${IMAGE_B64}` } }] }))

    await useOpenRouter().generateImage('a cat', config({ aspectRatio: '16:9', imageSize: '512' }))

    const { url, init, body } = lastRequest()
    expect(url).toBe(CHAT_URL)
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toMatch(/^Bearer /)
    expect(headers.Authorization).toContain('or-key')
    expect(body).toEqual({
      model: `google/${GEMINI_FLASH_IMAGE_MODEL}`,
      messages: [{ role: 'user', content: 'a cat' }],
      modalities: ['image', 'text'],
      stream: false,
      image_config: { aspect_ratio: '16:9', image_size: '0.5K' },
    })
  })

  it('omits modalities for models that reject them', async () => {
    fetchMock.mockResolvedValue(chatResponse({ images: [{ image_url: { url: `data:image/png;base64,${IMAGE_B64}` } }] }))

    await useOpenRouter().generateImage('a cat', config({ model: GROK_IMAGE_MODEL }))

    expect(lastRequest().body).not.toHaveProperty('modalities')
  })

  it('sends reference images before the prompt when editing', async () => {
    fetchMock.mockResolvedValue(chatResponse({ images: [{ image_url: { url: `data:image/png;base64,${IMAGE_B64}` } }] }))
    const images = [inputImage(0), inputImage(1, 'image/webp')]

    await useOpenRouter().editImage(images, 'make it blue', config())

    expect(lastRequest().body.messages[0].content).toEqual([
      { type: 'image_url', image_url: { url: `data:image/png;base64,${images[0].base64}` } },
      { type: 'image_url', image_url: { url: `data:image/webp;base64,${images[1].base64}` } },
      { type: 'text', text: 'make it blue' },
    ])
  })

  it('returns the last (final) image, text and exact billed cost', async () => {
    fetchMock.mockResolvedValue(chatResponse(
      {
        content: 'Here you go',
        images: [
          { image_url: { url: 'data:image/png;base64,aW50ZXJpbQ==' } },
          { image_url: { url: `data:image/webp;base64,${IMAGE_B64}` } },
        ],
      },
      { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30, cost: 0.0421 },
    ))

    const result = await useOpenRouter().generateImage('a cat', config())

    expect(result).toEqual({
      imageBase64: IMAGE_B64,
      imageMimeType: 'image/webp',
      textResponse: 'Here you go',
      usage: {
        promptTokenCount: 10,
        candidatesTokenCount: 20,
        thoughtsTokenCount: 0,
        totalTokenCount: 30,
        estimatedCost: 0.0421,
        costIsExact: true,
      },
    })
  })

  it('estimates cost from tokens when no billed cost is returned', async () => {
    fetchMock.mockResolvedValue(chatResponse(
      { images: [{ image_url: { url: `data:image/png;base64,${IMAGE_B64}` } }] },
      { prompt_tokens: 1000, completion_tokens: 1120, total_tokens: 2120 },
    ))

    const { usage } = await useOpenRouter().generateImage('a cat', config())

    // 1000 input tokens at $0.50/M + 1120 image tokens at $60/M
    expect(usage?.estimatedCost).toBeCloseTo(0.0677, 9)
    expect(usage?.costIsExact).toBe(false)
  })

  it('throws when no image is returned', async () => {
    fetchMock.mockResolvedValue(chatResponse({ content: 'I cannot draw that' }))
    const api = useOpenRouter()

    await expect(api.generateImage('a cat', config())).rejects.toThrow(en.noImageGenerated)
    expect(api.error.value).toBe(en.noImageGenerated)
  })
})

describe('image API models', () => {
  const imageResponse = (usage?: Record<string, unknown>) =>
    jsonResponse({ data: [{ b64_json: IMAGE_B64, media_type: 'image/png' }], ...(usage && { usage }) })

  it('sends GPT Image quality and background without a resolution', async () => {
    fetchMock.mockResolvedValue(imageResponse({ cost: 0.05 }))

    const result = await useOpenRouter().generateImage('a logo', config({
      model: GPT_IMAGE_2_5_FLARE_MODEL,
      aspectRatio: '3:2',
      imageSize: '1K',
      imageQuality: 'max',
      imageBackground: 'transparent',
    }))

    const { url, body } = lastRequest()
    expect(url).toBe(IMAGES_URL)
    expect(body).toEqual({
      model: GPT_IMAGE_2_5_FLARE_MODEL,
      prompt: 'a logo',
      aspect_ratio: '3:2',
      n: 1,
      quality: 'max',
      background: 'transparent',
    })
    expect(result.usage).toMatchObject({ estimatedCost: 0.05, costIsExact: true })
  })

  it('estimates GPT Image cost from tokens without input images', async () => {
    fetchMock.mockResolvedValue(imageResponse({ prompt_tokens: 100, completion_tokens: 1000 }))

    const { usage } = await useOpenRouter().generateImage('a logo', config({ model: GPT_IMAGE_2_5_FLARE_MODEL }))

    // 100 text tokens at $5/M + 1000 output tokens at $30/M
    expect(usage?.estimatedCost).toBeCloseTo(0.0305, 9)
    expect(usage?.totalTokenCount).toBe(1100)
    expect(usage?.costIsExact).toBe(false)
  })

  it('sends resolution, integer seeds and reference images for Seedream Lite', async () => {
    fetchMock.mockResolvedValue(imageResponse())
    const images = [inputImage(0)]

    await useOpenRouter().editImage(images, 'restyle', config({ model: SEEDREAM_5_0_LITE_MODEL, imageSize: '4K', aspectRatio: '1:1', seed: 42 }))

    expect(lastRequest().body).toEqual({
      model: SEEDREAM_5_0_LITE_MODEL,
      prompt: 'restyle',
      resolution: '4K',
      aspect_ratio: '1:1',
      n: 1,
      seed: 42,
      input_references: [{ type: 'image_url', image_url: { url: `data:image/png;base64,${images[0].base64}` } }],
    })
  })

  it('drops non-integer seeds', async () => {
    fetchMock.mockResolvedValue(imageResponse())

    await useOpenRouter().generateImage('a cat', config({ model: SEEDREAM_5_0_LITE_MODEL, seed: 1.5 }))

    expect(lastRequest().body).not.toHaveProperty('seed')
  })

  it('passes MAI web grounding through the Azure provider options', async () => {
    fetchMock.mockResolvedValue(imageResponse())

    await useOpenRouter().generateImage('news photo', config({ model: MAI_IMAGE_2_6_MODEL, aspectRatio: '4:3', webGrounding: true }))

    const { body } = lastRequest()
    expect(body.provider).toEqual({ options: { azure: { web_grounding: true } } })
    expect(body.aspect_ratio).toBe('4:3')
    expect(body).not.toHaveProperty('resolution')
  })

  it('sends no size controls for Muse and falls back to its flat price', async () => {
    fetchMock.mockResolvedValue(imageResponse())

    const { usage } = await useOpenRouter().generateImage('a cat', config({ model: MUSE_IMAGE_MODEL, aspectRatio: '16:9', imageSize: '2K' }))

    expect(lastRequest().body).toEqual({ model: MUSE_IMAGE_MODEL, prompt: 'a cat' })
    expect(usage?.estimatedCost).toBeCloseTo(0.01, 9)
  })

  it('rejects too many reference images without sending a request', async () => {
    const images = [0, 1, 2, 3].map((i) => inputImage(i))

    await expect(useOpenRouter().editImage(images, 'edit', config({ model: GROK_IMAGE_2_MODEL })))
      .rejects.toThrow(en.referenceImagesLimitReached.replace('{count}', '3'))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects Riverflow requests over 4.5 MB without sending them', async () => {
    const huge = { id: 'big', mimeType: 'image/png', base64: 'A'.repeat(5 * 1024 * 1024) }

    await expect(useOpenRouter().editImage([huge], 'edit', config({ model: RIVERFLOW_V2_5_FAST_MODEL })))
      .rejects.toThrow(en.sourcefulRequestTooLarge)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws when the response has no image', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [] }))

    await expect(useOpenRouter().generateImage('a cat', config({ model: MUSE_IMAGE_MODEL })))
      .rejects.toThrow(en.noImageGenerated)
  })
})

describe('errors and cancellation', () => {
  it('requires an API key', async () => {
    localStorage.removeItem('banacanvas-openrouter-key')
    setActivePinia(createPinia())

    await expect(useOpenRouter().generateImage('a cat', config())).rejects.toThrow(en.apiKeyNotSet)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('surfaces the API error message and resets loading', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: { message: 'Invalid API key' } }, 401))
    const api = useOpenRouter()

    await expect(api.generateImage('a cat', config())).rejects.toThrow('Invalid API key')
    expect(api.error.value).toBe('Invalid API key')
    expect(api.loading.value).toBe(false)
  })

  it('falls back to the HTTP status for non-JSON errors', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 }))

    await expect(useOpenRouter().generateImage('a cat', config())).rejects.toThrow('HTTP 502')
  })

  it('does not mistake server errors mentioning "abort" for cancellation', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: { message: 'Upstream aborted the job' } }, 500))

    await expect(useOpenRouter().generateImage('a cat', config())).rejects.toThrow('Upstream aborted the job')
  })

  it('reports cancel() as a cancellation and clears state', async () => {
    fetchMock.mockImplementation((_url, init) => waitForAbort(init?.signal))
    const api = useOpenRouter()

    const pending = api.generateImage('a cat', config())
    expect(api.loading.value).toBe(true)
    api.cancel()

    await expect(pending).rejects.toThrow(en.generationCancelled)
    expect(api.loading.value).toBe(false)
    expect(api.error.value).toBeNull()
  })

  it('detects cancellation even when the abort error is wrapped', async () => {
    fetchMock.mockImplementation((_url, init) => waitForAbort(init?.signal, new TypeError('Failed to fetch')))
    const api = useOpenRouter()

    const pending = api.generateImage('a logo', config({ model: GPT_IMAGE_2_5_FLARE_MODEL }))
    api.cancel()

    await expect(pending).rejects.toThrow(en.generationCancelled)
  })

  it('uses an external signal without touching shared loading state', async () => {
    fetchMock.mockImplementation((_url, init) => waitForAbort(init?.signal))
    const api = useOpenRouter()
    const controller = new AbortController()

    const pending = api.generateImage('a cat', config(), controller.signal)
    expect(api.loading.value).toBe(false)
    controller.abort()

    await expect(pending).rejects.toThrow(en.generationCancelled)
    expect(lastRequest().init.signal).toBe(controller.signal)
  })
})
