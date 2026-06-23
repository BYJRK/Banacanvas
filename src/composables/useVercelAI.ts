import { ref } from 'vue'
import { generateText, createGateway } from 'ai'
import type { ModelMessage } from 'ai'
import { useApiKeyStore } from '../stores/apiKey'
import type { GenerationConfig, GenerationResult, InputImage, UsageInfo } from '../types'
import { getBaseModelId, MODEL_PRICING } from '../config/models'
import { useI18n } from './useI18n'

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
    messages: ModelMessage[],
    config: GenerationConfig,
    externalSignal?: AbortSignal,
  ): Promise<GenerationResult> {
    const apiKey = apiKeyStore.getKey('vercel')
    if (!apiKey) throw new Error(t('apiKeyNotSet'))

    const managed = !externalSignal
    if (managed) {
      loading.value = true
      error.value = null
      abortController = new AbortController()
    }

    try {
      const gateway = createGateway({ apiKey })

      // Google-specific image config (aspect ratio + resolution)
      const imageConfig: Record<string, string> = {}
      if (config.aspectRatio) imageConfig.aspectRatio = config.aspectRatio
      if (config.imageSize) imageConfig.imageSize = config.imageSize

      const result = await generateText({
        model: gateway(config.model),
        messages,
        providerOptions: {
          google: {
            responseModalities: ['TEXT', 'IMAGE'],
            ...(Object.keys(imageConfig).length > 0 ? { imageConfig } : {}),
          },
        },
        abortSignal: externalSignal ?? abortController!.signal,
      })

      return parseResult(result, config.model)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.toLowerCase().includes('abort')) {
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

  function parseResult(
    result: Awaited<ReturnType<typeof generateText>>,
    modelId: string,
  ): GenerationResult {
    const imageFile = result.files.find((f) => f.mediaType?.startsWith('image/'))
    if (!imageFile) {
      throw new Error(t('noImageGenerated'))
    }

    const imageBase64 = imageFile.base64
    const imageMimeType = imageFile.mediaType || 'image/png'

    // Build usage info
    let usage: UsageInfo | undefined
    if (result.usage) {
      const promptTokens = result.usage.inputTokens ?? 0
      const completionTokens = result.usage.outputTokens ?? 0
      const totalTokens = result.usage.totalTokens ?? promptTokens + completionTokens

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
      textResponse: result.text || undefined,
      usage,
    }
  }

  async function generateImage(
    prompt: string,
    config: GenerationConfig,
    externalSignal?: AbortSignal,
  ): Promise<GenerationResult> {
    const messages: ModelMessage[] = [
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
    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: [
          ...images.map((img) => ({
            type: 'image' as const,
            image: `data:${img.mimeType};base64,${img.base64}`,
          })),
          { type: 'text' as const, text: prompt },
        ],
      },
    ]
    return doRequest(messages, config, externalSignal)
  }

  return { loading, error, generateImage, editImage, cancel }
}
