import type { ImageQuality, ModelOption, Provider } from '../types'

// Canonical model IDs — avoid scattering magic strings across capability helpers
export const GEMINI_NANO_BANANA_2_1_MODEL = 'gemini-nano-banana-2.1'
export const GEMINI_FLASH_IMAGE_MODEL = 'gemini-3.1-flash-image'
export const GEMINI_FLASH_LITE_IMAGE_MODEL = 'gemini-3.1-flash-lite-image'
export const GEMINI_PRO_IMAGE_MODEL = 'gemini-3-pro-image'
export const GROK_IMAGE_MODEL = 'x-ai/grok-imagine-image-quality'
export const GROK_IMAGE_2_MODEL = 'x-ai/grok-imagine-image-2.0'
export const SEEDREAM_5_0_PRO_MODEL = 'bytedance-seed/seedream-5-0-pro'
export const SEEDREAM_5_0_LITE_MODEL = 'bytedance-seed/seedream-5-0-lite'
export const RIVERFLOW_V2_5_PRO_MODEL = 'sourceful/riverflow-v2.5-pro'
export const RIVERFLOW_V2_5_FAST_MODEL = 'sourceful/riverflow-v2.5-fast'
export const MUSE_IMAGE_MODEL = 'meta/muse-image'
export const MAI_IMAGE_2_6_MODEL = 'microsoft/mai-image-2.6'
export const MAI_IMAGE_2_6_FLASH_MODEL = 'microsoft/mai-image-2.6-flash'
export const MAI_VERCEL_WEB_GROUNDING_COST = 0.014
export const GPT_IMAGE_2_5_FLARE_MODEL = 'openai/gpt-image-2.5-flare'
export const GPT_IMAGE_2_5_SUNBURST_MODEL = 'openai/gpt-image-2.5-sunburst'

export function isGptImageModel(modelId: string): boolean {
  return modelId === GPT_IMAGE_2_5_FLARE_MODEL || modelId === GPT_IMAGE_2_5_SUNBURST_MODEL
}

export function isMaiImageModel(modelId: string): boolean {
  return modelId === MAI_IMAGE_2_6_MODEL || modelId === MAI_IMAGE_2_6_FLASH_MODEL
}

