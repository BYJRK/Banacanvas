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

export const ASPECT_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9'] as const

export const IMAGE_SIZES = [
  { value: '512', label: '512px' },
  { value: '1K', label: '1K' },
  { value: '2K', label: '2K' },
  { value: '4K', label: '4K' },
] as const

export const THINKING_LEVELS = [
  { value: 'MINIMAL', label: 'Minimal' },
  { value: 'HIGH', label: 'High' },
] as const
