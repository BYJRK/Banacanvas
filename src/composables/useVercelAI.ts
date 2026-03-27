import { ref } from 'vue'
import { useApiKeyStore } from '../stores/apiKey'
import type { GenerationConfig, GenerationResult, InputImage, UsageInfo } from '../types'
import { getBaseModelId, MODEL_PRICING, toOpenRouterImageSize } from '../config/models'
import { useI18n } from './useI18n'

const VERCEL_AI_GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1/chat/completions'

export function useVercelAI() {
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

  async function doRequest(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: any[],
    config: GenerationConfig,
  ): Promise<GenerationResult> {
    const apiKey = apiKeyStore.getKey('vercel')
    if (!apiKey) throw new Error(t('apiKeyNotSet'))

    loading.value = true
    error.value = null
    abortController = new AbortController()

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: Record<string, any> = {
        model: config.model,
        messages,
        modalities: ['text', 'image'],
        stream: false,
      }

      // Pass Google-specific image config via providerOptions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const imageConfig: Record<string, string> = {}
      if (config.aspectRatio) imageConfig.aspectRatio = config.aspectRatio
      if (config.imageSize) imageConfig.imageSize = toOpenRouterImageSize(config.imageSize)
      if (Object.keys(imageConfig).length > 0) {
        body.providerOptions = {
          google: { imageConfig },
        }
      }

      const response = await fetch(VERCEL_AI_GATEWAY_URL, {
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

    // Vercel AI Gateway returns images in message.images array as data URLs
    if (message.images?.length > 0) {
      const dataUrl: string = message.images[0].image_url?.url ?? ''
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