export const AVAILABLE_MODELS: ModelOption[] = [
  // Gemini Direct API
  {
    id: 'gemini-3.1-flash-image',
    name: 'Nano Banana 2',
    description: 'Best balance of performance & cost. Supports 512–4K, thinking, Google Search.',
    provider: 'gemini',
  },
  {
    id: GEMINI_NANO_BANANA_2_1_MODEL,
    name: 'Nano Banana 2.1',
    description: 'Improved visual quality, text rendering & editing. Supports 1K–4K, thinking, Google Search.',
    provider: 'gemini',
  },
  {
    id: 'gemini-3-pro-image',
    name: 'Nano Banana Pro',
    description: 'Professional quality. Advanced reasoning & text rendering.',
    provider: 'gemini',
  },
  {
    id: 'gemini-3.1-flash-lite-image',
    name: 'Nano Banana 2 Lite',
    description: 'Fastest & cheapest. As fast as 4s per image, 1K only, no Google Search.',
    provider: 'gemini',
  },
  // OpenRouter
  {
    id: 'google/gemini-3.1-flash-image',
    name: 'Nano Banana 2',
    description: 'Gemini Flash via OpenRouter. Supports aspect ratio & image size.',
    provider: 'openrouter',
  },
  {
    id: `google/${GEMINI_NANO_BANANA_2_1_MODEL}`,
    name: 'Nano Banana 2.1',
    description: 'Nano Banana 2.1 via OpenRouter. Improved generation & editing, 1K–4K.',
    provider: 'openrouter',
  },
  {
    id: 'google/gemini-3-pro-image',
    name: 'Nano Banana Pro',
    description: 'Gemini Pro via OpenRouter. Professional quality.',
    provider: 'openrouter',
  },
  {
    id: 'google/gemini-3.1-flash-lite-image',
    name: 'Nano Banana 2 Lite',
    description: 'Gemini Flash Lite via OpenRouter. As fast as 4s per image, 1K only.',
    provider: 'openrouter',
  },
  {
    id: 'x-ai/grok-imagine-image-quality',
    name: 'Grok Imagine Image Quality',
    description: 'Fast, high-fidelity generation & editing.',
    provider: 'openrouter'
  },
  {
    id: GROK_IMAGE_2_MODEL,
    name: 'Grok Imagine Image 2.0',
    description: 'Generation & editing. 1K–2K, quality control.',
    provider: 'openrouter',
  },
  {
    id: SEEDREAM_5_0_PRO_MODEL,
    name: 'Seedream 5.0 Pro',
    description: 'High-fidelity generation & editing. 1K–2K.',
    provider: 'openrouter',
  },
  {
    id: SEEDREAM_5_0_LITE_MODEL,
    name: 'Seedream 5.0 Lite',
    description: 'Fast generation & editing. 2K–4K, seed control.',
    provider: 'openrouter',
  },
  {
    id: RIVERFLOW_V2_5_PRO_MODEL,
    name: 'Riverflow V2.5 Pro',
    description: 'High-control generation & editing. 1K–4K.',
    provider: 'openrouter',
  },
  {
    id: RIVERFLOW_V2_5_FAST_MODEL,
    name: 'Riverflow V2.5 Fast',
    description: 'Fast generation & editing. 1K–2K.',
    provider: 'openrouter',
  },
  {
    id: MUSE_IMAGE_MODEL,
    name: 'Muse Image',
    description: 'Meta Superintelligence Labs\' first image model. Multi-reference & text rendering; ~$0.01/image. No size or ratio controls.',
    provider: 'openrouter',
  },
  // Microsoft MAI, available through both image gateways
  ...(['openrouter', 'vercel'] as const).flatMap((provider): ModelOption[] => [
    {
      id: MAI_IMAGE_2_6_MODEL,
      name: 'MAI-Image-2.6',
      description: 'Microsoft image generation & precise editing. Up to 5 reference images.',
      provider,
    },
    {
      id: MAI_IMAGE_2_6_FLASH_MODEL,
      name: 'MAI-Image-2.6 Flash',
      description: 'Faster, lower-cost Microsoft generation & editing. Up to 5 reference images.',
      provider,
    },
  ]),
  // GPT Image, available through both image gateways
  ...(['openrouter', 'vercel'] as const).flatMap((provider): ModelOption[] => [
    { id: GPT_IMAGE_2_5_FLARE_MODEL, name: 'GPT Image 2.5 Flare', description: 'Fast generation & editing. Six quality levels, transparent backgrounds, up to 16 references.', provider },
    { id: GPT_IMAGE_2_5_SUNBURST_MODEL, name: 'GPT Image 2.5 Sunburst', description: 'Precise editing & detailed generation. Six quality levels, transparent backgrounds, up to 16 references.', provider },
  ]),
  // Vercel AI Gateway
  {
    id: 'google/gemini-3.1-flash-image',
    name: 'Nano Banana 2',
    description: 'Gemini Flash via Vercel AI Gateway. Fast image generation.',
    provider: 'vercel',
  },
  {
    id: `google/${GEMINI_NANO_BANANA_2_1_MODEL}`,
    name: 'Nano Banana 2.1',
    description: 'Nano Banana 2.1 via Vercel AI Gateway. Improved generation & editing, 1K–4K.',
    provider: 'vercel',
  },
  {
    id: 'google/gemini-3-pro-image',
    name: 'Nano Banana Pro',
    description: 'Gemini Pro via Vercel AI Gateway. Professional quality.',
    provider: 'vercel',
  },
  {
    id: 'google/gemini-3.1-flash-lite-image',
    name: 'Nano Banana 2 Lite',
    description: 'Gemini Flash Lite via Vercel AI Gateway. As fast as 4s per image, 1K only.',
    provider: 'vercel',
  },
]

export const DEFAULT_MODEL = AVAILABLE_MODELS[0]

export function getModelsForProvider(provider: Provider): ModelOption[] {
  return AVAILABLE_MODELS.filter((m) => m.provider === provider)
}

/** Strip provider prefix to get the base Gemini model ID for config lookups */
export function getBaseModelId(modelId: string): string {
  return modelId.startsWith('google/') ? modelId.replace('google/', '') : modelId
}

// Aspect ratios supported per model
const FLASH_ASPECT_RATIOS = [
  '1:1', '1:4', '1:8', '2:3', '3:2', '3:4', '4:1', '4:3', '4:5', '5:4', '8:1', '9:16', '16:9', '21:9',
] as const

