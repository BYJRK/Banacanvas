export interface ModelOption {
  id: string
  name: string
  description: string
}

export interface InputImage {
  id: string
  base64: string
  mimeType: string
}

export interface GenerationConfig {
  model: string
  aspectRatio?: string
  imageSize?: '512' | '1K' | '2K' | '4K'
  personGeneration?: 'ALLOW_ALL' | 'ALLOW_ADULT' | 'ALLOW_NONE'
  thinkingLevel?: 'MINIMAL' | 'HIGH'
  googleSearch?: boolean
}

export interface HistoryEntry {
  id: string
  timestamp: number
  prompt: string
  config: GenerationConfig
  imageBase64: string
  imageMimeType: string
  inputImageBase64?: string
  inputImageMimeType?: string
  textResponse?: string
}

export interface UsageInfo {
  promptTokenCount: number
  candidatesTokenCount: number
  thoughtsTokenCount: number
  totalTokenCount: number
  estimatedCost: number
}

export interface GenerationResult {
  imageBase64: string
  imageMimeType: string
  textResponse?: string
  raiFilteredReason?: string
  usage?: UsageInfo
}
