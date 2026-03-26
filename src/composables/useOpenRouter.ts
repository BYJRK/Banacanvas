import { ref } from 'vue'
import { useApiKeyStore } from '../stores/apiKey'
import type { GenerationConfig, GenerationResult, InputImage, UsageInfo } from '../types'
import { getBaseModelId, MODEL_PRICING, toOpenRouterImageSize } from '../config/models'
import { useI18n } from './useI18n'

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

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
  ): Promise<GenerationResult> {
    const apiKey = apiKeyStore.getKey('openrouter')
    if (!apiKey) throw new Error(t('apiKeyNotSet'))

    loading.value = true
    error.value = null
    abortController = new AbortController()

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: Record<string, any> = {
        model: config.model,
        messages,
        modalities: ['image', 'text'],
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
        signal: abortController.signal,
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
      error.value = msg
      throw new Error(msg)
    } finally {
      loading.value = false
      abortController = null
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
      const dataUrl: string = message.images[0].image_url?.url ?? ''
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

  async function generateImage(
    prompt: string,
    config: GenerationConfig,
  ): Promise<GenerationResult> {
    const messages = [
      {
        role: 'user',
        content: prompt,
      },
    ]
    return doRequest(messages, config)
  }

  async function editImage(
    images: InputImage[],
    prompt: string,
    config: GenerationConfig,
  ): Promise<GenerationResult> {
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
    return doRequest(messages, config)
  }

  return { loading, error, generateImage, editImage, cancel }
}
