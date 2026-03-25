<script setup lang="ts">
import { ref } from 'vue'
import type { UsageInfo } from '../types'
import { useI18n } from '../composables/useI18n'

const props = defineProps<{
  imageBase64?: string
  imageMimeType?: string
  textResponse?: string
  errorMessage?: string | null
  loading?: boolean
  usage?: UsageInfo
}>()

const emit = defineEmits<{
  (e: 'clear'): void
}>()

const showFullscreen = ref(false)
const { t } = useI18n()

const imageUrl = () => {
  if (!props.imageBase64 || !props.imageMimeType) return ''
  return `data:${props.imageMimeType};base64,${props.imageBase64}`
}

function download() {
  if (!props.imageBase64 || !props.imageMimeType) return
  const link = document.createElement('a')
  link.href = imageUrl()
  const ext = props.imageMimeType.includes('png') ? 'png' : 'jpg'
  link.download = `nano-banana-${Date.now()}.${ext}`
  link.click()
}
</script>

<template>
  <!-- Loading state -->
  <div
    v-if="loading"
    class="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-violet-300 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/20 p-16"
  >
    <svg class="animate-spin h-10 w-10 text-violet-500 mb-4" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
    <p class="text-sm text-violet-600 dark:text-violet-400 font-medium">{{ t('generatingImage') }}</p>
  </div>

  <!-- Error state -->
  <div
    v-else-if="errorMessage"
    class="flex items-center justify-center rounded-xl border-2 border-dashed border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-8"
  >
    <div class="text-center">
      <p class="text-red-600 dark:text-red-400 text-sm font-medium">{{ errorMessage }}</p>
    </div>
  </div>

  <!-- Image display -->
  <div v-else-if="imageBase64" class="flex flex-col gap-3">
    <div class="relative group">
      <img
        :src="imageUrl()"
        alt="Generated image"
        class="w-full rounded-xl shadow-lg cursor-pointer"
        @click="showFullscreen = true"
      />
      <!-- Overlay controls -->
      <div class="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          @click="download"
          class="rounded-lg bg-black/60 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-white hover:bg-black/80 transition-colors cursor-pointer"
        >
          {{ t('download') }}
        </button>
        <button
          @click="showFullscreen = true"
          class="rounded-lg bg-black/60 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-white hover:bg-black/80 transition-colors cursor-pointer"
        >
          {{ t('fullscreen') }}
        </button>
        <button
          @click="emit('clear')"
          class="rounded-lg bg-black/60 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600/80 transition-colors cursor-pointer"
        >
          {{ t('clear') }}
        </button>
      </div>
    </div>

    <!-- Text response -->
    <div
      v-if="textResponse"
      class="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3 text-sm text-gray-700 dark:text-gray-300"
    >
      {{ textResponse }}
    </div>

    <!-- Usage & cost info -->
    <div
      v-if="usage"
      class="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-gray-50 dark:bg-gray-800/50 px-3 py-2 text-xs text-gray-500 dark:text-gray-400"
    >
      <span :title="t('inputTokens')">⬆ {{ usage.promptTokenCount.toLocaleString() }}</span>
      <span :title="t('outputTokens')">⬇ {{ usage.candidatesTokenCount.toLocaleString() }}</span>
      <span v-if="usage.thoughtsTokenCount" :title="t('thinkingTokens')">💭 {{ usage.thoughtsTokenCount.toLocaleString() }}</span>
      <span :title="t('totalTokens')">Σ {{ usage.totalTokenCount.toLocaleString() }}</span>
      <span class="ml-auto font-medium text-violet-600 dark:text-violet-400" :title="t('estimatedCost')">
        ~${{ usage.estimatedCost < 0.01 ? usage.estimatedCost.toFixed(4) : usage.estimatedCost.toFixed(3) }}
      </span>
    </div>
  </div>

  <!-- Empty state -->
  <div
    v-else
    class="flex items-center justify-center rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-800 p-12"
  >
    <div class="text-center text-gray-400 dark:text-gray-600">
      <svg class="w-16 h-16 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <p class="text-sm">{{ t('emptyState') }}</p>
    </div>
  </div>

  <!-- Fullscreen overlay -->
  <Teleport to="body">
    <div
      v-if="showFullscreen && imageBase64"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 cursor-pointer"
      @click="showFullscreen = false"
    >
      <img
        :src="imageUrl()"
        alt="Generated image fullscreen"
        class="max-w-[95vw] max-h-[95vh] object-contain"
        @click.stop
      />
      <button
        @click="showFullscreen = false"
        class="absolute top-4 right-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/30 transition-colors cursor-pointer"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </Teleport>
</template>
