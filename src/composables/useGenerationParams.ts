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

/** The exact model if it still exists, else the provider's first model, else the app default. */
function resolveModel(modelId: string, provider: Provider): ModelOption {
  return findModel(modelId, provider) ?? getModelsForProvider(provider)[0] ?? DEFAULT_MODEL
}

/**
 * Adapt `base` to `model`, resetting any option the model does not support.
 * `previousModelId` is the model `base` was configured for.
 */
function normalizeConfig(base: GenerationConfig, model: ModelOption, previousModelId: string): GenerationConfig {
  const newConfig = { ...base, model: model.id, provider: model.provider }
  newConfig.imageQuality = resolveImageQuality(model.id,
    isGptImageModel(model.id) && !isGptImageModel(previousModelId) ? undefined : newConfig.imageQuality)

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

  return newConfig
}

/** Returned when a restored model no longer exists and another was selected instead. */
export interface ModelFallback {
  unavailableModel: string
  fallback: ModelOption
}

/** Generation parameters (provider, model, config, download format) persisted to localStorage. */
export function useGenerationParams() {
  const persisted = loadPersistedParams()
  const persistedModel = resolveModel(persisted.modelId, persisted.provider)

  const selectedProvider = ref<Provider>(persistedModel.provider)
  const selectedModel = ref<ModelOption>(persistedModel)
  const config = ref<GenerationConfig>(normalizeConfig({
    provider: persisted.provider,
    model: persisted.modelId,
    aspectRatio: persisted.config.aspectRatio ?? '1:1',
    imageSize: persisted.config.imageSize ?? '1K',
    imageQuality: persisted.config.imageQuality,
    imageBackground: persisted.config.imageBackground ?? 'auto',
    seed: persisted.config.seed,
    thinkingLevel: persisted.config.thinkingLevel ?? 'MINIMAL',
    googleSearch: persisted.config.googleSearch ?? false,
    webGrounding: persisted.config.webGrounding ?? false,
    batchSize: persisted.config.batchSize ?? 1,
  }, persistedModel, persisted.modelId))
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
    config.value = normalizeConfig(config.value, model, config.value.model)
  }

  function changeProvider(provider: Provider) {
    selectedProvider.value = provider
    const models = getModelsForProvider(provider)
    if (models.length > 0) changeModel(models[0])
  }

  /**
   * Restore provider, model and config from a history entry. If the entry's model
   * no longer exists, falls back to another model and reports it.
   */
  function applyHistoryConfig(entry: HistoryEntry): ModelFallback | undefined {
    const provider = entry.config.provider ?? 'gemini'
    const model = resolveModel(entry.config.model, provider)
    selectedProvider.value = model.provider
    selectedModel.value = model
    config.value = normalizeConfig({ ...entry.config, provider }, model, entry.config.model)
    if (model.id === entry.config.model && model.provider === provider) return undefined
    return { unavailableModel: entry.config.model, fallback: model }
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
