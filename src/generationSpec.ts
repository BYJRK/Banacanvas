import type { GenerationConfig, Provider } from './types'
import {
  estimateImageOutputCost,
  getResolution,
  isGptImageModel,
  isMaiImageModel,
  resolveImageQuality,
  supportsImageSizeConfiguration,
} from './config/models'

/** Whether the image size setting applies to this model/provider/ratio combination. */
export function isImageSizeConfigurable(modelId: string, provider: Provider, aspectRatio?: string): boolean {
  if (!supportsImageSizeConfiguration(modelId, provider)) return false
  return !((isMaiImageModel(modelId) || isGptImageModel(modelId)) && aspectRatio === 'auto')
}

/** Estimated output cost (USD) for `batchSize` images with the given config. */
export function estimateConfigCost(
  modelId: string,
  provider: Provider,
  config: Pick<GenerationConfig, 'aspectRatio' | 'imageSize' | 'imageQuality'>,
  batchSize: number,
): number | undefined {
  const aspectRatio = config.aspectRatio ?? '1:1'
  return estimateImageOutputCost(
    modelId,
    config.imageSize ?? '1K',
    batchSize,
    resolveImageQuality(modelId, config.imageQuality),
    provider,
    aspectRatio,
  )
}

export function formatCost(cost: number, modelId: string): string {
  if (isGptImageModel(modelId)) return cost.toFixed(3)
  if (cost < 0.001) return cost.toFixed(6)
  if (cost < 0.1) return cost.toFixed(4)
  return cost.toFixed(2)
}

export interface GenerationSpec {
  aspectRatio: string
  imageSize?: string
  resolution?: string
  unitCost?: number
  totalCost?: number
}

export function getGenerationSpec(
  modelId: string,
  provider: Provider,
  config: Pick<GenerationConfig, 'aspectRatio' | 'imageSize' | 'imageQuality'>,
  batchSize: number,
): GenerationSpec {
  const aspectRatio = config.aspectRatio ?? '1:1'
  const imageSize = config.imageSize ?? '1K'
  const sizeShown = isImageSizeConfigurable(modelId, provider, aspectRatio)
  return {
    aspectRatio,
    imageSize: sizeShown ? imageSize : undefined,
    resolution: aspectRatio === 'auto' ? undefined : getResolution(aspectRatio, imageSize, modelId, provider),
    unitCost: estimateConfigCost(modelId, provider, config, 1),
    totalCost: estimateConfigCost(modelId, provider, config, batchSize),
  }
}

/** Pixel box of a small rectangle with the given ratio, fitted inside a `box`×`box` square. */
export function ratioGlyphSize(aspectRatio: string, box = 14, min = 4): { width: number; height: number } {
  const [w, h] = aspectRatio.split(':').map(Number)
  if (!(w > 0) || !(h > 0)) return { width: box, height: box }
  const scale = box / Math.max(w, h)
  return {
    width: Math.max(min, Math.round(w * scale)),
    height: Math.max(min, Math.round(h * scale)),
  }
}