const PRO_ASPECT_RATIOS = [
  '1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9',
] as const

// Gemini 3.1 Flash Lite Image supports the same 10-ratio set as Pro (no ultra-wide 1:4/1:8/4:1/8:1)
const LITE_ASPECT_RATIOS = PRO_ASPECT_RATIOS

// Image sizes supported per model
const FLASH_IMAGE_SIZES = [
  { value: '512', label: '512' },
  { value: '1K', label: '1K' },
  { value: '2K', label: '2K' },
  { value: '4K', label: '4K' },
] as const

const PRO_IMAGE_SIZES = [
  { value: '1K', label: '1K' },
  { value: '2K', label: '2K' },
  { value: '4K', label: '4K' },
] as const

// Gemini 3.1 Flash Lite Image only supports 1K output
const LITE_IMAGE_SIZES = [
  { value: '1K', label: '1K' },
] as const

const GROK_ASPECT_RATIOS = [
  '1:1', '3:4', '4:3', '9:16', '16:9', '2:3', '3:2', '9:19.5', '19.5:9', '9:20', '20:9', '1:2', '2:1',
] as const

const GROK_2_ASPECT_RATIOS = [...GROK_ASPECT_RATIOS, 'auto'] as const

const SEEDREAM_ASPECT_RATIOS = [
  '1:1', '1:2', '2:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '9:19.5', '19.5:9', '9:20', '20:9', '9:21', '21:9', 'auto',
] as const

const GROK_IMAGE_SIZES = [
  { value: '1K', label: '1K' },
  { value: '2K', label: '2K' },
] as const

const SEEDREAM_IMAGE_SIZES = [
  { value: '1K', label: '1K' },
  { value: '2K', label: '2K' },
] as const

const SEEDREAM_LITE_IMAGE_SIZES = [
  { value: '2K', label: '2K' },
  { value: '4K', label: '4K' },
] as const

// Sourceful Riverflow V2.5 supports this shared ratio set plus `auto`.
// The UI intentionally omits `auto`, which would otherwise override the user's chosen ratio.
const RIVERFLOW_ASPECT_RATIOS = [
  '1:1', '4:3', '3:4', '3:2', '2:3', '16:9', '9:16', '21:9',
] as const

const RIVERFLOW_PRO_IMAGE_SIZES = [
  { value: '1K', label: '1K' },
  { value: '2K', label: '2K' },
  { value: '4K', label: '4K' },
] as const

const RIVERFLOW_FAST_IMAGE_SIZES = [
  { value: '1K', label: '1K' },
  { value: '2K', label: '2K' },
] as const

const MAI_ASPECT_RATIOS = ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', 'auto'] as const
const MAI_IMAGE_SIZES = [
  { value: '1K', label: '1K' },
  { value: '1.5K', label: '1.5K' },
] as const

const GPT_IMAGE_ASPECT_RATIOS = ['1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16', '21:9', 'auto'] as const
const GPT_IMAGE_SIZES = [
  { value: '1K', label: '1K' },
  { value: '2K', label: '2K' },
  { value: '4K', label: '4K' },
] as const

/** GPT Image pixel budgets, rounded down to 16px and capped at 3840px per edge. */
export function getGptImageSize(aspectRatio: string, imageSize: string): `${number}x${number}` | undefined {
  if (aspectRatio === 'auto' || !(GPT_IMAGE_ASPECT_RATIOS as readonly string[]).includes(aspectRatio)) return undefined
  const [w, h] = aspectRatio.split(':').map(Number)
  const pixels = imageSize === '4K' ? 3840 * 2160 : imageSize === '2K' ? 2048 ** 2 : 1024 ** 2
  const width = Math.sqrt(pixels * w / h)
  const height = width * h / w
  const scale = Math.min(1, 3840 / Math.max(width, height))
  return `${Math.floor(width * scale / 16 + 1e-9) * 16}x${Math.floor(height * scale / 16 + 1e-9) * 16}`
}

export function getImageQualities(modelId: string): readonly ImageQuality[] {
  return isGptImageModel(modelId) ? ['auto', 'low', 'medium', 'high', 'xhigh', 'max'] : ['low', 'medium']
}

export function resolveImageQuality(modelId: string, quality?: ImageQuality): ImageQuality {
  return quality && getImageQualities(modelId).includes(quality) ? quality : isGptImageModel(modelId) ? 'high' : 'medium'
}

