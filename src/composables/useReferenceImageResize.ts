import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import type { InputImage, ReferenceImageResizeRequest } from '../types'
import { useI18n } from './useI18n'

const MAX_DIMENSION = 2000
const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const STORAGE_KEY = 'banacanvas-resize-as-png'

export function useReferenceImageResize(
  images: Ref<InputImage[]>,
  onError: (message: string) => void,
) {
  const { t } = useI18n()
  const resizeAsPng = ref(false)
  try {
    resizeAsPng.value = localStorage.getItem(STORAGE_KEY) === 'true'
  } catch { /* Storage may be unavailable. */ }
  watch(resizeAsPng, (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(value))
    } catch { /* Keep the preference for this session. */ }
  })

  const request = ref<ReferenceImageResizeRequest | null>(null)
  const resizingIds = ref(new Set<string>())
  const pendingCount = ref(0)
  const busy = computed(() => pendingCount.value > 0)
  let queue = Promise.resolve()
  let resolveDecision: ((resize: boolean) => void) | null = null
  let disposed = false

  function decide(resize: boolean) {
    request.value = null
    resolveDecision?.(resize)
    resolveDecision = null
  }

  function contains(image: InputImage) {
    return images.value.some((item) => item.id === image.id && item.base64 === image.base64)
  }

  async function process(image: InputImage) {
    if (disposed || !contains(image)) return
    const source = new Image()
    try {
      await new Promise<void>((resolve, reject) => {
        source.onload = () => resolve()
        source.onerror = () => reject(new Error(t('referenceImageDecodeFailed')))
        source.src = `data:${image.mimeType};base64,${image.base64}`
      })
      if (disposed || !contains(image)) return
      const width = source.naturalWidth
      const height = source.naturalHeight
      if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) return
      const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
      const targetWidth = Math.max(1, Math.floor(width * scale))
      const targetHeight = Math.max(1, Math.floor(height * scale))
      const shouldResize = await new Promise<boolean>((resolve) => {
        resolveDecision = resolve
        request.value = { id: image.id, width, height, targetWidth, targetHeight }
      })
      if (!shouldResize || disposed || !contains(image)) return

      const mimeType = resizeAsPng.value ? 'image/png' : image.mimeType
      resizingIds.value = new Set([...resizingIds.value, image.id])
      // Let the thumbnail overlay paint before synchronous canvas drawing.
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      if (disposed || !contains(image)) return
      const canvas = document.createElement('canvas')
      canvas.width = targetWidth
      canvas.height = targetHeight
      try {
        const context = canvas.getContext('2d')
        if (!context) throw new Error(t('referenceImageResizeFailed'))
        context.imageSmoothingEnabled = true
        context.imageSmoothingQuality = 'high'
        context.drawImage(source, 0, 0, targetWidth, targetHeight)
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((result) => {
            if (result) resolve(result)
            else reject(new Error(t('referenceImageResizeFailed')))
          }, mimeType, 0.92)
        })
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = () => reject(new Error(t('referenceImageResizeFailed')))
          reader.readAsDataURL(blob)
        })
        if (!disposed && contains(image)) {
          images.value = images.value.map((item) => item.id === image.id
            ? { ...item, base64: dataUrl.slice(dataUrl.indexOf(',') + 1), mimeType: blob.type }
            : item)
        }
      } finally {
        canvas.width = canvas.height = 0
      }
    } catch (e: unknown) {
      if (!disposed && contains(image)) {
        onError(e instanceof Error ? e.message : String(e))
      }
    } finally {
      source.onload = source.onerror = null
      source.src = ''
      const ids = new Set(resizingIds.value)
      ids.delete(image.id)
      resizingIds.value = ids
    }
  }

  watch(() => images.value.map((image) => image.id), (ids, previousIds) => {
    if (request.value && !ids.includes(request.value.id)) decide(false)
    const previous = new Set(previousIds)
    for (const image of images.value) {
      if (previous.has(image.id) || !SUPPORTED_TYPES.has(image.mimeType)) continue
      pendingCount.value++
      queue = queue.then(() => process(image)).finally(() => { pendingCount.value-- })
    }
  }, { flush: 'sync' })

  onBeforeUnmount(() => {
    disposed = true
    decide(false)
  })

  return { resizeAsPng, request, resizingIds, busy, decide }
}
