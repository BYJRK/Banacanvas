import { ref, watch } from 'vue'
import {
  DEFAULT_MODEL,
  AVAILABLE_MODELS,
  getModelsForProvider,
  getThinkingLevels,
  getAspectRatios,
  getImageSizes,
  isImageSizeSupported,
  supportsGoogleSearch,
  supportsSeedParameter,
  resolveImageQuality,
  isGptImageModel,
} from '../config/models'
import type { GenerationConfig, ModelOption, Provider, DownloadFormat, HistoryEntry } from '../types'

const PARAMS_KEY = 'banacanvas-params'
const LEGACY_DOWNLOAD_FORMAT_KEY = 'banacanvas-download-format'
const SUGGEST_ASPECT_RATIO_KEY = 'banacanvas-suggest-aspect-ratio'

interface PersistedParams {
  provider: Provider
  modelId: string
  config: Partial<GenerationConfig>
  downloadFormat?: DownloadFormat
}

function loadPersistedParams(): PersistedParams {
  let persisted: PersistedParams | null = null
  try {
    const raw = localStorage.getItem(PARAMS_KEY)
    if (raw) persisted = JSON.parse(raw)
  } catch { /* ignore */ }
  persisted ??= { provider: DEFAULT_MODEL.provider, modelId: DEFAULT_MODEL.id, config: {} }
  persisted.config ??= {}
  // Migrate the legacy separate download-format key.
  if (!persisted.downloadFormat) {
    persisted.downloadFormat = (localStorage.getItem(LEGACY_DOWNLOAD_FORMAT_KEY) as DownloadFormat) || 'png'
    localStorage.removeItem(LEGACY_DOWNLOAD_FORMAT_KEY)
  }
  return persisted
}

function findModel(modelId: string, provider: Provider): ModelOption | undefined {
  return AVAILABLE_MODELS.find((m) => m.id === modelId && m.provider === provider)
}

/** Generation parameters (provider, model, config, download format) persisted to localStorage. */
export function useGenerationParams() {
  const persisted = loadPersistedParams()
  const persistedProvider = persisted.provider
  const persistedModel = findModel(persisted.modelId, persistedProvider) ?? DEFAULT_MODEL

  const selectedProvider = ref<Provider>(persistedProvider)
  const selectedModel = ref<ModelOption>(persistedModel)
  const config = ref<GenerationConfig>({
    provider: persistedProvider,
    model: persistedModel.id,
    aspectRatio: persisted.config.aspectRatio ?? '1:1',
    imageSize: persisted.config.imageSize ?? '1K',
    imageQuality: resolveImageQuality(persistedModel.id, persisted.config.imageQuality),
    imageBackground: persisted.config.imageBackground ?? 'auto',
    seed: persisted.config.seed,
    thinkingLevel: persisted.config.thinkingLevel ?? 'MINIMAL',
    googleSearch: persisted.config.googleSearch ?? false,
    webGrounding: persisted.config.webGrounding ?? false,
    batchSize: persisted.config.batchSize ?? 1,
  })
  const downloadFormat = ref<DownloadFormat>(persisted.downloadFormat ?? 'png')
  const suggestAspectRatio = ref(localStorage.getItem(SUGGEST_ASPECT_RATIO_KEY) !== 'false')

  watch([selectedProvider, selectedModel, config, downloadFormat], () => {
    localStorage.setItem(PARAMS_KEY, JSON.stringify({
      provider: selectedProvider.value,
      modelId: selectedModel.value.id,
      downloadFormat: downloadFormat.value,
      config: {
        aspectRatio: config.value.aspectRatio,
        imageSize: config.value.imageSize,
        imageQuality: config.value.imageQuality,
        imageBackground: config.value.imageBackground,
        seed: config.value.seed,
        thinkingLevel: config.value.thinkingLevel,
        googleSearch: config.value.googleSearch,
        webGrounding: config.value.webGrounding,
        batchSize: config.value.batchSize,
      },
    } satisfies PersistedParams))
  }, { deep: true })

  watch(suggestAspectRatio, (val) => {
    localStorage.setItem(SUGGEST_ASPECT_RATIO_KEY, String(val))
  })

  /** Switch model and reset any options the new model does not support. */
  function changeModel(model: ModelOption) {
    selectedModel.value = model
    const newConfig = { ...config.value, model: model.id, provider: model.provider }
    newConfig.imageQuality = resolveImageQuality(model.id,
      isGptImageModel(model.id) && !isGptImageModel(config.value.model) ? undefined : newConfig.imageQuality)

    if (newConfig.thinkingLevel && !getThinkingLevels(model.id).some((level) => level.value === newConfig.thinkingLevel)) {
      newConfig.thinkingLevel = 'MINIMAL'
    }

    const sizes = getImageSizes(model.id, model.provider)
    const validSizes = sizes.map((s) => s.value)
    if (newConfig.imageSize && !validSizes.includes(newConfig.imageSize as (typeof validSizes)[number])) {
      newConfig.imageSize = validSizes[0] as GenerationConfig['imageSize']
    }
    // Reset sizes the provider can't deliver (512 on openrouter)
    if (newConfig.imageSize && !isImageSizeSupported(model.provider, newConfig.imageSize)) {
      const supported = sizes.find((s) => isImageSizeSupported(model.provider, s.value))
      newConfig.imageSize = (supported?.value ?? '1K') as GenerationConfig['imageSize']
    }

    const validRatios = getAspectRatios(model.id) as readonly string[]
    if (newConfig.aspectRatio && !validRatios.includes(newConfig.aspectRatio)) {
      newConfig.aspectRatio = '1:1'
    }

    if (newConfig.googleSearch && !supportsGoogleSearch(model.id)) {
      newConfig.googleSearch = false
    }

    if (!supportsSeedParameter(model.id)) {
      delete newConfig.seed
    }

    config.value = newConfig
  }

  function changeProvider(provider: Provider) {
    selectedProvider.value = provider
    const models = getModelsForProvider(provider)
    if (models.length > 0) changeModel(models[0])
  }

  /** Restore provider, model and config from a history entry. */
  function applyHistoryConfig(entry: HistoryEntry) {
    const provider = entry.config.provider ?? 'gemini'
    config.value = { ...entry.config, provider }
    selectedProvider.value = provider
    selectedModel.value = AVAILABLE_MODELS.find((m) => m.id === entry.config.model)
      ?? { id: entry.config.model, name: entry.config.model, description: '', provider }
  }

  return {
    selectedProvider,
    selectedModel,
    config,
    downloadFormat,
    suggestAspectRatio,
    changeModel,
    changeProvider,
    applyHistoryConfig,
  }
}