/** OpenAI's GPT Image 2.5 calculator formula. Image output only; input tokens are extra. */
export function estimateGptImageOutputCost(width: number, height: number, quality: ImageQuality): number | undefined {
  const pixels = width * height
  const ratio = Math.max(width, height) / Math.min(width, height)
  if (quality === 'auto' || width <= 0 || height <= 0 || width % 16 !== 0 || height % 16 !== 0
    || pixels < 655_360 || pixels > 8_294_400 || Math.max(width, height) > 3840 || ratio > 3) return undefined
  const longGrid = { low: 16, medium: 24, high: 48, xhigh: 64, max: 96 }[quality]
  const shortGridValue = longGrid / ratio
  const floor = Math.floor(shortGridValue)
  // The official calculator rounds exact .5 ties to the nearest even integer.
  const shortGrid = shortGridValue - floor === 0.5 ? floor + floor % 2 : Math.round(shortGridValue)
  const tokens = Math.ceil(longGrid * shortGrid * (2_000_000 + pixels) / 4_000_000)
  return tokens * MODEL_PRICING[GPT_IMAGE_2_5_FLARE_MODEL].outputImage / 1_000_000
}

/** MAI uses a pixel budget; follow Azure's 16px rounding and 768px minimum side. */
export function getMaiImageSize(aspectRatio: string, imageSize: string): `${number}x${number}` | undefined {
  if (aspectRatio === 'auto') return undefined
  if (!(MAI_ASPECT_RATIOS as readonly string[]).includes(aspectRatio)) return undefined
  const [w, h] = aspectRatio.split(':').map(Number)
  const ratio = w / h
  const pixels = imageSize === '1.5K' ? 1536 ** 2 : 1024 ** 2
  let width = Math.sqrt(pixels * ratio)
  let height = width / ratio
  if (Math.min(width, height) < 768) {
    ;[width, height] = width < height ? [768, 768 / ratio] : [768 * ratio, 768]
  }
  const floor16 = (value: number) => Math.max(768, Math.floor(value / 16 + 1e-9) * 16)
  return `${floor16(width)}x${floor16(height)}`
}

/** OpenRouter exposes MAI/GPT Image aspect ratio, but no resolution control. */
export function supportsImageSizeConfiguration(modelId: string, provider: Provider): boolean {
  return supportsImageConfiguration(modelId) && !((isMaiImageModel(modelId) || isGptImageModel(modelId)) && provider === 'openrouter')
}

export function getAspectRatios(modelId: string) {
  if (isGptImageModel(modelId)) return GPT_IMAGE_ASPECT_RATIOS
  if (isMaiImageModel(modelId)) return MAI_ASPECT_RATIOS
  if (modelId === GROK_IMAGE_2_MODEL) return GROK_2_ASPECT_RATIOS
  if (modelId === SEEDREAM_5_0_PRO_MODEL || modelId === SEEDREAM_5_0_LITE_MODEL) return SEEDREAM_ASPECT_RATIOS
  if (modelId === GROK_IMAGE_MODEL) return GROK_ASPECT_RATIOS
  if (modelId === RIVERFLOW_V2_5_PRO_MODEL || modelId === RIVERFLOW_V2_5_FAST_MODEL) return RIVERFLOW_ASPECT_RATIOS
  const base = getBaseModelId(modelId)
  if (base === GEMINI_PRO_IMAGE_MODEL) return PRO_ASPECT_RATIOS
  if (base === GEMINI_FLASH_LITE_IMAGE_MODEL) return LITE_ASPECT_RATIOS
  return FLASH_ASPECT_RATIOS
}

/** The `w:h` ratio closest to width/height; non-numeric entries such as `auto` are skipped. */
export function closestAspectRatio(width: number, height: number, ratios: readonly string[]): string {
  const imgRatio = width / height
  let closest = ratios[0]
  let minDiff = Infinity
  for (const r of ratios) {
    const [w, h] = r.split(':').map(Number)
    if (!Number.isFinite(w) || !Number.isFinite(h) || h === 0) continue
    const diff = Math.abs(imgRatio - w / h)
    if (diff < minDiff) {
      minDiff = diff
      closest = r
    }
  }
  return closest
}

