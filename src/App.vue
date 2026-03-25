<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useApiKeyStore } from './stores/apiKey'
import { useHistoryStore } from './stores/history'
import { useGemini } from './composables/useGemini'
import { DEFAULT_MODEL, getAspectRatios, getImageSizes } from './config/models'
import type { GenerationConfig, ModelOption, HistoryEntry } from './types'
import ApiKeyDialog from './components/ApiKeyDialog.vue'
import GenerationPanel from './components/GenerationPanel.vue'
import ParameterPanel from './components/ParameterPanel.vue'
import ImageDisplay from './components/ImageDisplay.vue'
import HistoryPanel from './components/HistoryPanel.vue'
import Toast from './components/Toast.vue'

const apiKeyStore = useApiKeyStore()
const historyStore = useHistoryStore()
const { loading, generateImage, editImage, cancel } = useGemini()

// Dialog state
const showApiKeyDialog = ref(false)

// Generation state
const prompt = ref('')
const selectedModel = ref<ModelOption>(DEFAULT_MODEL)
const config = ref<GenerationConfig>({
  model: DEFAULT_MODEL.id,
  aspectRatio: '1:1',
  imageSize: '1K',
  thinkingLevel: 'MINIMAL',
  googleSearch: false,
})

// Input image (for image-to-image)
const inputImage = ref<{ base64: string; mimeType: string } | null>(null)

// Result
const resultImage = ref<string | undefined>()
const resultMimeType = ref<string | undefined>()
const resultText = ref<string | undefined>()
const errorMessage = ref<string | null>(null)

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

// On mount: show API key dialog if no key set
onMounted(() => {
  if (!apiKeyStore.hasKey) {
    showApiKeyDialog.value = true
  }
})

// Sync model selection to config
function onModelChange(model: ModelOption) {
  selectedModel.value = model
  const newConfig = { ...config.value, model: model.id }

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

async function handleGenerate() {
  if (!apiKeyStore.hasKey) {
    showApiKeyDialog.value = true
    return
  }

  errorMessage.value = null
  resultImage.value = undefined
  resultMimeType.value = undefined
  resultText.value = undefined

  try {
    const currentConfig: GenerationConfig = { ...config.value, model: selectedModel.value.id }
    let result

    if (inputImage.value) {
      result = await editImage(
        inputImage.value.base64,
        inputImage.value.mimeType,
        prompt.value,
        currentConfig,
      )
    } else {
      result = await generateImage(prompt.value, currentConfig)
    }

    resultImage.value = result.imageBase64
    resultMimeType.value = result.imageMimeType
    resultText.value = result.textResponse

    // Save to history
    historyStore.addEntry({
      prompt: prompt.value,
      config: currentConfig,
      imageBase64: result.imageBase64,
      imageMimeType: result.imageMimeType,
      inputImageBase64: inputImage.value?.base64,
      inputImageMimeType: inputImage.value?.mimeType,
      textResponse: result.textResponse,
    })

    showToast('Image generated!', 'success')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    errorMessage.value = msg
    showToast(msg, 'error')
  }
}

function handleHistorySelect(entry: HistoryEntry) {
  prompt.value = entry.prompt
  config.value = { ...entry.config }
  selectedModel.value =
    { id: entry.config.model, name: entry.config.model, description: '' }
  resultImage.value = entry.imageBase64
  resultMimeType.value = entry.imageMimeType
  resultText.value = entry.textResponse
  if (entry.inputImageBase64 && entry.inputImageMimeType) {
    inputImage.value = { base64: entry.inputImageBase64, mimeType: entry.inputImageMimeType }
  } else {
    inputImage.value = null
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
          <span class="text-lg font-bold text-gray-900 dark:text-gray-100">🍌 Nano Banana</span>
          <span class="text-xs bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 px-1.5 py-0.5 rounded-full font-medium">
            beta
          </span>
        </div>
        <div class="flex items-center gap-2">
          <!-- History toggle -->
          <button
            @click="showHistory = !showHistory"
            class="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            title="History"
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
              apiKeyStore.hasKey
                ? 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                : 'text-red-500 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50',
            ]"
            title="API Key Settings"
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
          :loading="loading"
          :has-input-image="!!inputImage"
          @generate="handleGenerate"
          @cancel="cancel"
          @image-selected="inputImage = $event"
          @clear-image="inputImage = null"
          @update:model="onModelChange"
        />
        <hr class="border-gray-200 dark:border-gray-800" />
        <ParameterPanel v-model="config" :model-id="config.model" />
      </aside>

      <!-- Center: Image display -->
      <main class="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col">
        <!-- Mobile controls (collapsed) -->
        <div class="md:hidden mb-4">
          <GenerationPanel
            v-model:prompt="prompt"
            v-model:model="selectedModel"
            :loading="loading"
            :has-input-image="!!inputImage"
            @generate="handleGenerate"
            @cancel="cancel"
            @image-selected="inputImage = $event"
            @clear-image="inputImage = null"
            @update:model="onModelChange"
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
              @clear="resultImage = undefined; resultMimeType = undefined; resultText = undefined; errorMessage = null"
            />
          </div>
        </div>
      </main>

      <!-- Right: History sidebar -->
      <aside
        v-if="showHistory"
        class="w-64 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto p-3"
      >
        <HistoryPanel @select="handleHistorySelect" />
      </aside>
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
      Powered by
      <a href="https://ai.google.dev/" target="_blank" rel="noopener noreferrer" class="text-violet-500 hover:text-violet-600 dark:text-violet-400 dark:hover:text-violet-300">Google Gemini</a>
      ·
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
