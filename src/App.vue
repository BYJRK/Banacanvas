<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useApiKeyStore } from './stores/apiKey'
import { useHistoryStore } from './stores/history'
import { useGemini } from './composables/useGemini'
import { useOpenRouter } from './composables/useOpenRouter'
import { useVercelAI } from './composables/useVercelAI'
import { useTheme } from './composables/useTheme'
import { useI18n } from './composables/useI18n'
import { DEFAULT_MODEL, AVAILABLE_MODELS, getModelsForProvider, getAspectRatios, getImageSizes } from './config/models'
import type { GenerationConfig, ModelOption, HistoryEntry, InputImage, UsageInfo, Provider, DownloadFormat, BatchResultItem } from './types'
import ApiKeyDialog from './components/ApiKeyDialog.vue'
import GenerationPanel from './components/GenerationPanel.vue'
import ParameterPanel from './components/ParameterPanel.vue'
import ImageDisplay from './components/ImageDisplay.vue'
import HistoryPanel from './components/HistoryPanel.vue'
import Toast from './components/Toast.vue'

const apiKeyStore = useApiKeyStore()
const historyStore = useHistoryStore()
const gemini = useGemini()
const openRouter = useOpenRouter()
const vercelAI = useVercelAI()
const { mode: themeMode, cycle: cycleTheme } = useTheme()
const { t, locale, toggleLocale } = useI18n()

const loading = computed(() => gemini.loading.value || openRouter.loading.value || vercelAI.loading.value || batchLoading.value)

function cancelGeneration() {
  gemini.cancel()
  openRouter.cancel()
  vercelAI.cancel()
  batchControllers.forEach((c) => c.abort())
  batchControllers = []
  batchLoading.value = false
}

// Dialog state
const showApiKeyDialog = ref(false)

// Generation state
const prompt = ref('')
const selectedProvider = ref<Provider>(DEFAULT_MODEL.provider)
const selectedModel = ref<ModelOption>(DEFAULT_MODEL)
const config = ref<GenerationConfig>({
  provider: DEFAULT_MODEL.provider,
  model: DEFAULT_MODEL.id,
  aspectRatio: '1:1',
  imageSize: '1K',
  thinkingLevel: 'MINIMAL',
  googleSearch: false,
})
const downloadFormat = ref<DownloadFormat>(
  (localStorage.getItem('banacanvas-download-format') as DownloadFormat) || 'png',
)
watch(downloadFormat, (val) => localStorage.setItem('banacanvas-download-format', val))

// Input images (for image-to-image, max 14)
const inputImages = ref<InputImage[]>([])

// Result
const resultImage = ref<string | undefined>()
const resultMimeType = ref<string | undefined>()
const resultText = ref<string | undefined>()
const resultUsage = ref<UsageInfo | undefined>()
const errorMessage = ref<string | null>(null)

// Batch generation
const batchResults = ref<BatchResultItem[]>([])
const batchProgress = ref<{ current: number; total: number } | null>(null)
const batchLoading = ref(false)
let batchControllers: AbortController[] = []

// Toast
const toasts = ref<{ id: number; message: string; type: 'success' | 'error' | 'info' }[]>([])
let toastId = 0

function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  const id = ++toastId
  toasts.value.push({ id, message, type })
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }, 5000)
}

// History sidebar
const showHistory = ref(false)

// Notification state
const notifyOnEnd = ref(localStorage.getItem('banacanvas-notify-on-end') === 'true')
watch(notifyOnEnd, (val) => {
  localStorage.setItem('banacanvas-notify-on-end', String(val))
  if (val && Notification.permission === 'default') {
    Notification.requestPermission()
  }
})

function sendNotification(success: boolean) {
  if (!notifyOnEnd.value) return
  if (Notification.permission !== 'granted') return
  const title = success ? t('notificationSuccess') : t('notificationError')
  new Notification(title)
}

// On mount: show API key dialog if no key set for any provider
onMounted(() => {
  if (!apiKeyStore.hasGeminiKey && !apiKeyStore.hasOpenRouterKey && !apiKeyStore.hasVercelKey) {
    showApiKeyDialog.value = true
  }
})

