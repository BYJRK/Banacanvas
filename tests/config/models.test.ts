import { describe, expect, it } from 'vitest'
import {
  AVAILABLE_MODELS,
  DEFAULT_MODEL,
  GEMINI_FLASH_IMAGE_MODEL,
  GEMINI_FLASH_LITE_IMAGE_MODEL,
  GEMINI_NANO_BANANA_2_1_MODEL,
  GEMINI_PRO_IMAGE_MODEL,
  GPT_IMAGE_2_5_FLARE_MODEL,
  GROK_IMAGE_2_MODEL,
  GROK_IMAGE_MODEL,
  MAI_IMAGE_2_6_FLASH_MODEL,
  MAI_IMAGE_2_6_MODEL,
  MUSE_IMAGE_MODEL,
  QWEN_IMAGE_2_1_PRO_MODEL,
  QWEN_IMAGE_2_1_TURBO_MODEL,
  RIVERFLOW_V2_5_PRO_MODEL,
  SEEDREAM_5_0_LITE_MODEL,
  SEEDREAM_5_0_PRO_MODEL,
  closestAspectRatio,
  estimateGptImageOutputCost,
  estimateImageOutputCost,
  estimateImageTokenCost,
  getAspectRatios,
  getBaseModelId,
  getGptImageSize,
  getImageSizes,
  getMaiImageSize,
  getMaxInputImages,
  getModelsForProvider,
  getResolution,
  getThinkingLevels,
  isImageSizeSupported,
  resolveImageQuality,
  supportsGoogleSearch,
  supportsImageConfiguration,
  supportsImageSizeConfiguration,
  supportsOutputModalities,
  supportsSeedParameter,
  toOpenRouterImageSize,
  usesOpenRouterImageApi,
} from '../../src/config/models'

const sizeValues = (modelId: string, provider?: Parameters<typeof getImageSizes>[1]) =>
  getImageSizes(modelId, provider).map((s) => s.value)

describe.each([
  [QWEN_IMAGE_2_1_PRO_MODEL, 0.046],
  [QWEN_IMAGE_2_1_TURBO_MODEL, 0.0184],
] as const)('Qwen Image 2.1 %s', (model, price) => {
  it('exposes supported controls and routes through the Image API', () => {
    expect(getModelsForProvider('openrouter').some((m) => m.id === model)).toBe(true)
    expect(getModelsForProvider('vercel').some((m) => m.id === model)).toBe(false)
    expect(sizeValues(model)).toEqual(['1K', '2K'])
    expect(getAspectRatios(model)).toEqual([
      '1:1', '1:2', '1:4', '2:1', '2:3', '3:2', '3:4', '4:1', '4:3', '4:5', '5:4', '9:16', '16:9',
    ])
    expect(getMaxInputImages(model)).toBe(4)
    expect(supportsSeedParameter(model)).toBe(true)
    expect(usesOpenRouterImageApi(model)).toBe(true)
    expect(getResolution('16:9', '2K', model, 'openrouter')).toBeUndefined()
  })

  it('uses flat pricing at either resolution, including batch counts', () => {
    expect(estimateImageOutputCost(model, '1K')).toBeCloseTo(price, 9)
    expect(estimateImageOutputCost(model, '2K', 3)).toBeCloseTo(price * 3, 9)
  })
})

