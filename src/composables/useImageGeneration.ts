import { ref, shallowRef, computed } from 'vue'
import { useHistoryStore } from '../stores/history'
import { useGemini } from './useGemini'
import { useOpenRouter } from './useOpenRouter'
import { useVercelAI } from './useVercelAI'
import { useI18n } from './useI18n'
import { backfillHistoryDownloadNames, getHistoryImageIdentity, getImageDownloadName } from '../imageDownload'
import type { BatchResultItem, GenerationConfig, HistoryEntry, ImageIdentity, InputImage, Provider, ToastType, UsageInfo } from '../types'

export interface GenerationRequest {
  prompt: string
  config: GenerationConfig
  inputImages: InputImage[]
}

interface ImageGenerationOptions {
  toast: (message: string, type: ToastType) => void
  notify: (success: boolean) => void
}

/** Runs single/batch generations across providers and owns the displayed result state. */
export function useImageGeneration({ toast, notify }: ImageGenerationOptions) {
  const historyStore = useHistoryStore()
  const { t } = useI18n()
  const providers = {
    gemini: useGemini(),
    openrouter: useOpenRouter(),
    vercel: useVercelAI(),
  } satisfies Record<Provider, unknown>

  const resultImage = ref<string | undefined>()
  const resultIdentity = ref<ImageIdentity | undefined>()
  const resultMimeType = ref<string | undefined>()
  const resultText = ref<string | undefined>()
  const resultUsage = ref<UsageInfo | undefined>()
  const errorMessage = ref<string | null>(null)

  const batchResults = ref<BatchResultItem[]>([])
  const batchProgress = ref<{ current: number; total: number } | null>(null)
  const batchLoading = ref(false)
  let batchControllers: AbortController[] = []
  let userCancelled = false
  const singleRunning = shallowRef(false)
  const historyWrites = shallowRef(0)
  const unsavedHistory = shallowRef<HistoryEntry[]>([])
  const lastSaveError = shallowRef('')
  const savingHistory = computed(() => historyWrites.value > 0)
  const historySaveError = computed(() => unsavedHistory.value.length > 0
    ? t('historySaveFailed', { count: unsavedHistory.value.length, error: lastSaveError.value })
    : null)

  const loading = computed(() => singleRunning.value || savingHistory.value || batchLoading.value
    || Object.values(providers).some((api) => api.loading.value))

  function clearResult() {
    resultImage.value = undefined
    resultIdentity.value = undefined
    resultMimeType.value = undefined
    resultText.value = undefined
    resultUsage.value = undefined
    errorMessage.value = null
    batchResults.value = []
    batchProgress.value = null
    unsavedHistory.value = []
    lastSaveError.value = ''
  }

  function cancel() {
    userCancelled = true
    for (const api of Object.values(providers)) api.cancel()
    for (const c of batchControllers) {
      try { c.abort() } catch { /* ignore */ }
    }
    batchControllers = []
    batchLoading.value = false
    batchProgress.value = null
  }

  function describeSaveError(e: unknown) {
    return e instanceof Error && e.name === 'QuotaExceededError'
      ? t('historyStorageFull')
      : e instanceof Error ? e.message : String(e)
  }

  async function saveToHistory(request: GenerationRequest, result: { imageBase64: string; imageMimeType: string; textResponse?: string }, identity: ImageIdentity) {
    const entry = {
      ...identity,
      prompt: request.prompt,
      config: { ...request.config },
      imageBase64: result.imageBase64,
      imageMimeType: result.imageMimeType,
      inputImages: request.inputImages.map(({ base64, mimeType }) => ({ base64, mimeType })),
      textResponse: result.textResponse,
    }
    historyWrites.value++
    try {
      await historyStore.addEntry(entry)
    } catch (e: unknown) {
      unsavedHistory.value = [...unsavedHistory.value, entry]
      lastSaveError.value = describeSaveError(e)
    } finally {
      historyWrites.value--
    }
  }

  /** Retry persistence only; generated images must never trigger another paid API call. */
  async function retrySaveHistory() {
    if (loading.value || unsavedHistory.value.length === 0) return
    historyWrites.value++
    try {
      for (const entry of unsavedHistory.value) {
        try {
          await historyStore.addEntry(entry)
          unsavedHistory.value = unsavedHistory.value.filter((pending) => pending !== entry)
        } catch (e: unknown) {
          lastSaveError.value = describeSaveError(e)
        }
      }
      toast(historySaveError.value ?? t('historySaveSuccess'), historySaveError.value ? 'error' : 'success')
    } finally {
      historyWrites.value--
    }
  }

  async function generate(request: GenerationRequest) {
    clearResult()
    userCancelled = false
    const batchSize = request.config.batchSize ?? 1
    if (batchSize <= 1) await runSingle(request)
    else await runBatch(request, batchSize)
  }

  async function runSingle(request: GenerationRequest) {
    singleRunning.value = true
    const api = providers[request.config.provider]
    try {
      const startTime = performance.now()
      const result = request.inputImages.length > 0
        ? await api.editImage(request.inputImages, request.prompt, request.config)
        : await api.generateImage(request.prompt, request.config)
      const elapsedMs = Math.round(performance.now() - startTime)

      resultImage.value = result.imageBase64
      const timestamp = Date.now()
      const id = crypto.randomUUID()
      const identity = {
        id, timestamp,
        batch: { id, timestamp, sequence: 1 },
        downloadName: getImageDownloadName(request.config, timestamp),
      }
      resultIdentity.value = identity
      resultMimeType.value = result.imageMimeType
      resultText.value = result.textResponse
      resultUsage.value = result.usage
        ? { ...result.usage, elapsedMs }
        : { promptTokenCount: 0, candidatesTokenCount: 0, thoughtsTokenCount: 0, totalTokenCount: 0, elapsedMs }

      await saveToHistory(request, result, identity)

      if (userCancelled) return
      toast(historySaveError.value ?? t('imageGenerated'), historySaveError.value ? 'info' : 'success')
      notify(true)
    } catch (e: unknown) {
      if (userCancelled) return
      const msg = e instanceof Error ? e.message : String(e)
      errorMessage.value = msg
      toast(msg, 'error')
      notify(false)
    } finally {
      singleRunning.value = false
    }
  }

  async function runBatch(request: GenerationRequest, batchSize: number) {
    const api = providers[request.config.provider]
    batchLoading.value = true
    batchProgress.value = { current: 0, total: batchSize }
    batchControllers = []
    const startTime = performance.now()
    const batchTimestamp = Date.now()
    const batchId = crypto.randomUUID()
    try {
      const runOne = async (_: unknown, index: number) => {
        const ac = new AbortController()
        batchControllers.push(ac)
        try {
          const result = request.inputImages.length > 0
            ? await api.editImage(request.inputImages, request.prompt, request.config, ac.signal)
            : await api.generateImage(request.prompt, request.config, ac.signal)

          const identity = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            batch: { id: batchId, timestamp: batchTimestamp, sequence: index + 1 },
            downloadName: getImageDownloadName(request.config, batchTimestamp, index + 1),
          }
          batchResults.value = [...batchResults.value, {
            identity,
            imageBase64: result.imageBase64,
            imageMimeType: result.imageMimeType,
            textResponse: result.textResponse,
            usage: result.usage,
          }]

          await saveToHistory(request, result, identity)
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e)
          batchResults.value = [...batchResults.value, { error: msg }]
        } finally {
          if (batchProgress.value) {
            batchProgress.value = { ...batchProgress.value, current: batchProgress.value.current + 1 }
          }
        }
      }

      await Promise.allSettled(Array.from({ length: batchSize }, runOne))

      resultUsage.value = aggregateUsage(batchResults.value, Math.round(performance.now() - startTime))

      if (userCancelled) return

      const successCount = batchResults.value.filter((r) => r.imageBase64).length
      const message = t('batchComplete').replace('{success}', String(successCount)).replace('{total}', String(batchSize))
      if (historySaveError.value) toast(historySaveError.value, 'error')
      if (successCount === batchSize) {
        toast(message, 'success')
        notify(true)
      } else if (successCount > 0) {
        toast(message, 'info')
        notify(true)
      } else {
        toast(message, 'error')
        notify(false)
      }
    } finally {
      batchLoading.value = false
      batchControllers = []
    }
  }

  /** Display one history entry as a single result, or several as a batch gallery. */
  function showHistoryEntries(entries: HistoryEntry[]) {
    clearResult()
    let selected = entries
    if (entries.some((entry) => !entry.downloadName && !entry.batch)) {
      // Use the whole history even when selecting just one image from an old batch.
      const allEntries = new Map(historyStore.entries.map((entry) => [entry.id, entry]))
      for (const entry of entries) if (!allEntries.has(entry.id)) allEntries.set(entry.id, entry)
      const restored = new Map(backfillHistoryDownloadNames([...allEntries.values()]).map((entry) => [entry.id, entry]))
      selected = entries.map((entry) => restored.get(entry.id)!)
    }
    if (selected.length === 1) {
      const [entry] = selected
      resultImage.value = entry.imageBase64
      resultIdentity.value = getHistoryImageIdentity(entry)
      resultMimeType.value = entry.imageMimeType
      resultText.value = entry.textResponse
      return
    }
    batchResults.value = selected.map((e) => ({
      identity: getHistoryImageIdentity(e),
      imageBase64: e.imageBase64,
      imageMimeType: e.imageMimeType,
      textResponse: e.textResponse,
    }))
  }

  return {
    loading,
    resultImage,
    resultIdentity,
    resultMimeType,
    resultText,
    resultUsage,
    errorMessage,
    historySaveError,
    savingHistory,
    retrySaveHistory,
    batchResults,
    batchProgress,
    generate,
    cancel,
    clearResult,
    showHistoryEntries,
  }
}

function aggregateUsage(results: BatchResultItem[], elapsedMs: number): UsageInfo {
  const usage: UsageInfo = { promptTokenCount: 0, candidatesTokenCount: 0, thoughtsTokenCount: 0, totalTokenCount: 0, estimatedCost: 0, elapsedMs }
  for (const r of results) {
    if (r.usage) {
      usage.promptTokenCount += r.usage.promptTokenCount
      usage.candidatesTokenCount += r.usage.candidatesTokenCount
      usage.thoughtsTokenCount += r.usage.thoughtsTokenCount
      usage.totalTokenCount += r.usage.totalTokenCount
      usage.estimatedCost = usage.estimatedCost != null && r.usage.estimatedCost != null
        ? usage.estimatedCost + r.usage.estimatedCost
        : undefined
    } else if (r.imageBase64) {
      usage.estimatedCost = undefined
    }
  }
  return usage
}