// Sync model selection to config
function onModelChange(model: ModelOption) {
  selectedModel.value = model
  const newConfig = { ...config.value, model: model.id, provider: model.provider }

  // Reset imageSize if not supported by new model
  const validSizes = getImageSizes(model.id).map((s) => s.value)
  if (newConfig.imageSize && !validSizes.includes(newConfig.imageSize as any)) {
    newConfig.imageSize = validSizes[0] as GenerationConfig['imageSize']
  }

  // Reset aspectRatio if not supported by new model
  const validRatios = getAspectRatios(model.id) as readonly string[]
  if (newConfig.aspectRatio && !validRatios.includes(newConfig.aspectRatio)) {
    newConfig.aspectRatio = '1:1'
  }

  config.value = newConfig
}

function onProviderChange(provider: Provider) {
  selectedProvider.value = provider
  // Auto-select first model of the new provider
  const models = getModelsForProvider(provider)
  if (models.length > 0) {
    onModelChange(models[0])
  }
}

async function handleGenerate() {
  const provider = selectedModel.value.provider
  if (!apiKeyStore.hasKeyFor(provider)) {
    showApiKeyDialog.value = true
    return
  }

  errorMessage.value = null
  resultImage.value = undefined
  resultMimeType.value = undefined
  resultText.value = undefined
  resultUsage.value = undefined
  batchResults.value = []
  batchProgress.value = null

  const currentConfig: GenerationConfig = { ...config.value, model: selectedModel.value.id, provider }
  const api = provider === 'vercel' ? vercelAI : provider === 'openrouter' ? openRouter : gemini
  const batchSize = currentConfig.batchSize ?? 1

  if (batchSize <= 1) {
    // Single generation — original path
    try {
      const startTime = performance.now()
      let result

      if (inputImages.value.length > 0) {
        result = await api.editImage(inputImages.value, prompt.value, currentConfig)
      } else {
        result = await api.generateImage(prompt.value, currentConfig)
      }

      const elapsedMs = Math.round(performance.now() - startTime)

      resultImage.value = result.imageBase64
      resultMimeType.value = result.imageMimeType
      resultText.value = result.textResponse
      resultUsage.value = result.usage
        ? { ...result.usage, elapsedMs }
        : { promptTokenCount: 0, candidatesTokenCount: 0, thoughtsTokenCount: 0, totalTokenCount: 0, estimatedCost: 0, elapsedMs }

      await historyStore.addEntry({
        prompt: prompt.value,
        config: currentConfig,
        imageBase64: result.imageBase64,
        imageMimeType: result.imageMimeType,
        inputImageBase64: inputImages.value[0]?.base64,
        inputImageMimeType: inputImages.value[0]?.mimeType,
        textResponse: result.textResponse,
      })

      showToast(t('imageGenerated'), 'success')
      sendNotification(true)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      errorMessage.value = msg
      showToast(msg, 'error')
      sendNotification(false)
    }
  } else {
    // Batch generation
    batchLoading.value = true
    batchProgress.value = { current: 0, total: batchSize }
    batchControllers = []
    const startTime = performance.now()
    const tasks = Array.from({ length: batchSize }, () => async () => {
      const ac = new AbortController()
      batchControllers.push(ac)
      try {
        const result = inputImages.value.length > 0
          ? await api.editImage(inputImages.value, prompt.value, currentConfig, ac.signal)
          : await api.generateImage(prompt.value, currentConfig, ac.signal)

        const item: BatchResultItem = {
          imageBase64: result.imageBase64,
          imageMimeType: result.imageMimeType,
          textResponse: result.textResponse,
          usage: result.usage,
        }
        batchResults.value = [...batchResults.value, item]

        await historyStore.addEntry({
          prompt: prompt.value,
          config: currentConfig,
          imageBase64: result.imageBase64,
          imageMimeType: result.imageMimeType,
          inputImageBase64: inputImages.value[0]?.base64,
          inputImageMimeType: inputImages.value[0]?.mimeType,
          textResponse: result.textResponse,
        })
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        batchResults.value = [...batchResults.value, { error: msg }]
      } finally {
        if (batchProgress.value) {
          batchProgress.value = { ...batchProgress.value, current: batchProgress.value.current + 1 }
        }
      }
    })

    await Promise.allSettled(tasks.map((task) => task()))

    const elapsedMs = Math.round(performance.now() - startTime)

    // Aggregate usage for display
    const successCount = batchResults.value.filter((r) => r.imageBase64).length
    const aggregatedUsage: UsageInfo = { promptTokenCount: 0, candidatesTokenCount: 0, thoughtsTokenCount: 0, totalTokenCount: 0, estimatedCost: 0, elapsedMs }
    for (const r of batchResults.value) {
      if (r.usage) {
        aggregatedUsage.promptTokenCount += r.usage.promptTokenCount
        aggregatedUsage.candidatesTokenCount += r.usage.candidatesTokenCount
        aggregatedUsage.thoughtsTokenCount += r.usage.thoughtsTokenCount
        aggregatedUsage.totalTokenCount += r.usage.totalTokenCount
        aggregatedUsage.estimatedCost += r.usage.estimatedCost
      }
    }
    resultUsage.value = aggregatedUsage

    batchLoading.value = false
    batchControllers = []

    const toastMsg = t('batchComplete').replace('{success}', String(successCount)).replace('{total}', String(batchSize))
    if (successCount === batchSize) {
      showToast(toastMsg, 'success')
      sendNotification(true)
    } else if (successCount > 0) {
      showToast(toastMsg, 'info')
      sendNotification(true)
    } else {
      showToast(toastMsg, 'error')
      sendNotification(false)
    }
  }
}