export function getImageSizes(modelId: string, provider?: Provider) {
  if (isGptImageModel(modelId)) return provider === 'openrouter' ? LITE_IMAGE_SIZES : GPT_IMAGE_SIZES
  if (isMaiImageModel(modelId)) return provider === 'openrouter' ? LITE_IMAGE_SIZES : MAI_IMAGE_SIZES
  if (modelId === GROK_IMAGE_MODEL || modelId === GROK_IMAGE_2_MODEL) return GROK_IMAGE_SIZES
  if (modelId === SEEDREAM_5_0_PRO_MODEL) return SEEDREAM_IMAGE_SIZES
  if (modelId === SEEDREAM_5_0_LITE_MODEL) return SEEDREAM_LITE_IMAGE_SIZES
  if (modelId === RIVERFLOW_V2_5_PRO_MODEL) return RIVERFLOW_PRO_IMAGE_SIZES
  if (modelId === RIVERFLOW_V2_5_FAST_MODEL) return RIVERFLOW_FAST_IMAGE_SIZES
  const base = getBaseModelId(modelId)
  if (base === GEMINI_PRO_IMAGE_MODEL || base === GEMINI_NANO_BANANA_2_1_MODEL) return PRO_IMAGE_SIZES
  if (base === GEMINI_FLASH_LITE_IMAGE_MODEL) return LITE_IMAGE_SIZES
  return FLASH_IMAGE_SIZES
}

/** Whether the model accepts explicit output size and aspect-ratio controls. */
export function supportsImageConfiguration(modelId: string): boolean {
  return modelId !== MUSE_IMAGE_MODEL
}

/** Models that do not support Grounding with Google Search for image generation */
const MODELS_WITHOUT_GOOGLE_SEARCH = new Set<string>([
  GEMINI_FLASH_LITE_IMAGE_MODEL,
])

export function supportsGoogleSearch(modelId: string): boolean {
  return !MODELS_WITHOUT_GOOGLE_SEARCH.has(getBaseModelId(modelId))
}

/**
 * Image sizes a provider cannot deliver even when the underlying model lists them.
 * Single source of truth for the 512/4K availability rules used by the UI and
 * by model-switch validation.
 */
export function getUnsupportedImageSizes(provider: Provider): readonly string[] {
  if (provider === 'openrouter') return ['512']
  return []
}

export function isImageSizeSupported(provider: Provider, size: string): boolean {
  return !getUnsupportedImageSizes(provider).includes(size)
}

// Actual output resolutions per aspect ratio and image size
// Source: https://ai.google.dev/gemini-api/docs/image-generation#aspect_ratios_and_image_size
const RESOLUTIONS: Record<string, Record<string, string>> = {
  '1:1':  { '512': '512×512',    '1K': '1024×1024',  '2K': '2048×2048',  '4K': '4096×4096' },
  '1:4':  { '512': '256×1024',   '1K': '512×2048',   '2K': '1024×4096',  '4K': '2048×8192' },
  '1:8':  { '512': '192×1536',   '1K': '384×3072',   '2K': '768×6144',   '4K': '1536×12288' },
  '2:3':  { '512': '424×632',    '1K': '848×1264',   '2K': '1696×2528',  '4K': '3392×5056' },
  '3:2':  { '512': '632×424',    '1K': '1264×848',   '2K': '2528×1696',  '4K': '5056×3392' },
  '3:4':  { '512': '448×600',    '1K': '896×1200',   '2K': '1792×2400',  '4K': '3584×4800' },
  '4:1':  { '512': '1024×256',   '1K': '2048×512',   '2K': '4096×1024',  '4K': '8192×2048' },
  '4:3':  { '512': '600×448',    '1K': '1200×896',   '2K': '2400×1792',  '4K': '4800×3584' },
  '4:5':  { '512': '464×576',    '1K': '928×1152',   '2K': '1856×2304',  '4K': '3712×4608' },
  '5:4':  { '512': '576×464',    '1K': '1152×928',   '2K': '2304×1856',  '4K': '4608×3712' },
  '8:1':  { '512': '1536×192',   '1K': '3072×384',   '2K': '6144×768',   '4K': '12288×1536' },
  '9:16': { '512': '384×688',    '1K': '768×1376',   '2K': '1536×2752',  '4K': '3072×5504' },
  '16:9': { '512': '688×384',    '1K': '1376×768',   '2K': '2752×1536',  '4K': '5504×3072' },
  '21:9': { '512': '792×168',    '1K': '1584×672',   '2K': '3168×1344',  '4K': '6336×2688' },
}

