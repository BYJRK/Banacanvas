import type { ModelOption, Provider } from '../types'

export const AVAILABLE_MODELS: ModelOption[] = [
  // Gemini Direct API
  {
    id: 'gemini-3.1-flash-image-preview',
    name: 'Nano Banana 2',
    description: 'Best balance of performance & cost. Supports 512–4K, thinking, Google Search.',
    provider: 'gemini',
  },
  {
    id: 'gemini-3-pro-image-preview',
    name: 'Nano Banana Pro',
    description: 'Professional quality. Advanced reasoning & text rendering.',
    provider: 'gemini',
  },
  // OpenRouter
  {
    id: 'google/gemini-3.1-flash-image-preview',
    name: 'Nano Banana 2',
    description: 'Gemini Flash via OpenRouter. Supports aspect ratio & image size.',
    provider: 'openrouter',
  },
  {
    id: 'google/gemini-3-pro-image-preview',
    name: 'Nano Banana Pro',
    description: 'Gemini Pro via OpenRouter. Professional quality.',
    provider: 'openrouter',
  },
  // Vercel AI Gateway
  {
    id: 'google/gemini-3.1-flash-image-preview',
    name: 'Nano Banana 2',
    description: 'Gemini Flash via Vercel AI Gateway. Fast image generation.',
    provider: 'vercel',
  },
  {
    id: 'google/gemini-3-pro-image',
    name: 'Nano Banana Pro',
    description: 'Gemini Pro via Vercel AI Gateway. Professional quality.',
    provider: 'vercel',
  },
]

export const DEFAULT_MODEL = AVAILABLE_MODELS[0]

export function getModelsForProvider(provider: Provider): ModelOption[] {
  return AVAILABLE_MODELS.filter((m) => m.provider === provider)
}

/** Strip provider prefix to get the base Gemini model ID for config lookups */
export function getBaseModelId(modelId: string): string {
  let base = modelId.startsWith('google/') ? modelId.replace('google/', '') : modelId
  // Map Vercel AI Gateway model IDs to canonical config IDs
  const vercelAliases: Record<string, string> = {
    'gemini-3-pro-image': 'gemini-3-pro-image-preview',
  }
  base = vercelAliases[base] ?? base
  return base
}

// Aspect ratios supported per model
const FLASH_ASPECT_RATIOS = [
  '1:1', '1:4', '1:8', '2:3', '3:2', '3:4', '4:1', '4:3', '4:5', '5:4', '8:1', '9:16', '16:9', '21:9',
] as const

const PRO_ASPECT_RATIOS = [
  '1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9',
] as const

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

export function getAspectRatios(modelId: string) {
  const base = getBaseModelId(modelId)
  return base === 'gemini-3-pro-image-preview' ? PRO_ASPECT_RATIOS : FLASH_ASPECT_RATIOS
}

export function getImageSizes(modelId: string) {
  const base = getBaseModelId(modelId)
  return base === 'gemini-3-pro-image-preview' ? PRO_IMAGE_SIZES : FLASH_IMAGE_SIZES
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

export function getResolution(aspectRatio: string, imageSize: string): string | undefined {
  return RESOLUTIONS[aspectRatio]?.[imageSize]
}

export const THINKING_LEVELS = [
  { value: 'MINIMAL', label: 'Minimal' },
  { value: 'HIGH', label: 'High' },
] as const

// Pricing per million tokens (USD) - standard tier
// Source: https://ai.google.dev/gemini-api/docs/pricing
export const MODEL_PRICING: Record<string, {
  inputText: number
  outputText: number
  outputImage: number
}> = {
  'gemini-3.1-flash-image-preview': {
    inputText: 0.50,   // $0.50 per 1M tokens (text/image input)
    outputText: 3.00,   // $3.00 per 1M tokens (text + thinking output)
    outputImage: 60.00, // $60.00 per 1M tokens (image output)
  },
  'gemini-3-pro-image-preview': {
    inputText: 2.00,    // $2.00 per 1M tokens (text/image input)
    outputText: 12.00,  // $12.00 per 1M tokens (text + thinking output)
    outputImage: 120.00, // $120.00 per 1M tokens (image output)
  },
}

/** Map internal imageSize values to OpenRouter image_size values */
export function toOpenRouterImageSize(size: string): string {
  if (size === '512') return '0.5K'
  return size // '1K', '2K', '4K' are the same
}