describe('model catalogue', () => {
  it('has unique model ids per provider', () => {
    const keys = AVAILABLE_MODELS.map((m) => `${m.provider}:${m.id}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('defaults to a Gemini model', () => {
    expect(DEFAULT_MODEL.provider).toBe('gemini')
    expect(DEFAULT_MODEL.id).toBe(GEMINI_FLASH_IMAGE_MODEL)
  })

  it('offers at least one model for every provider', () => {
    for (const provider of ['gemini', 'openrouter', 'vercel'] as const) {
      const models = getModelsForProvider(provider)
      expect(models.length).toBeGreaterThan(0)
      expect(models.every((m) => m.provider === provider)).toBe(true)
    }
  })

  it.each(AVAILABLE_MODELS.map((m) => [`${m.provider}:${m.id}`, m] as const))(
    '%s has aspect ratios and a size its provider can deliver',
    (_key, model) => {
      expect(getAspectRatios(model.id).length).toBeGreaterThan(0)
      const sizes = sizeValues(model.id, model.provider)
      expect(sizes.some((size) => isImageSizeSupported(model.provider, size))).toBe(true)
      expect(getMaxInputImages(model.id)).toBeGreaterThan(0)
    },
  )
})

describe('getBaseModelId', () => {
  it('strips the google/ gateway prefix only', () => {
    expect(getBaseModelId('google/gemini-3-pro-image')).toBe('gemini-3-pro-image')
    expect(getBaseModelId('gemini-3-pro-image')).toBe('gemini-3-pro-image')
    expect(getBaseModelId(GPT_IMAGE_2_5_FLARE_MODEL)).toBe(GPT_IMAGE_2_5_FLARE_MODEL)
  })
})

describe('getAspectRatios', () => {
  it('gives Flash the ultra-wide ratios but not Pro or Lite', () => {
    expect(getAspectRatios(GEMINI_FLASH_IMAGE_MODEL)).toContain('8:1')
    expect(getAspectRatios(GEMINI_PRO_IMAGE_MODEL)).not.toContain('8:1')
    expect(getAspectRatios(GEMINI_FLASH_LITE_IMAGE_MODEL)).not.toContain('1:4')
  })

  it('resolves gateway-prefixed Gemini ids like direct ids', () => {
    expect(getAspectRatios(`google/${GEMINI_PRO_IMAGE_MODEL}`)).toEqual(getAspectRatios(GEMINI_PRO_IMAGE_MODEL))
  })

  it('exposes auto only for models that accept it', () => {
    expect(getAspectRatios(GROK_IMAGE_2_MODEL)).toContain('auto')
    expect(getAspectRatios(GROK_IMAGE_MODEL)).not.toContain('auto')
    expect(getAspectRatios(MAI_IMAGE_2_6_MODEL)).toContain('auto')
    expect(getAspectRatios(GPT_IMAGE_2_5_FLARE_MODEL)).toContain('auto')
    expect(getAspectRatios(RIVERFLOW_V2_5_PRO_MODEL)).not.toContain('auto')
  })
})

describe('getImageSizes', () => {
  it('returns per-model Gemini sizes', () => {
    expect(sizeValues(GEMINI_FLASH_IMAGE_MODEL)).toEqual(['512', '1K', '2K', '4K'])
    expect(sizeValues(`google/${GEMINI_NANO_BANANA_2_1_MODEL}`)).toEqual(['1K', '2K', '4K'])
    expect(sizeValues(GEMINI_FLASH_LITE_IMAGE_MODEL)).toEqual(['1K'])
  })

  it('limits GPT Image and MAI to 1K on OpenRouter', () => {
    expect(sizeValues(GPT_IMAGE_2_5_FLARE_MODEL, 'openrouter')).toEqual(['1K'])
    expect(sizeValues(GPT_IMAGE_2_5_FLARE_MODEL, 'vercel')).toEqual(['1K', '2K', '4K'])
    expect(sizeValues(MAI_IMAGE_2_6_MODEL, 'openrouter')).toEqual(['1K'])
    expect(sizeValues(MAI_IMAGE_2_6_MODEL, 'vercel')).toEqual(['1K', '1.5K'])
  })

  it('returns Seedream Lite sizes starting at 2K', () => {
    expect(sizeValues(SEEDREAM_5_0_LITE_MODEL)).toEqual(['2K', '4K'])
  })
})

describe('provider size support', () => {
  it('rejects 512 only on OpenRouter', () => {
    expect(isImageSizeSupported('openrouter', '512')).toBe(false)
    expect(isImageSizeSupported('openrouter', '1K')).toBe(true)
    expect(isImageSizeSupported('gemini', '512')).toBe(true)
    expect(isImageSizeSupported('vercel', '512')).toBe(true)
  })

  it('maps 512 to OpenRouter 0.5K and passes other sizes through', () => {
    expect(toOpenRouterImageSize('512')).toBe('0.5K')
    expect(toOpenRouterImageSize('2K')).toBe('2K')
  })

  it('hides size controls for OpenRouter MAI/GPT and for Muse', () => {
    expect(supportsImageSizeConfiguration(GPT_IMAGE_2_5_FLARE_MODEL, 'openrouter')).toBe(false)
    expect(supportsImageSizeConfiguration(GPT_IMAGE_2_5_FLARE_MODEL, 'vercel')).toBe(true)
    expect(supportsImageSizeConfiguration(MUSE_IMAGE_MODEL, 'openrouter')).toBe(false)
    expect(supportsImageConfiguration(MUSE_IMAGE_MODEL)).toBe(false)
  })
})

describe('capability flags', () => {
  it('disables Google Search for Flash Lite, including the gateway id', () => {
    expect(supportsGoogleSearch(GEMINI_FLASH_IMAGE_MODEL)).toBe(true)
    expect(supportsGoogleSearch(GEMINI_FLASH_LITE_IMAGE_MODEL)).toBe(false)
    expect(supportsGoogleSearch(`google/${GEMINI_FLASH_LITE_IMAGE_MODEL}`)).toBe(false)
  })

  it('adds the MEDIUM thinking level only for Nano Banana 2.1', () => {
    expect(getThinkingLevels(`google/${GEMINI_NANO_BANANA_2_1_MODEL}`).map((l) => l.value)).toEqual(['MINIMAL', 'MEDIUM', 'HIGH'])
    expect(getThinkingLevels(GEMINI_FLASH_IMAGE_MODEL).map((l) => l.value)).toEqual(['MINIMAL', 'HIGH'])
  })

  it('accepts a seed for Seedream Lite', () => {
    expect(supportsSeedParameter(SEEDREAM_5_0_LITE_MODEL)).toBe(true)
    expect(supportsSeedParameter(SEEDREAM_5_0_PRO_MODEL)).toBe(false)
  })

  it('omits output modalities only for Grok Imagine Quality', () => {
    expect(supportsOutputModalities(GROK_IMAGE_MODEL)).toBe(false)
    expect(supportsOutputModalities(`google/${GEMINI_FLASH_IMAGE_MODEL}`)).toBe(true)
  })

  it('routes image-API models away from chat completions', () => {
    for (const id of [GPT_IMAGE_2_5_FLARE_MODEL, MAI_IMAGE_2_6_MODEL, MUSE_IMAGE_MODEL, GROK_IMAGE_2_MODEL, SEEDREAM_5_0_PRO_MODEL, RIVERFLOW_V2_5_PRO_MODEL]) {
      expect(usesOpenRouterImageApi(id), id).toBe(true)
    }
    expect(usesOpenRouterImageApi(`google/${GEMINI_FLASH_IMAGE_MODEL}`)).toBe(false)
    expect(usesOpenRouterImageApi(GROK_IMAGE_MODEL)).toBe(false)
  })

  it('caps reference images per model', () => {
    expect(getMaxInputImages(GPT_IMAGE_2_5_FLARE_MODEL)).toBe(16)
    expect(getMaxInputImages(MAI_IMAGE_2_6_MODEL)).toBe(5)
    expect(getMaxInputImages(MUSE_IMAGE_MODEL)).toBe(4)
    expect(getMaxInputImages(GROK_IMAGE_2_MODEL)).toBe(3)
    expect(getMaxInputImages(GEMINI_FLASH_IMAGE_MODEL)).toBe(14)
  })
})

describe('resolveImageQuality', () => {
  it('defaults GPT Image to high and others to medium', () => {
    expect(resolveImageQuality(GPT_IMAGE_2_5_FLARE_MODEL)).toBe('high')
    expect(resolveImageQuality(GROK_IMAGE_2_MODEL)).toBe('medium')
  })

  it('keeps a quality the model supports and drops one it does not', () => {
    expect(resolveImageQuality(GPT_IMAGE_2_5_FLARE_MODEL, 'max')).toBe('max')
    expect(resolveImageQuality(GROK_IMAGE_2_MODEL, 'low')).toBe('low')
    expect(resolveImageQuality(GROK_IMAGE_2_MODEL, 'max')).toBe('medium')
  })
})

describe('getGptImageSize', () => {
  it('fits the pixel budget and rounds down to 16px', () => {
    expect(getGptImageSize('1:1', '1K')).toBe('1024x1024')
    expect(getGptImageSize('16:9', '1K')).toBe('1360x768')
    expect(getGptImageSize('16:9', '2K')).toBe('2720x1536')
    expect(getGptImageSize('16:9', '4K')).toBe('3840x2160')
  })

  it('caps the long edge at 3840px', () => {
    expect(getGptImageSize('21:9', '4K')).toBe('3840x1632')
  })

  it('returns undefined for auto and unsupported ratios', () => {
    expect(getGptImageSize('auto', '1K')).toBeUndefined()
    expect(getGptImageSize('1:4', '1K')).toBeUndefined()
  })
})

describe('getMaiImageSize', () => {
  it('uses the 1K and 1.5K pixel budgets', () => {
    expect(getMaiImageSize('1:1', '1K')).toBe('1024x1024')
    expect(getMaiImageSize('1:1', '1.5K')).toBe('1536x1536')
    expect(getMaiImageSize('16:9', '1K')).toBe('1360x768')
    expect(getMaiImageSize('9:16', '1K')).toBe('768x1360')
  })

  it('returns undefined for auto and unsupported ratios', () => {
    expect(getMaiImageSize('auto', '1K')).toBeUndefined()
    expect(getMaiImageSize('21:9', '1K')).toBeUndefined()
  })
})

describe('getResolution', () => {
  it('reads the Gemini and Grok resolution tables', () => {
    expect(getResolution('16:9', '1K')).toBe('1376×768')
    expect(getResolution('2:1', '2K', GROK_IMAGE_MODEL)).toBe('2880×1440')
  })

  it('computes GPT Image sizes on Vercel but not on OpenRouter', () => {
    expect(getResolution('16:9', '1K', GPT_IMAGE_2_5_FLARE_MODEL, 'vercel')).toBe('1360×768')
    expect(getResolution('16:9', '1K', GPT_IMAGE_2_5_FLARE_MODEL, 'openrouter')).toBeUndefined()
  })

  it('returns undefined for models without a fixed pixel matrix', () => {
    expect(getResolution('1:1', '1K', SEEDREAM_5_0_PRO_MODEL)).toBeUndefined()
    expect(getResolution('1:1', '1K', RIVERFLOW_V2_5_PRO_MODEL)).toBeUndefined()
  })
})

describe('closestAspectRatio', () => {
  it('picks the nearest supported ratio', () => {
    expect(closestAspectRatio(1920, 1080, getAspectRatios(GEMINI_FLASH_IMAGE_MODEL))).toBe('16:9')
    expect(closestAspectRatio(1000, 1000, getAspectRatios(GEMINI_FLASH_IMAGE_MODEL))).toBe('1:1')
    expect(closestAspectRatio(3000, 4000, getAspectRatios(GEMINI_FLASH_IMAGE_MODEL))).toBe('3:4')
  })

  it('depends on the ratios the model offers', () => {
    // 1:3 is nearest 1:4 for Flash, but Pro has no ultra-tall ratios.
    expect(closestAspectRatio(1000, 3000, getAspectRatios(GEMINI_FLASH_IMAGE_MODEL))).toBe('1:4')
    expect(closestAspectRatio(1000, 3000, getAspectRatios(GEMINI_PRO_IMAGE_MODEL))).toBe('9:16')
  })

  it('handles decimal ratios', () => {
    expect(closestAspectRatio(900, 1950, getAspectRatios(GROK_IMAGE_MODEL))).toBe('9:19.5')
  })

  it('skips auto and malformed entries', () => {
    expect(closestAspectRatio(1600, 900, ['auto', '1:1', '16:9'])).toBe('16:9')
    expect(closestAspectRatio(1600, 900, ['bad', '4:0', '1:1'])).toBe('1:1')
  })

  it('keeps the first of equally close ratios', () => {
    expect(closestAspectRatio(1000, 1000, ['2:2', '1:1'])).toBe('2:2')
  })

  it('falls back to the first entry when nothing is numeric', () => {
    expect(closestAspectRatio(100, 100, ['auto'])).toBe('auto')
  })
})

describe('estimateImageOutputCost', () => {
  it('prices Gemini output tokens per size and batch', () => {
    expect(estimateImageOutputCost(GEMINI_FLASH_IMAGE_MODEL, '1K')).toBeCloseTo(0.0672, 6)
    expect(estimateImageOutputCost(GEMINI_FLASH_IMAGE_MODEL, '512', 2)).toBeCloseTo(0.08964, 6)
    expect(estimateImageOutputCost(`google/${GEMINI_PRO_IMAGE_MODEL}`, '4K')).toBeCloseTo(0.24, 6)
  })

  it('falls back to the 1K token count for unknown sizes', () => {
    expect(estimateImageOutputCost(GEMINI_FLASH_IMAGE_MODEL, '1.5K')).toBeCloseTo(0.0672, 6)
  })

  it('uses flat prices for per-image models', () => {
    expect(estimateImageOutputCost(RIVERFLOW_V2_5_PRO_MODEL, '4K', 3)).toBeCloseTo(0.51, 6)
    expect(estimateImageOutputCost(MUSE_IMAGE_MODEL, '1K')).toBeCloseTo(0.01, 6)
  })

  it('prices Grok Imagine 2.0 by quality and size', () => {
    expect(estimateImageOutputCost(GROK_IMAGE_2_MODEL, '2K', 1, 'low')).toBeCloseTo(0.06, 6)
    expect(estimateImageOutputCost(GROK_IMAGE_2_MODEL, '4K', 1, 'medium')).toBeCloseTo(0.06, 6)
  })

  it('doubles MAI 1.5K only on Vercel', () => {
    expect(estimateImageOutputCost(MAI_IMAGE_2_6_MODEL, '1.5K', 1, undefined, 'vercel')).toBeCloseTo(0.08, 6)
    expect(estimateImageOutputCost(MAI_IMAGE_2_6_MODEL, '1.5K', 1, undefined, 'openrouter')).toBeCloseTo(0.04, 6)
    expect(estimateImageOutputCost(MAI_IMAGE_2_6_FLASH_MODEL, '1K')).toBeCloseTo(0.02, 6)
  })

  it.each(['1K', '1.5K'])('prices Vercel MAI auto aspect ratio at 1.5K regardless of saved size %s', (size) => {
    expect(estimateImageOutputCost(MAI_IMAGE_2_6_FLASH_MODEL, size, 1, undefined, 'vercel', 'auto')).toBeCloseTo(0.04, 6)
    expect(estimateImageOutputCost(MAI_IMAGE_2_6_MODEL, size, 3, undefined, 'vercel', 'auto')).toBeCloseTo(0.24, 6)
    expect(estimateImageOutputCost(MAI_IMAGE_2_6_FLASH_MODEL, size, 3, undefined, 'openrouter', 'auto')).toBeCloseTo(0.06, 6)
  })

  it('uses a square reference size for GPT Image on OpenRouter', () => {
    expect(estimateImageOutputCost(GPT_IMAGE_2_5_FLARE_MODEL, '4K', 1, 'high', 'openrouter'))
      .toBeCloseTo(estimateGptImageOutputCost(1024, 1024, 'high')!, 9)
  })

  it('cannot estimate GPT Image with an auto aspect ratio', () => {
    expect(estimateImageOutputCost(GPT_IMAGE_2_5_FLARE_MODEL, '1K', 1, 'high', 'vercel', 'auto')).toBeUndefined()
  })
})

describe('estimateGptImageOutputCost', () => {
  it('follows the calculator token formula', () => {
    // 48x48 grid * (2M + 1,048,576 px) / 4M = 1755.98 -> 1756 tokens at $30/M
    expect(estimateGptImageOutputCost(1024, 1024, 'high')).toBeCloseTo(1756 * 30 / 1_000_000, 9)
  })

  it('rejects sizes and qualities the calculator does not accept', () => {
    expect(estimateGptImageOutputCost(1024, 1024, 'auto')).toBeUndefined()
    expect(estimateGptImageOutputCost(1000, 1024, 'high')).toBeUndefined()
    expect(estimateGptImageOutputCost(512, 512, 'high')).toBeUndefined()
    expect(estimateGptImageOutputCost(3840, 1024, 'high')).toBeUndefined()
  })
})

describe('estimateImageTokenCost', () => {
  it('splits input tokens into text and image rates', () => {
    // (600 * $5 + 400 * $8 + 2000 * $30) / 1M
    expect(estimateImageTokenCost(GPT_IMAGE_2_5_FLARE_MODEL, 1000, 2000, 400)).toBeCloseTo(0.0662, 9)
  })

  it('bills all input at the image rate when the split is unknown', () => {
    expect(estimateImageTokenCost(GPT_IMAGE_2_5_FLARE_MODEL, 1000, 2000)).toBeCloseTo(0.068, 9)
  })

  it('returns undefined without output tokens', () => {
    expect(estimateImageTokenCost(GPT_IMAGE_2_5_FLARE_MODEL, 1000, undefined)).toBeUndefined()
  })
})