// Output resolutions for Grok Imagine (xAI via OpenRouter)
const GROK_RESOLUTIONS: Record<string, Record<string, string>> = {
  '1:1':    { '1K': '1024×1024',  '2K': '2048×2048' },
  '3:4':    { '1K': '896×1280',   '2K': '1712×2432' },
  '4:3':    { '1K': '1280×896',   '2K': '2432×1712' },
  '9:16':   { '1K': '768×1408',   '2K': '1504×2752' },
  '16:9':   { '1K': '1408×768',   '2K': '2752×1504' },
  '2:3':    { '1K': '864×1296',   '2K': '1664×2496' },
  '3:2':    { '1K': '1296×864',   '2K': '2496×1664' },
  '9:19.5': { '1K': '576×1248',   '2K': '1376×2976' },
  '19.5:9': { '1K': '1248×576',   '2K': '2976×1376' },
  '9:20':   { '1K': '576×1280',   '2K': '1360×3008' },
  '20:9':   { '1K': '1280×576',   '2K': '3008×1360' },
  '1:2':    { '1K': '704×1408',   '2K': '1440×2880' },
  '2:1':    { '1K': '1408×704',   '2K': '2880×1440' },
}

export function getResolution(aspectRatio: string, imageSize: string, modelId?: string, provider?: Provider): string | undefined {
  if (modelId && isGptImageModel(modelId)) {
    return provider === 'openrouter' ? undefined : getGptImageSize(aspectRatio, imageSize)?.replace('x', '×')
  }
  if (modelId && isMaiImageModel(modelId)) {
    return provider === 'openrouter' ? undefined : getMaiImageSize(aspectRatio, imageSize)?.replace('x', '×')
  }
  if (modelId === GROK_IMAGE_MODEL) return GROK_RESOLUTIONS[aspectRatio]?.[imageSize]
  if (modelId === GROK_IMAGE_2_MODEL || modelId === SEEDREAM_5_0_PRO_MODEL || modelId === SEEDREAM_5_0_LITE_MODEL) return undefined
  // Riverflow exposes normalized 1K/2K/4K tiers, not a fixed pixel matrix.
  if (modelId === RIVERFLOW_V2_5_PRO_MODEL || modelId === RIVERFLOW_V2_5_FAST_MODEL) return undefined
  return RESOLUTIONS[aspectRatio]?.[imageSize]
}

/** Maximum reference images accepted by the selected model. */
export function getMaxInputImages(modelId: string): number {
  if (isGptImageModel(modelId)) return 16
  if (isMaiImageModel(modelId)) return 5
  if (modelId === MUSE_IMAGE_MODEL) return 4
  if (modelId === GROK_IMAGE_2_MODEL) return 3
  if (modelId === SEEDREAM_5_0_PRO_MODEL) return 14
  if (modelId === SEEDREAM_5_0_LITE_MODEL) return 14
  if (modelId === RIVERFLOW_V2_5_PRO_MODEL) return 10
  if (modelId === RIVERFLOW_V2_5_FAST_MODEL) return 4
  return 14
}

/** Models served through OpenRouter's dedicated Image API rather than chat completions. */
export function usesOpenRouterImageApi(modelId: string): boolean {
  if (isMaiImageModel(modelId) || isGptImageModel(modelId)) return true
  return modelId === MUSE_IMAGE_MODEL || modelId === GROK_IMAGE_2_MODEL || modelId === SEEDREAM_5_0_PRO_MODEL || modelId === SEEDREAM_5_0_LITE_MODEL || modelId === RIVERFLOW_V2_5_PRO_MODEL || modelId === RIVERFLOW_V2_5_FAST_MODEL
}

export function supportsImageQuality(modelId: string): boolean {
  return modelId === GROK_IMAGE_2_MODEL || isGptImageModel(modelId)
}

export function supportsSeedParameter(modelId: string): boolean {
  return modelId === SEEDREAM_5_0_LITE_MODEL
}

export function isRiverflowModel(modelId: string): boolean {
  return modelId === RIVERFLOW_V2_5_PRO_MODEL || modelId === RIVERFLOW_V2_5_FAST_MODEL
}

