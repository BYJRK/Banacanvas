import type { HistoryEntry, InputImage } from './types'

export function getHistoryInputImages(entry: Pick<HistoryEntry, 'inputImages' | 'inputImageBase64' | 'inputImageMimeType'>): Omit<InputImage, 'id'>[] {
  if (entry.inputImages) return entry.inputImages
  if (entry.inputImageBase64 && entry.inputImageMimeType) {
    return [{ base64: entry.inputImageBase64, mimeType: entry.inputImageMimeType }]
  }
  return []
}