function handleHistorySelect(entry: HistoryEntry) {
  prompt.value = entry.prompt
  const entryProvider = entry.config.provider ?? 'gemini'
  config.value = { ...entry.config, provider: entryProvider }
  selectedProvider.value = entryProvider
  const matchedModel = AVAILABLE_MODELS.find((m) => m.id === entry.config.model)
  selectedModel.value = matchedModel ?? { id: entry.config.model, name: entry.config.model, description: '', provider: entryProvider }
  resultImage.value = entry.imageBase64
  resultMimeType.value = entry.imageMimeType
  resultText.value = entry.textResponse
  if (entry.inputImageBase64 && entry.inputImageMimeType) {
    inputImages.value = [{ id: crypto.randomUUID(), base64: entry.inputImageBase64, mimeType: entry.inputImageMimeType }]
  } else {
    inputImages.value = []
  }
  errorMessage.value = null
  showHistory.value = false
}
</script>

<template>
  <div class="h-screen flex flex-col overflow-hidden">
    <!-- Header -->
    <header class="shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ t('appName') }}</span>
          <span class="text-xs bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 px-1.5 py-0.5 rounded-full font-medium">
            {{ t('beta') }}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <!-- Language toggle -->
          <button
            @click="toggleLocale()"
            class="rounded-lg p-2 text-sm font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer min-w-[36px]"
          >
            {{ locale === 'en' ? '中' : 'EN' }}
          </button>
          <!-- Theme toggle -->
          <button
            @click="cycleTheme()"
            class="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            :title="themeMode === 'system' ? t('themeSystem') : themeMode === 'light' ? t('themeLight') : t('themeDark')"
          >
            <!-- System -->
            <svg v-if="themeMode === 'system'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <!-- Light -->
            <svg v-else-if="themeMode === 'light'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <!-- Dark -->
            <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          </button>
          <!-- History toggle -->
          <button
            @click="showHistory = !showHistory"
            class="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            :title="t('history')"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <!-- Settings -->
          <button
            @click="showApiKeyDialog = true"
            :class="[
              'rounded-lg p-2 transition-colors cursor-pointer',
              apiKeyStore.hasGeminiKey || apiKeyStore.hasOpenRouterKey || apiKeyStore.hasVercelKey
                ? 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                : 'text-red-500 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50',
            ]"
            :title="t('apiKeySettings')"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </button>
        </div>
      </div>
    </header>

    <!-- Main content -->
    <div class="flex-1 flex min-h-0">
      <!-- Left: Controls -->
      <aside class="w-80 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto p-4 flex flex-col gap-6 hidden md:flex">
        <GenerationPanel
          v-model:prompt="prompt"
          v-model:model="selectedModel"
          v-model:provider="selectedProvider"
          v-model:input-images="inputImages"
          :loading="loading"
          @generate="handleGenerate"
          @cancel="cancelGeneration"
          @update:model="onModelChange"
          @provider-change="onProviderChange"
        />
        <hr class="border-gray-200 dark:border-gray-800" />
        <ParameterPanel v-model="config" v-model:download-format="downloadFormat" :model-id="config.model" :provider="selectedProvider" :notify-on-end="notifyOnEnd" @notify-change="notifyOnEnd = $event" />
      </aside>

      <!-- Center: Image display -->
      <main class="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col">
        <!-- Mobile controls (collapsed) -->
        <div class="md:hidden mb-4">
          <GenerationPanel
            v-model:prompt="prompt"
            v-model:model="selectedModel"
            v-model:provider="selectedProvider"
            v-model:input-images="inputImages"
            :loading="loading"
            @generate="handleGenerate"
            @cancel="cancelGeneration"
            @update:model="onModelChange"
            @provider-change="onProviderChange"
          />
        </div>

        <div class="flex-1 flex items-start justify-center">
          <div class="w-full max-w-2xl">
            <ImageDisplay
              :image-base64="resultImage"
              :image-mime-type="resultMimeType"
              :text-response="resultText"
              :error-message="errorMessage"
              :loading="loading"
              :usage="resultUsage"
              :download-format="downloadFormat"
              :batch-results="batchResults"
              :batch-progress="batchProgress"
              @clear="resultImage = undefined; resultMimeType = undefined; resultText = undefined; resultUsage = undefined; errorMessage = null; batchResults = []; batchProgress = null"
            />
          </div>
        </div>
      </main>

      <!-- Right: History sidebar overlay -->
      <Transition name="history-backdrop">
        <div
          v-if="showHistory"
          class="fixed inset-0 z-40 bg-black/40"
          @click="showHistory = false"
        />
      </Transition>
      <Transition name="history-panel">
        <aside
          v-if="showHistory"
          class="fixed right-0 top-0 bottom-0 z-50 w-72 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto p-3 shadow-xl"
        >
          <HistoryPanel @select="handleHistorySelect" />
        </aside>
      </Transition>
    </div>

    <!-- Toasts -->
    <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      <Toast
        v-for="toast in toasts"
        :key="toast.id"
        :message="toast.message"
        :type="toast.type"
        @close="toasts = toasts.filter((t) => t.id !== toast.id)"
      />
    </div>

    <!-- Footer -->
    <footer class="shrink-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-2 text-center text-xs text-gray-400 dark:text-gray-500">
      {{ t('poweredBy') }}
      <a href="https://vite.dev/" target="_blank" rel="noopener noreferrer" class="text-violet-500 hover:text-violet-600 dark:text-violet-400 dark:hover:text-violet-300">Vite</a>
      ·
      <a href="https://vuejs.org/" target="_blank" rel="noopener noreferrer" class="text-violet-500 hover:text-violet-600 dark:text-violet-400 dark:hover:text-violet-300">Vue</a>
      ·
      <a href="https://tailwindcss.com/" target="_blank" rel="noopener noreferrer" class="text-violet-500 hover:text-violet-600 dark:text-violet-400 dark:hover:text-violet-300">Tailwind CSS</a>
      ·
      <a href="https://headlessui.com/" target="_blank" rel="noopener noreferrer" class="text-violet-500 hover:text-violet-600 dark:text-violet-400 dark:hover:text-violet-300">Headless UI</a>
    </footer>

    <!-- API Key Dialog -->
    <ApiKeyDialog :open="showApiKeyDialog" @close="showApiKeyDialog = false" />
  </div>
</template>

<style scoped>
.history-backdrop-enter-active,
.history-backdrop-leave-active {
  transition: opacity 0.25s ease;
}
.history-backdrop-enter-from,
.history-backdrop-leave-to {
  opacity: 0;
}

.history-panel-enter-active,
.history-panel-leave-active {
  transition: transform 0.25s ease;
}
.history-panel-enter-from,
.history-panel-leave-to {
  transform: translateX(100%);
}
</style>
