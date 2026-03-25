import { ref, watch } from 'vue'
import { GoogleGenAI } from '@google/genai'
import { useApiKeyStore } from '../stores/apiKey'
import type { GenerationConfig, GenerationResult } from '../types'

export function useGemini() {
  const apiKeyStore = useApiKeyStore()
  const loading = ref(false)
  const error = ref<string | null>(null)
  let abortController: AbortController | null = null
  let client: GoogleGenAI | null = null

  watch(
    () => apiKeyStore.apiKey,
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
    if (!client) throw new Error('API Key not set')

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

      return await collectStreamResult(response)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('abort')) {
        throw new Error('Generation cancelled')
      }
      error.value = msg
      throw new Error(msg)
    } finally {
      loading.value = false
      abortController = null
    }
  }

  async function editImage(
    imageBase64: string,
    imageMimeType: string,
    prompt: string,
    config: GenerationConfig,
  ): Promise<GenerationResult> {
    if (!client) throw new Error('API Key not set')

    loading.value = true
    error.value = null
    abortController = new AbortController()

    try {
      const apiConfig = buildApiConfig(config)
      apiConfig.abortSignal = abortController.signal

      const contents = [
        {
          role: 'user' as const,
          parts: [
            {
              inlineData: {
                mimeType: imageMimeType,
                data: imageBase64,
              },
            },
            { text: prompt },
          ],
        },
      ]

      const response = await client.models.generateContentStream({
        model: config.model,
        config: apiConfig,
        contents,
      })

      return await collectStreamResult(response)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('abort')) {
        throw new Error('Generation cancelled')
      }
      error.value = msg
      throw new Error(msg)
    } finally {
      loading.value = false
      abortController = null
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function collectStreamResult(response: any): Promise<GenerationResult> {
    let imageBase64 = ''
    let imageMimeType = ''
    let textResponse = ''

    for await (const chunk of response) {
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
      throw new Error('No image was generated. Try a different prompt.')
    }

    return {
      imageBase64,
      imageMimeType,
      textResponse: textResponse || undefined,
    }
  }

  return { loading, error, generateImage, editImage, cancel }
}
