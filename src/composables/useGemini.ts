import { ref, watch } from 'vue'
import { GoogleGenAI } from '@google/genai'
import { useApiKeyStore } from '../stores/apiKey'
import type { GenerationConfig, GenerationResult, InputImage, UsageInfo } from '../types'
import { MODEL_PRICING } from '../config/models'
import { useI18n } from './useI18n'

export function useGemini() {
  const apiKeyStore = useApiKeyStore()
  const loading = ref(false)
  const error = ref<string | null>(null)
  let abortController: AbortController | null = null
  let client: GoogleGenAI | null = null
  const { t } = useI18n()

  watch(
    () => apiKeyStore.geminiKey,
    (key) => {
      client = key ? new GoogleGenAI({ apiKey: key }) : null
    },
    { immediate: true },
  )

  function cancel() {
    abortController?.abort()
    abortController = null
    loading.value = false
  }

  function buildApiConfig(config: GenerationConfig) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apiConfig: Record<string, any> = {
      responseModalities: ['IMAGE', 'TEXT'],
    }

    // Thinking config
    if (config.thinkingLevel) {
      apiConfig.thinkingConfig = {
        thinkingLevel: config.thinkingLevel,
      }
    }

    // Image config
    const imageConfig: Record<string, string> = {}
    if (config.aspectRatio) imageConfig.aspectRatio = config.aspectRatio
    if (config.imageSize) imageConfig.imageSize = config.imageSize
    if (config.personGeneration) imageConfig.personGeneration = config.personGeneration
    if (Object.keys(imageConfig).length > 0) {
      apiConfig.imageConfig = imageConfig
    }

    // Google Search grounding
    if (config.googleSearch) {
      apiConfig.tools = [{ googleSearch: {} }]
    }

    return apiConfig
  }

  async function generateImage(
    prompt: string,
    config: GenerationConfig,
  ): Promise<GenerationResult> {
    if (!client) throw new Error(t('apiKeyNotSet'))

    loading.value = true
    error.value = null
    abortController = new AbortController()

    try {
      const apiConfig = buildApiConfig(config)
      apiConfig.abortSignal = abortController.signal

      const contents = [
        {
          role: 'user' as const,
          parts: [{ text: prompt }],
        },
      ]

      const response = await client.models.generateContentStream({
        model: config.model,
        config: apiConfig,
        contents,
      })

      return await collectStreamResult(response, config.model)
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

  async function editImage(
    images: InputImage[],
    prompt: string,
    config: GenerationConfig,
  ): Promise<GenerationResult> {
    if (!client) throw new Error(t('apiKeyNotSet'))

    loading.value = true
    error.value = null
    abortController = new AbortController()

    try {
      const apiConfig = buildApiConfig(config)
      apiConfig.abortSignal = abortController.signal

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parts: any[] = images.map((img) => ({
        inlineData: {
          mimeType: img.mimeType,
          data: img.base64,
        },
      }))
      parts.push({ text: prompt })

      const contents = [
        {
          role: 'user' as const,
          parts,
        },
      ]

      const response = await client.models.generateContentStream({
        model: config.model,
        config: apiConfig,
        contents,
      })

      return await collectStreamResult(response, config.model)
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
  async function collectStreamResult(response: any, modelId: string): Promise<GenerationResult> {
    let imageBase64 = ''
    let imageMimeType = ''
    let textResponse = ''
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lastUsageMetadata: any = null

    for await (const chunk of response) {
      // Capture usage metadata from each chunk (last one has the totals)
      if (chunk.usageMetadata) {
        lastUsageMetadata = chunk.usageMetadata
      }

      if (!chunk.candidates?.[0]?.content?.parts) {
        continue
      }

      for (const part of chunk.candidates[0].content.parts) {
        if (part.inlineData) {
          imageBase64 = part.inlineData.data ?? ''
          imageMimeType = part.inlineData.mimeType ?? 'image/png'
        } else if (part.text) {
          textResponse += part.text
        }
      }
    }

    if (!imageBase64) {
      throw new Error(t('noImageGenerated'))
    }

    // Build usage info
    let usage: UsageInfo | undefined
    if (lastUsageMetadata) {
      const promptTokens = lastUsageMetadata.promptTokenCount ?? 0
      const candidateTokens = lastUsageMetadata.candidatesTokenCount ?? 0
      const thoughtTokens = lastUsageMetadata.thoughtsTokenCount ?? 0
      const totalTokens = lastUsageMetadata.totalTokenCount ?? 0

      // Calculate cost
      const pricing = MODEL_PRICING[modelId]
      let estimatedCost = 0
      if (pricing) {
        // Input cost
        estimatedCost += (promptTokens / 1_000_000) * pricing.inputText

        // Determine image output tokens vs text output tokens from details
        let imageOutputTokens = 0
        let textOutputTokens = 0
        const candidateDetails = lastUsageMetadata.candidatesTokensDetails
        if (Array.isArray(candidateDetails)) {
          for (const detail of candidateDetails) {
            if (detail.modality === 'IMAGE') {
              imageOutputTokens += detail.tokenCount ?? 0
            } else {
              textOutputTokens += detail.tokenCount ?? 0
            }
          }
        } else {
          // Fallback: if no detail breakdown, treat all candidate tokens as image
          imageOutputTokens = candidateTokens
        }

        // Text + thinking output cost
        estimatedCost += ((textOutputTokens + thoughtTokens) / 1_000_000) * pricing.outputText
        // Image output cost
        estimatedCost += (imageOutputTokens / 1_000_000) * pricing.outputImage
      }

      usage = {
        promptTokenCount: promptTokens,
        candidatesTokenCount: candidateTokens,
        thoughtsTokenCount: thoughtTokens,
        totalTokenCount: totalTokens,
        estimatedCost,
      }
    }

    return {
      imageBase64,
      imageMimeType,
      textResponse: textResponse || undefined,
      usage,
    }
  }

  return { loading, error, generateImage, editImage, cancel }
}