export const THINKING_LEVELS = [
  { value: 'MINIMAL', label: 'Minimal' },
  { value: 'HIGH', label: 'High' },
] as const

const NANO_BANANA_2_1_THINKING_LEVELS = [
  THINKING_LEVELS[0],
  { value: 'MEDIUM', label: 'Medium' },
  THINKING_LEVELS[1],
] as const

export function getThinkingLevels(modelId: string) {
  return getBaseModelId(modelId) === GEMINI_NANO_BANANA_2_1_MODEL
    ? NANO_BANANA_2_1_THINKING_LEVELS
    : THINKING_LEVELS
}

// Pricing per million tokens (USD) - standard tier
// Source: https://ai.google.dev/gemini-api/docs/pricing
export const MODEL_PRICING: Record<string, {
  inputText: number
  inputImage?: number
  outputText: number
  outputImage: number
}> = {
  // OpenAI / gateway standard Images API token pricing, verified 2026-10-16.
  [GPT_IMAGE_2_5_FLARE_MODEL]: { inputText: 5, inputImage: 8, outputText: 0, outputImage: 30 },
  [GPT_IMAGE_2_5_SUNBURST_MODEL]: { inputText: 5, inputImage: 8, outputText: 0, outputImage: 30 },
  // OpenRouter Image endpoint pricing / Vercel AI Gateway, verified 2026-10-15.
  [MAI_IMAGE_2_6_MODEL]: { inputText: 5, inputImage: 8, outputText: 0, outputImage: 38 },
  [MAI_IMAGE_2_6_FLASH_MODEL]: { inputText: 1.75, inputImage: 2.5, outputText: 0, outputImage: 19 },
  [GEMINI_NANO_BANANA_2_1_MODEL]: {
    inputText: 1.50,
    outputText: 7.50,
    outputImage: 30.00,
  },
  [GEMINI_FLASH_IMAGE_MODEL]: {
    inputText: 0.50,   // $0.50 per 1M tokens (text/image input)
    outputText: 3.00,   // $3.00 per 1M tokens (text + thinking output)
    outputImage: 60.00, // $60.00 per 1M tokens (image output)
  },
  [GEMINI_PRO_IMAGE_MODEL]: {
    inputText: 2.00,    // $2.00 per 1M tokens (text/image input)
    outputText: 12.00,  // $12.00 per 1M tokens (text + thinking output)
    outputImage: 120.00, // $120.00 per 1M tokens (image output)
  },
  [GEMINI_FLASH_LITE_IMAGE_MODEL]: {
    inputText: 0.25,   // $0.25 per 1M tokens (text/image/video input)
    outputText: 1.50,   // $1.50 per 1M tokens (text + thinking output)
    outputImage: 30.00, // $30.00 per 1M tokens (image output)
  },
}

/** Models that do not accept OpenRouter's output modalities field */
const MODELS_WITHOUT_OUTPUT_MODALITIES = new Set<string>([
  GROK_IMAGE_MODEL,
])

export function supportsOutputModalities(modelId: string): boolean {
  return !MODELS_WITHOUT_OUTPUT_MODALITIES.has(modelId)
}

/** Flat per-image pricing (USD) for models not using token-based pricing */
const FLAT_IMAGE_PRICES: Record<string, Record<string, number>> = {
  [MUSE_IMAGE_MODEL]: {
    '1K': 0.01,
  },
  [GROK_IMAGE_MODEL]: {
    '1K': 0.05, // $0.05/image
    '2K': 0.07, // $0.07/image
  },
  [SEEDREAM_5_0_LITE_MODEL]: {
    '2K': 0.035,
    '4K': 0.035,
  },
  // OpenRouter's current per-endpoint baseline output pricing. Riverflow's final
  // billed amount is returned by the Image API because processing can vary by job.
  [RIVERFLOW_V2_5_PRO_MODEL]: {
    '1K': 0.13,
    '2K': 0.15,
    '4K': 0.17,
  },
  [RIVERFLOW_V2_5_FAST_MODEL]: {
    '1K': 0.019,
    '2K': 0.021,
  },
}

/** Map internal imageSize values to OpenRouter image_size values */
export function toOpenRouterImageSize(size: string): string {
  if (size === '512') return '0.5K'
  return size // '1K', '2K', '4K' are the same
}

