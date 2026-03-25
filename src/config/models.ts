import type { ModelOption } from '../types'

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: 'gemini-3.1-flash-image-preview',
    name: 'Nano Banana 2',
    description: 'Best balance of performance & cost. Supports 512–4K, thinking, Google Search.',
  },
  {
    id: 'gemini-3-pro-image-preview',
    name: 'Nano Banana Pro',
    description: 'Professional quality. Advanced reasoning & text rendering.',
  },
]

export const DEFAULT_MODEL = AVAILABLE_MODELS[0]

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
  return modelId === 'gemini-3-pro-image-preview' ? PRO_ASPECT_RATIOS : FLASH_ASPECT_RATIOS
}

export function getImageSizes(modelId: string) {
  return modelId === 'gemini-3-pro-image-preview' ? PRO_IMAGE_SIZES : FLASH_IMAGE_SIZES
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
