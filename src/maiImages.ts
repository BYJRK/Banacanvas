import type { InputImage } from './types'

/** MAI accepts JPEG/PNG only; history references are stored as WebP. */
export async function prepareMaiImages(images: InputImage[], signal: AbortSignal): Promise<InputImage[]> {
  return Promise.all(images.map(async (image) => {
    signal.throwIfAborted()
    if (image.mimeType === 'image/png' || image.mimeType === 'image/jpeg') return image
    const bytes = Uint8Array.from(atob(image.base64), (c) => c.charCodeAt(0))
    const bitmap = await createImageBitmap(new Blob([bytes], { type: image.mimeType }))
    try {
      signal.throwIfAborted()
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Unable to convert reference image to PNG')
      context.drawImage(bitmap, 0, 0)
      return { ...image, mimeType: 'image/png', base64: canvas.toDataURL('image/png').split(',')[1] }
    } finally {
      bitmap.close()
    }
  }))
}
