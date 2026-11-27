import type { ModelOption, Provider } from '../types'
import {
  AVAILABLE_MODELS,
  GEMINI_FLASH_IMAGE_MODEL,
  GEMINI_FLASH_LITE_IMAGE_MODEL,
  MODEL_PRICING,
  RECRAFT_V4_1_FLASH_V2_MODEL,
  estimateImageOutputCost,
  getAspectRatios,
  getBaseModelId,
  getImageQualities,
  getImageSizes,
  getMaxInputImages,
  getModelReleaseDate,
  getResolution,
  hasFlatImagePricing,
  isGptImageModel,
  isImageSizeSupported,
  isMaiImage27Model,
  isMaiImageModel,
  resolveImageQuality,
  supportsGoogleSearch,
  supportsImageConfiguration,
  supportsImageQuality,
  supportsImageSizeConfiguration,
  supportsSeedParameter,
} from './models'
import { getModelAuthor } from './modelGroups'

export type CatalogSortBy = 'releaseDesc' | 'releaseAsc' | 'priceAsc' | 'priceDesc' | 'nameAsc'
export type CatalogProviderFilter = 'all' | Provider

export type CatalogCapability =
  | 'thinking'
  | 'googleSearch'
  | 'webGrounding'
  | 'transparentBg'
  | 'qualityControl'
  | 'seed'

export type CatalogProviderDiffKey =
  | 'catalogDiffGeminiFlash512'
  | 'catalogDiffGeminiFeatures'
  | 'catalogDiffGeminiThinking'
  | 'catalogDiffVercelSize'
  | 'catalogDiffVercelSizeAndBg'
  | 'catalogDiffOpenRouterAspectRatio'

export interface CatalogSizePriceTier {
  size: string
  resolution?: string
  unitCost: number
  minQualityCost?: number
  maxQualityCost?: number
  providerOnly?: Provider[]
}

export interface CatalogModelEntry {
  baseId: string
  name: string
  authorId: string
  authorName: string
  releaseDate: string
  variants: ModelOption[]
  providers: Provider[]
  activeModel: ModelOption
  sizeTiers: CatalogSizePriceTier[]
  supportsCustomSize: boolean
  aspectRatios: readonly string[]
  hasAutoAspectRatio: boolean
  maxReferenceImages: number
  referenceSize: string
  referenceCost: number
  minCost: number
  maxCost: number
  imagesPerDollar: number
  isExactFlatPrice: boolean
  tokenPricing?: {
    inputText: number
    inputImage?: number
    outputText: number
    outputImage: number
  }
  capabilities: CatalogCapability[]
  providerDiffNote?: CatalogProviderDiffKey
}

export interface CatalogOverviewStats {
  totalModels: number
  minReferenceCost: number
  maxReferenceCost: number
  medianReferenceCost: number
  cheapestModelName: string
  newestReleaseDate: string
  newestModelNames: string[]
}

export const CATALOG_PROVIDERS: readonly Provider[] = ['gemini', 'openrouter', 'vercel']

function pickProbeVariant(variants: readonly ModelOption[], providerFilter: CatalogProviderFilter): ModelOption {
  if (providerFilter !== 'all') {
    return variants.find((v) => v.provider === providerFilter) ?? variants[0]
  }
  // Prefer Gemini direct (exposes 512 on Flash), then Vercel (exposes MAI/GPT size presets & MiniMax pixel sizes), then OpenRouter.
  return variants.find((v) => v.provider === 'gemini')
    ?? variants.find((v) => v.provider === 'vercel')
    ?? variants[0]
}

function computeQualityRange(
  modelId: string,
  size: string,
  provider: Provider,
): { minQualityCost?: number; maxQualityCost?: number } {
  if (!supportsImageQuality(modelId)) return {}
  const costs = getImageQualities(modelId)
    .filter((q) => q !== 'auto')
    .map((q) => estimateImageOutputCost(modelId, size, 1, q, provider, '1:1'))
    .filter((c): c is number => c != null)
  if (costs.length < 2) return {}
  const minQualityCost = Math.min(...costs)
  const maxQualityCost = Math.max(...costs)
  return maxQualityCost > minQualityCost ? { minQualityCost, maxQualityCost } : {}
}

