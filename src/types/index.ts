export type Provider = 'gemini' | 'openrouter' | 'vercel'

export type DownloadFormat = 'png' | 'jpg' | 'webp'

export interface ModelOption {
  id: string
  name: string
  description: string
  provider: Provider
}

export interface InputImage {
  id: string
  base64: string
  mimeType: string
}

export interface ReferenceImageResizeRequest {
  id: string
  width: number
  height: number
  targetWidth: number
  targetHeight: number
}

export interface GenerationConfig {
  provider: Provider
  model: string
  aspectRatio?: string
  imageSize?: '512' | '1K' | '1.5K' | '2K' | '4K'
  imageQuality?: 'low' | 'medium'
  seed?: number
  personGeneration?: 'ALLOW_ALL' | 'ALLOW_ADULT' | 'ALLOW_NONE'
  thinkingLevel?: 'MINIMAL' | 'MEDIUM' | 'HIGH'
  googleSearch?: boolean
  webGrounding?: boolean
  batchSize?: number
}

export interface HistoryEntry {
  id: string
  timestamp: number
  prompt: string
  config: GenerationConfig
  imageBase64: string
  imageMimeType: string
  inputImages?: Omit<InputImage, 'id'>[]
  inputImageBase64?: string
  inputImageMimeType?: string
  textResponse?: string
}

export type HistoryViewMode = 'grid' | 'waterfall' | 'list'

export interface HistoryGroup {
  key: string
  entries: HistoryEntry[]
  ordered: HistoryEntry[]
  representative: HistoryEntry
}

export interface UsageInfo {
  promptTokenCount: number
  candidatesTokenCount: number
  thoughtsTokenCount: number
  totalTokenCount: number
  estimatedCost?: number
  /** True when the provider returned the completed job's exact billed cost. */
  costIsExact?: boolean
  elapsedMs?: number
}

export interface GenerationResult {
  imageBase64: string
  imageMimeType: string
  textResponse?: string
  raiFilteredReason?: string
  usage?: UsageInfo
}

export interface BatchResultItem {
  imageBase64?: string
  imageMimeType?: string
  textResponse?: string
  usage?: UsageInfo
  error?: string
}
