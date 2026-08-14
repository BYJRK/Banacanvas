import { ref } from 'vue'
import { useApiKeyStore } from '../stores/apiKey'
import type { GenerationConfig, GenerationResult, InputImage, UsageInfo } from '../types'
import {
  estimateImageOutputCost,
  getBaseModelId,
  getImageSizes,
  getMaxInputImages,
  isRiverflowModel,
  MODEL_PRICING,
  toOpenRouterImageSize,
  supportsOutputModalities,
  supportsImageQuality,
  supportsSeedParameter,
  usesOpenRouterImageApi,
} from '../config/models'
import { useI18n } from './useI18n'

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_IMAGES_API_URL = 'https://openrouter.ai/api/v1/images'
const SOURCEFUL_MAX_REQUEST_BYTES = 4.5 * 1024 * 1024

export function useOpenRouter() {
  const apiKeyStore = useApiKeyStore()
  const loading = ref(false)
  const error = ref<string | null>(null)
  let abortController: AbortController | null = null
  const { t } = useI18n()

  function cancel() {
    abortController?.abort()
    abortController = null
    loading.value = false
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function buildImageConfig(config: GenerationConfig): Record<string, string> | undefined {
    const imageConfig: Record<string, string> = {}
    if (config.aspectRatio) imageConfig.aspect_ratio = config.aspectRatio
    if (config.imageSize) imageConfig.image_size = toOpenRouterImageSize(config.imageSize)
    return Object.keys(imageConfig).length > 0 ? imageConfig : undefined
  }

  async function doRequest(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: any[],
    config: GenerationConfig,
    externalSignal?: AbortSignal,
  ): Promise<GenerationResult> {
    const apiKey = apiKeyStore.getKey('openrouter')
    if (!apiKey) throw new Error(t('apiKeyNotSet'))

    const managed = !externalSignal
    if (managed) {
      loading.value = true
      error.value = null
      abortController = new AbortController()
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: Record<string, any> = {
        model: config.model,
        messages,
        ...(supportsOutputModalities(config.model) && { modalities: ['image', 'text'] }),
        stream: false,
      }

      const imageConfig = buildImageConfig(config)
      if (imageConfig) body.image_config = imageConfig

      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: externalSignal ?? abortController!.signal,
      })

      if (!response.ok) {
        const errBody = await response.json().catch(() => null)
        const errMsg = errBody?.error?.message ?? `HTTP ${response.status}`
        throw new Error(errMsg)
      }

      const result = await response.json()
      return parseResponse(result, config.model)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('abort')) {
        throw new Error(t('generationCancelled'))
      }
      if (managed) error.value = msg
      throw new Error(msg)
    } finally {
      if (managed) {
        loading.value = false
        abortController = null
      }
    }
  }

  async function doImageRequest(
    prompt: string,
    images: InputImage[],
    config: GenerationConfig,
    externalSignal?: AbortSignal,
  ): Promise<GenerationResult> {
    const apiKey = apiKeyStore.getKey('openrouter')
    if (!apiKey) throw new Error(t('apiKeyNotSet'))

    const managed = !externalSignal
    if (managed) {
      loading.value = true
      error.value = null
      abortController = new AbortController()
    }

    try {
      const maxImages = getMaxInputImages(config.model)
      if (images.length > maxImages) {
        throw new Error(t('referenceImagesLimitReached').replace('{count}', String(maxImages)))
      }

      const body: Record<string, unknown> = {
        model: config.model,
        prompt,
        resolution: config.imageSize ?? getImageSizes(config.model)[0].value,
        aspect_ratio: config.aspectRatio ?? '1:1',
      }
      if (supportsImageQuality(config.model)) {
        body.n = 1
        body.quality = config.imageQuality ?? 'medium'
      }
      if (supportsSeedParameter(config.model)) {
        body.n = 1
        if (Number.isSafeInteger(config.seed)) body.seed = config.seed
      }
      if (images.length > 0) {
        body.input_references = images.map((image) => ({
          type: 'image_url',
          image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
        }))
      }

      const requestBody = JSON.stringify(body)
      // Sourceful accepts at most a 4.5 MB request, including base64 reference images.
      if (isRiverflowModel(config.model) && new Blob([requestBody]).size > SOURCEFUL_MAX_REQUEST_BYTES) {
        throw new Error(t('sourcefulRequestTooLarge'))
      }

      const response = await fetch(OPENROUTER_IMAGES_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: requestBody,
        signal: externalSignal ?? abortController!.signal,
      })

      if (!response.ok) {
        const errBody = await response.json().catch(() => null)
        const errMsg = errBody?.error?.message ?? `HTTP ${response.status}`
        throw new Error(errMsg)
      }

      return parseImageApiResponse(await response.json(), config)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('abort')) {
        throw new Error(t('generationCancelled'))
      }
      if (managed) error.value = msg
      throw new Error(msg)
    } finally {
      if (managed) {
        loading.value = false
        abortController = null
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function parseResponse(result: any, modelId: string): GenerationResult {
    const choice = result.choices?.[0]
    if (!choice?.message) {
      throw new Error(t('noImageGenerated'))
    }

    const message = choice.message
    let imageBase64 = ''
    let imageMimeType = 'image/png'

    if (message.images?.length > 0) {
      // Gemini 3 image models "think" before rendering and may emit interim
      // lower-resolution images; the last image is always the final, full-res
      // render. Pick the last entry instead of the first.
      // Docs: https://ai.google.dev/gemini-api/docs/image-generation (Thinking Process)
      const lastImage = message.images[message.images.length - 1]
      const dataUrl: string = lastImage.image_url?.url ?? ''
      // Parse data URL: "data:image/png;base64,iVBOR..."
      const match = dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/)
      if (match) {
        imageMimeType = match[1]
        imageBase64 = match[2]
      }
    }

    if (!imageBase64) {
      throw new Error(t('noImageGenerated'))
    }

    // Build usage info
    let usage: UsageInfo | undefined
    if (result.usage) {
      const promptTokens = result.usage.prompt_tokens ?? 0
      const completionTokens = result.usage.completion_tokens ?? 0
      const totalTokens = result.usage.total_tokens ?? 0

      // Approximate cost using base model pricing
      // OpenRouter doesn't break down image vs text tokens, so treat all completion as image
      const baseModelId = getBaseModelId(modelId)
      const pricing = MODEL_PRICING[baseModelId]
      let estimatedCost = 0
      if (pricing) {
        estimatedCost += (promptTokens / 1_000_000) * pricing.inputText
        estimatedCost += (completionTokens / 1_000_000) * pricing.outputImage
      }

      usage = {
        promptTokenCount: promptTokens,
        candidatesTokenCount: completionTokens,
        thoughtsTokenCount: 0,
        totalTokenCount: totalTokens,
        estimatedCost,
      }
    }

    return {
      imageBase64,
      imageMimeType,
      textResponse: message.content || undefined,
      usage,
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function parseImageApiResponse(result: any, config: GenerationConfig): GenerationResult {
    const image = result.data?.[0]
    if (!image?.b64_json) {
      throw new Error(t('noImageGenerated'))
    }

    const responseCost = Number(result.usage?.cost)
    const hasExactCost = Number.isFinite(responseCost)
    const promptTokens = result.usage?.prompt_tokens ?? 0
    const completionTokens = result.usage?.completion_tokens ?? 0
    const totalTokens = result.usage?.total_tokens ?? promptTokens + completionTokens

    return {
      imageBase64: image.b64_json,
      imageMimeType: image.media_type ?? 'image/png',
      usage: {
        promptTokenCount: promptTokens,
        candidatesTokenCount: completionTokens,
        thoughtsTokenCount: 0,
        totalTokenCount: totalTokens,
        estimatedCost: hasExactCost
          ? responseCost
          : estimateImageOutputCost(config.model, config.imageSize ?? '1K', 1, config.imageQuality ?? 'medium'),
        costIsExact: hasExactCost,
      },
    }
  }

  async function generateImage(
    prompt: string,
    config: GenerationConfig,
    externalSignal?: AbortSignal,
  ): Promise<GenerationResult> {
    if (usesOpenRouterImageApi(config.model)) {
      return doImageRequest(prompt, [], config, externalSignal)
    }

    const messages = [
      {
        role: 'user',
        content: prompt,
      },
    ]
    return doRequest(messages, config, externalSignal)
  }

  async function editImage(
    images: InputImage[],
    prompt: string,
    config: GenerationConfig,
    externalSignal?: AbortSignal,
  ): Promise<GenerationResult> {
    if (usesOpenRouterImageApi(config.model)) {
      return doImageRequest(prompt, images, config, externalSignal)
    }

    // Build multimodal content array in OpenAI vision format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any[] = images.map((img) => ({
      type: 'image_url',
      image_url: {
        url: `data:${img.mimeType};base64,${img.base64}`,
      },
    }))
    content.push({ type: 'text', text: prompt })

    const messages = [
      {
        role: 'user',
        content,
      },
    ]
    return doRequest(messages, config, externalSignal)
  }

  return { loading, error, generateImage, editImage, cancel }
}
