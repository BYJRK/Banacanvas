import { ref } from 'vue'
import { generateText, generateImage as generateSdkImage, createGateway } from 'ai'
import type { ModelMessage } from 'ai'
import { useApiKeyStore } from '../stores/apiKey'
import type { GenerationConfig, GenerationResult, InputImage, UsageInfo } from '../types'
import { estimateImageTokenCost, getBaseModelId, getMaiImageSize, getGptImageSize, getMaxInputImages, isMaiImageModel, isGptImageModel, resolveImageQuality, MAI_VERCEL_WEB_GROUNDING_COST, MODEL_PRICING } from '../config/models'
import { prepareMaiImages } from '../maiImages'
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
    prompt: string,
    images: InputImage[],
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
      const signal = externalSignal ?? abortController!.signal

      if (isMaiImageModel(config.model) || isGptImageModel(config.model)) {
        const isGptImage = isGptImageModel(config.model)
        const maxImages = getMaxInputImages(config.model)
        if (images.length > maxImages) {
          throw new Error(t('referenceImagesLimitReached').replace('{count}', String(maxImages)))
        }
        const references = isGptImage ? images : await prepareMaiImages(images, signal)
        signal.throwIfAborted()
        const result = await generateSdkImage({
          model: gateway.imageModel(config.model),
          prompt: references.length > 0
            ? { text: prompt, images: references.map((image) => `data:${image.mimeType};base64,${image.base64}`) }
            : prompt,
          n: 1,
          size: (isGptImage ? getGptImageSize : getMaiImageSize)(config.aspectRatio ?? '1:1', config.imageSize ?? '1K'),
          providerOptions: isGptImage ? {
            openai: {
              quality: resolveImageQuality(config.model, config.imageQuality),
              background: config.imageBackground ?? 'auto',
              outputFormat: 'png',
            },
          } : {
            azure: {
              autoAspectRatio: config.aspectRatio === 'auto',
              webGrounding: config.webGrounding ?? false,
            },
          },
          abortSignal: signal,
        })
        const image = result.images[0]
        if (!image) throw new Error(t('noImageGenerated'))
        const promptTokens = result.usage.inputTokens ?? 0
        const outputTokens = result.usage.outputTokens
        const metadata = result.providerMetadata[isGptImage ? 'openai' : 'azure']?.images
        const imageTokenCounts = metadata?.map((entry) => entry && typeof entry === 'object' && !Array.isArray(entry)
          && typeof entry.imageTokens === 'number' ? entry.imageTokens : undefined)
        const hasImageTokenSplit = imageTokenCounts && imageTokenCounts.length > 0 && imageTokenCounts.every((count) => count != null)
        const imageTokens = images.length === 0 ? 0 : hasImageTokenSplit
          ? imageTokenCounts.reduce<number>((total, count) => total + (count ?? 0), 0)
          : undefined
        const tokenCost = estimateImageTokenCost(config.model, promptTokens, outputTokens, imageTokens)
        return {
          imageBase64: image.base64,
          imageMimeType: image.mediaType,
          usage: {
            promptTokenCount: promptTokens,
            candidatesTokenCount: outputTokens ?? 0,
            thoughtsTokenCount: 0,
            totalTokenCount: result.usage.totalTokens ?? promptTokens + (outputTokens ?? 0),
            estimatedCost: tokenCost == null ? undefined : tokenCost + (!isGptImage && config.webGrounding ? MAI_VERCEL_WEB_GROUNDING_COST : 0),
          },
        }
      }

      const messages: ModelMessage[] = [{
        role: 'user',
        content: images.length > 0 ? [
          ...images.map((image) => ({ type: 'image' as const, image: `data:${image.mimeType};base64,${image.base64}` })),
          { type: 'text' as const, text: prompt },
        ] : prompt,
      }]

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
    // Gemini 3 image models "think" before rendering and emit up to two interim
    // lower-resolution images during that process. The last image returned is
    // always the final, full-resolution render, so pick it instead of the first.
    // Docs: https://ai.google.dev/gemini-api/docs/image-generation (Thinking Process)
    const imageFiles = result.files.filter((f) => f.mediaType?.startsWith('image/'))
    const imageFile = imageFiles[imageFiles.length - 1]
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
    return doRequest(prompt, [], config, externalSignal)
  }

  async function editImage(
    images: InputImage[],
    prompt: string,
    config: GenerationConfig,
    externalSignal?: AbortSignal,
  ): Promise<GenerationResult> {
    return doRequest(prompt, images, config, externalSignal)
  }

  return { loading, error, generateImage, editImage, cancel }
}