function buildSizeTiers(
  variants: readonly ModelOption[],
  probe: ModelOption,
  providerFilter: CatalogProviderFilter,
): { sizeTiers: CatalogSizePriceTier[]; supportsCustomSize: boolean } {
  if (!supportsImageConfiguration(probe.id, probe.provider)) {
    const unitCost = estimateImageOutputCost(probe.id, '1K', 1, undefined, probe.provider, '1:1') ?? 0
    return {
      supportsCustomSize: false,
      sizeTiers: [{ size: 'auto', unitCost }],
    }
  }

  if (!supportsImageSizeConfiguration(probe.id, probe.provider)) {
    const defaultQuality = supportsImageQuality(probe.id) ? resolveImageQuality(probe.id) : undefined
    const unitCost = estimateImageOutputCost(probe.id, '1K', 1, defaultQuality, probe.provider, '1:1') ?? 0
    const qualityRange = computeQualityRange(probe.id, '1K', probe.provider)
    return {
      supportsCustomSize: false,
      sizeTiers: [{
        size: 'auto',
        resolution: '1024×1024',
        unitCost,
        ...qualityRange,
      }],
    }
  }

  const candidateSizes = getImageSizes(probe.id, probe.provider)
    .filter((s) => providerFilter === 'all' || isImageSizeSupported(providerFilter, s.value))

  const sizeTiers: CatalogSizePriceTier[] = candidateSizes.map((s) => {
    const supportingProviders = variants
      .filter((v) =>
        supportsImageSizeConfiguration(v.id, v.provider)
        && isImageSizeSupported(v.provider, s.value)
        && getImageSizes(v.id, v.provider).some((opt) => opt.value === s.value))
      .map((v) => v.provider)

    const providerOnly = providerFilter === 'all'
      && supportingProviders.length > 0
      && supportingProviders.length < variants.length
      ? supportingProviders
      : undefined

    const defaultQuality = supportsImageQuality(probe.id) ? resolveImageQuality(probe.id) : undefined
    const unitCost = estimateImageOutputCost(probe.id, s.value, 1, defaultQuality, probe.provider, '1:1') ?? 0
    const qualityRange = computeQualityRange(probe.id, s.value, probe.provider)

    return {
      size: s.value,
      resolution: getResolution('1:1', s.value, probe.id, probe.provider),
      unitCost,
      ...qualityRange,
      ...(providerOnly ? { providerOnly } : {}),
    }
  })

  return { supportsCustomSize: true, sizeTiers }
}

function buildCapabilities(
  baseId: string,
  providers: readonly Provider[],
  providerFilter: CatalogProviderFilter,
): CatalogCapability[] {
  const caps: CatalogCapability[] = []
  const geminiVisible = (providerFilter === 'all' || providerFilter === 'gemini') && providers.includes('gemini')
  const vercelVisible = (providerFilter === 'all' || providerFilter === 'vercel') && providers.includes('vercel')

  if (geminiVisible) {
    caps.push('thinking')
    if (supportsGoogleSearch(baseId)) caps.push('googleSearch')
  }
  if (isMaiImageModel(baseId)) caps.push('webGrounding')
  if (isGptImageModel(baseId) || (isMaiImage27Model(baseId) && vercelVisible)) {
    caps.push('transparentBg')
  }
  if (supportsImageQuality(baseId)) caps.push('qualityControl')
  if (supportsSeedParameter(baseId)) caps.push('seed')
  return caps
}

function getProviderDiffNote(
  baseId: string,
  providers: readonly Provider[],
  providerFilter: CatalogProviderFilter,
): CatalogProviderDiffKey | undefined {
  if (providerFilter !== 'all' || providers.length <= 1) return undefined
  if (providers.includes('gemini')) {
    if (baseId === GEMINI_FLASH_IMAGE_MODEL) return 'catalogDiffGeminiFlash512'
    if (baseId === GEMINI_FLASH_LITE_IMAGE_MODEL) return 'catalogDiffGeminiThinking'
    return 'catalogDiffGeminiFeatures'
  }
  if (isMaiImage27Model(baseId)) return 'catalogDiffVercelSizeAndBg'
  if (isMaiImageModel(baseId) || isGptImageModel(baseId)) return 'catalogDiffVercelSize'
  if (baseId === RECRAFT_V4_1_FLASH_V2_MODEL) return 'catalogDiffOpenRouterAspectRatio'
  return undefined
}

/** Aggregate available models by canonical base model ID, adapted to `providerFilter`. */
export function buildModelCatalog(
  providerFilter: CatalogProviderFilter = 'all',
  models: readonly ModelOption[] = AVAILABLE_MODELS,
): CatalogModelEntry[] {
  const grouped = new Map<string, ModelOption[]>()
  for (const model of models) {
    const baseId = getBaseModelId(model.id)
    let list = grouped.get(baseId)
    if (!list) {
      list = []
      grouped.set(baseId, list)
    }
    list.push(model)
  }

  const entries: CatalogModelEntry[] = []
  for (const [baseId, rawVariants] of grouped) {
    const variants = [...rawVariants].sort(
      (a, b) => CATALOG_PROVIDERS.indexOf(a.provider) - CATALOG_PROVIDERS.indexOf(b.provider),
    )
    if (providerFilter !== 'all' && !variants.some((v) => v.provider === providerFilter)) continue

    const providers = variants.map((v) => v.provider)
    const activeModel = providerFilter === 'all'
      ? variants[0]
      : variants.find((v) => v.provider === providerFilter)!
    const probe = pickProbeVariant(variants, providerFilter)
    const { id: authorId, name: authorName } = getModelAuthor(baseId)
    const { sizeTiers, supportsCustomSize } = buildSizeTiers(variants, probe, providerFilter)

    const referenceTier = sizeTiers.find((t) => t.size === '1K') ?? sizeTiers[0]
    const referenceCost = referenceTier?.unitCost ?? 0
    const minCost = Math.min(...sizeTiers.map((t) => t.minQualityCost ?? t.unitCost))
    const maxCost = Math.max(...sizeTiers.map((t) => t.maxQualityCost ?? t.unitCost))
    const ratioVariant = providerFilter === 'all'
      ? (variants.find((v) => supportsImageConfiguration(v.id, v.provider)) ?? probe)
      : probe
    const aspectRatios: readonly string[] = supportsImageConfiguration(ratioVariant.id, ratioVariant.provider)
      ? getAspectRatios(ratioVariant.id)
      : []

    entries.push({
      baseId,
      name: activeModel.name,
      authorId,
      authorName,
      releaseDate: getModelReleaseDate(baseId) ?? '',
      variants,
      providers,
      activeModel,
      sizeTiers,
      supportsCustomSize,
      aspectRatios,
      hasAutoAspectRatio: aspectRatios.includes('auto'),
      maxReferenceImages: getMaxInputImages(probe.id),
      referenceSize: referenceTier?.size ?? '1K',
      referenceCost,
      minCost,
      maxCost,
      imagesPerDollar: referenceCost > 0 ? Math.max(1, Math.floor(1 / referenceCost)) : 0,
      isExactFlatPrice: hasFlatImagePricing(baseId),
      tokenPricing: MODEL_PRICING[baseId],
      capabilities: buildCapabilities(baseId, providers, providerFilter),
      providerDiffNote: getProviderDiffNote(baseId, providers, providerFilter),
    })
  }

  return entries
}