// Official image output token counts per model and size
// Source: https://ai.google.dev/gemini-api/docs/pricing
const IMAGE_OUTPUT_TOKENS: Record<string, Record<string, number>> = {
  [GEMINI_NANO_BANANA_2_1_MODEL]: {
    '1K': 1120, // $0.0336/image at $30/1M
    '2K': 1680, // $0.0504/image
    '4K': 3780, // $0.1134/image (pricing page; image guide still lists 2520)
  },
  [GEMINI_FLASH_IMAGE_MODEL]: {
    '512': 747,   // $0.045/image at $60/1M
    '1K':  1120,  // $0.067/image
    '2K':  1680,  // $0.101/image
    '4K':  2520,  // $0.151/image
  },
  [GEMINI_PRO_IMAGE_MODEL]: {
    '1K':  1120,  // $0.134/image at $120/1M (1K and 2K share same count)
    '2K':  1120,  // $0.134/image (same as 1K per Google's pricing)
    '4K':  2000,  // $0.240/image
  },
  [GEMINI_FLASH_LITE_IMAGE_MODEL]: {
    '1K':  1120,  // $0.0336/image at $30/1M
  },
}

/**
 * Estimate image output cost in USD per image (ignores input cost).
 * Based on Gemini output image token pricing.
 */
export function estimateImageOutputCost(
  modelId: string,
  imageSize: string,
  batchSize: number = 1,
  imageQuality?: ImageQuality,
  provider?: Provider,
  aspectRatio: string = '1:1',
): number | undefined {
  if (isGptImageModel(modelId)) {
    if (aspectRatio === 'auto') return undefined
    // OpenRouter does not expose output size: use a labelled square reference estimate.
    const size = provider === 'openrouter' ? '1024x1024' : getGptImageSize(aspectRatio, imageSize)
    if (!size) return undefined
    const [width, height] = size.split('x').map(Number)
    const cost = estimateGptImageOutputCost(width, height, resolveImageQuality(modelId, imageQuality))
    return cost == null ? undefined : cost * batchSize
  }
  // User-provided planning estimates; completed MAI jobs still use returned billing/usage.
  if (isMaiImageModel(modelId)) {
    const price = modelId === MAI_IMAGE_2_6_FLASH_MODEL ? 0.02 : 0.04
    const sizeMultiplier = provider === 'vercel' && imageSize === '1.5K' ? 2 : 1
    return price * sizeMultiplier * batchSize
  }
  // OpenRouter endpoint pricing variants: low_1k $0.04, low_2k $0.06,
  // medium_1k $0.06, medium_2k $0.08. Input references cost $0.01 each
  // and are intentionally excluded because this helper estimates output only.
  if (modelId === GROK_IMAGE_2_MODEL) {
    const prices = imageQuality === 'low'
      ? { '1K': 0.04, '2K': 0.06 }
      : { '1K': 0.06, '2K': 0.08 }
    return (prices[imageSize as keyof typeof prices] ?? prices['1K']) * batchSize
  }

  const flatPrices = FLAT_IMAGE_PRICES[modelId]
  if (flatPrices) {
    return (flatPrices[imageSize] ?? flatPrices['1K'] ?? Object.values(flatPrices)[0] ?? 0) * batchSize
  }
  const base = getBaseModelId(modelId)
  const pricing = MODEL_PRICING[base] ?? MODEL_PRICING[GEMINI_FLASH_IMAGE_MODEL]
  const modelTokens = IMAGE_OUTPUT_TOKENS[base] ?? IMAGE_OUTPUT_TOKENS[GEMINI_FLASH_IMAGE_MODEL]
  const tokens = modelTokens[imageSize] ?? modelTokens['1K']
  return (tokens / 1_000_000) * pricing.outputImage * batchSize
}

/** Estimate image-model cost from returned usage; unknown input splits use the higher image rate. */
export function estimateImageTokenCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number | undefined,
  inputImageTokens?: number,
): number | undefined {
  if (outputTokens == null) return undefined
  const pricing = MODEL_PRICING[modelId]
  const imageTokens = Math.min(inputTokens, Math.max(0, inputImageTokens ?? inputTokens))
  return ((inputTokens - imageTokens) * pricing.inputText
    + imageTokens * (pricing.inputImage ?? pricing.inputText)
    + outputTokens * pricing.outputImage) / 1_000_000
}