export interface FilterCatalogOptions {
  query?: string
  authorId?: string
  sortBy?: CatalogSortBy
  getDescription?: (model: ModelOption) => string
}

export function filterAndSortCatalog(
  entries: readonly CatalogModelEntry[],
  options: FilterCatalogOptions = {},
): CatalogModelEntry[] {
  const { query = '', authorId = 'all', sortBy = 'releaseDesc', getDescription } = options
  const normalizedQuery = query.trim().toLowerCase()

  const filtered = entries.filter((entry) => {
    if (authorId !== 'all' && entry.authorId !== authorId) return false
    if (!normalizedQuery) return true
    const desc = getDescription ? getDescription(entry.activeModel) : entry.activeModel.description
    return entry.name.toLowerCase().includes(normalizedQuery)
      || entry.baseId.toLowerCase().includes(normalizedQuery)
      || entry.authorName.toLowerCase().includes(normalizedQuery)
      || desc.toLowerCase().includes(normalizedQuery)
      || entry.variants.some((v) => v.id.toLowerCase().includes(normalizedQuery))
  })

  return [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'releaseDesc':
        return b.releaseDate.localeCompare(a.releaseDate)
          || a.referenceCost - b.referenceCost
          || a.name.localeCompare(b.name)
      case 'releaseAsc':
        return a.releaseDate.localeCompare(b.releaseDate)
          || a.referenceCost - b.referenceCost
          || a.name.localeCompare(b.name)
      case 'priceAsc':
        return a.referenceCost - b.referenceCost
          || b.releaseDate.localeCompare(a.releaseDate)
          || a.name.localeCompare(b.name)
      case 'priceDesc':
        return b.referenceCost - a.referenceCost
          || b.releaseDate.localeCompare(a.releaseDate)
          || a.name.localeCompare(b.name)
      case 'nameAsc':
        return a.name.localeCompare(b.name)
    }
  })
}

export function getCatalogOverviewStats(entries: readonly CatalogModelEntry[]): CatalogOverviewStats | null {
  if (entries.length === 0) return null
  const byPrice = [...entries].sort((a, b) => a.referenceCost - b.referenceCost || a.name.localeCompare(b.name))
  const mid = Math.floor(byPrice.length / 2)
  const medianReferenceCost = byPrice.length % 2 === 1
    ? byPrice[mid].referenceCost
    : (byPrice[mid - 1].referenceCost + byPrice[mid].referenceCost) / 2

  const dated = entries.filter((e) => e.releaseDate)
  const newestReleaseDate = dated.reduce((latest, e) => (e.releaseDate > latest ? e.releaseDate : latest), '')
  const newestModelNames = newestReleaseDate
    ? entries.filter((e) => e.releaseDate === newestReleaseDate).map((e) => e.name)
    : []

  return {
    totalModels: entries.length,
    minReferenceCost: byPrice[0].referenceCost,
    maxReferenceCost: byPrice[byPrice.length - 1].referenceCost,
    medianReferenceCost,
    cheapestModelName: byPrice[0].name,
    newestReleaseDate,
    newestModelNames,
  }
}

/** Human-friendly USD formatter for model catalog unit prices. */
export function formatCatalogUnitPrice(cost: number, isExact: boolean): string {
  const formatted = isExact
    ? cost.toFixed(4).replace(/(\.\d{2,}?)0+$/, '$1')
    : cost < 0.001
      ? cost.toFixed(5)
      : cost.toFixed(3).replace(/(\.\d{2})0$/, '$1')
  return `${isExact ? '' : '~'}$${formatted}`
}
