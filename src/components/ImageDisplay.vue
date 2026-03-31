<script setup lang="ts">
import { ref } from 'vue'
import type { UsageInfo, DownloadFormat, BatchResultItem } from '../types'
import { useI18n } from '../composables/useI18n'

const props = defineProps<{
  imageBase64?: string
  imageMimeType?: string
  textResponse?: string
  errorMessage?: string | null
  loading?: boolean
  usage?: UsageInfo
  downloadFormat?: DownloadFormat
  batchResults?: BatchResultItem[]
  batchProgress?: { current: number; total: number } | null
}>()

const emit = defineEmits<{
  (e: 'clear'): void
}>()

const showFullscreen = ref(false)
const fullscreenImage = ref<{ base64: string; mimeType: string } | null>(null)
const { t } = useI18n()

const imageUrl = () => {
  if (!props.imageBase64 || !props.imageMimeType) return ''
  return `data:${props.imageMimeType};base64,${props.imageBase64}`
}

const FORMAT_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
}

function download() {
  if (!props.imageBase64 || !props.imageMimeType) return
  downloadImage(props.imageBase64, props.imageMimeType)
}

function downloadImage(base64: string, mimeType: string) {
  const fmt = props.downloadFormat ?? 'png'
  const targetMime = FORMAT_MIME[fmt]
  const dataUrl = `data:${mimeType};base64,${base64}`

  if (mimeType === targetMime) {
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `banacanvas-${Date.now()}.${fmt}`
    link.click()
    return
  }

  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const srcBlob = new Blob([bytes], { type: mimeType })

  createImageBitmap(srcBlob).then((bitmap) => {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()

    const quality = fmt === 'png' ? undefined : 0.95
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        // Verify browser actually encoded the requested format
        const actualFmt = blob.type === targetMime ? fmt : (blob.type.includes('png') ? 'png' : 'jpg')
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `banacanvas-${Date.now()}.${actualFmt}`
        link.click()
        URL.revokeObjectURL(url)
      },
      targetMime,
      quality,
    )
  })
}

function openFullscreen(base64?: string, mimeType?: string) {
  if (!base64 || !mimeType) return
  fullscreenImage.value = { base64, mimeType }
  showFullscreen.value = true
}

function closeFullscreen() {
  showFullscreen.value = false
  fullscreenImage.value = null
}

const isBatchMode = () => (props.batchResults?.length ?? 0) > 0 || (props.batchProgress != null && props.batchProgress.total > 1)
</script>

<template>
  <!-- Batch gallery mode -->
  <div v-if="isBatchMode()" class="flex flex-col gap-3">
    <!-- Progress bar -->
    <div v-if="batchProgress && loading" class="flex flex-col gap-2">
      <div class="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
        <span class="font-medium">{{ t('batchProgress').replace('{current}', String(batchProgress.current)).replace('{total}', String(batchProgress.total)) }}</span>
        <span class="text-xs">{{ Math.round((batchProgress.current / batchProgress.total) * 100) }}%</span>
      </div>
      <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
        <div
          class="bg-violet-600 h-1.5 rounded-full transition-all duration-300"
          :style="{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }"
        />
      </div>
    </div>

    <!-- Gallery grid -->
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <template v-for="(item, index) in batchResults" :key="index">
        <!-- Success item -->
        <div v-if="item.imageBase64 && item.imageMimeType" class="relative group rounded-lg overflow-hidden shadow-md">
          <img
            :src="`data:${item.imageMimeType};base64,${item.imageBase64}`"
            alt="Generated image"
            class="w-full aspect-square object-cover cursor-pointer"
            @click="openFullscreen(item.imageBase64, item.imageMimeType)"
          />
          <div class="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              @click="downloadImage(item.imageBase64!, item.imageMimeType!)"
              class="rounded-md bg-black/60 backdrop-blur-sm p-1.5 text-white hover:bg-black/80 transition-colors cursor-pointer"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
            <button
              @click="openFullscreen(item.imageBase64, item.imageMimeType)"
              class="rounded-md bg-black/60 backdrop-blur-sm p-1.5 text-white hover:bg-black/80 transition-colors cursor-pointer"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9m11.25-5.25v4.5m0-4.5h-4.5m4.5 0L15 9m-11.25 11.25v-4.5m0 4.5h4.5m-4.5 0L9 15m11.25 5.25v-4.5m0 4.5h-4.5m4.5 0L15 15" />
              </svg>
            </button>
          </div>
          <div class="absolute bottom-1 left-1 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] text-white font-medium">
            #{{ index + 1 }}
          </div>
        </div>

        <!-- Error item -->
        <div v-else class="flex items-center justify-center rounded-lg border-2 border-dashed border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20 aspect-square p-3">
          <div class="text-center">
            <svg class="w-6 h-6 mx-auto mb-1 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p class="text-[10px] text-red-500 dark:text-red-400 line-clamp-3">{{ item.error }}</p>
          </div>
        </div>
      </template>

      <!-- Pending placeholders -->
      <template v-if="loading && batchProgress">
        <div
          v-for="n in (batchProgress.total - batchProgress.current)"
          :key="'pending-' + n"
          class="flex items-center justify-center rounded-lg border-2 border-dashed border-violet-300 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/20 aspect-square"
        >
          <svg class="animate-spin h-6 w-6 text-violet-500" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      </template>
    </div>

    <!-- Clear button -->
    <div class="flex justify-end">
      <button
        @click="emit('clear')"
        class="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
      >
        {{ t('clear') }}
      </button>
    </div>

    <!-- Aggregated usage -->
    <div
      v-if="usage"
      class="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-gray-50 dark:bg-gray-800/50 px-3 py-2 text-xs text-gray-500 dark:text-gray-400"
    >
      <span :title="t('inputTokens')">⬆ {{ usage.promptTokenCount.toLocaleString() }}</span>
      <span :title="t('outputTokens')">⬇ {{ usage.candidatesTokenCount.toLocaleString() }}</span>
      <span v-if="usage.thoughtsTokenCount" :title="t('thinkingTokens')">💭 {{ usage.thoughtsTokenCount.toLocaleString() }}</span>
      <span v-if="usage.elapsedMs != null" :title="t('elapsed')">
        ⏱ {{ usage.elapsedMs >= 1000 ? (usage.elapsedMs / 1000).toFixed(1) + 's' : usage.elapsedMs + 'ms' }}
      </span>
      <span class="ml-auto font-medium text-violet-600 dark:text-violet-400" :title="t('estimatedCost')">
        ~${{ usage.estimatedCost < 0.01 ? usage.estimatedCost.toFixed(4) : usage.estimatedCost.toFixed(3) }}
      </span>
    </div>
  </div>

  <!-- Loading state (single) -->
  <div
    v-else-if="loading"
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
        @click="openFullscreen(imageBase64, imageMimeType)"
      />
      <!-- Overlay controls -->
      <div class="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          @click="download"
          class="rounded-lg bg-black/60 backdrop-blur-sm p-2 text-white hover:bg-black/80 transition-colors cursor-pointer"
          :title="t('download')"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>
        <button
          @click="openFullscreen(imageBase64, imageMimeType)"
          class="rounded-lg bg-black/60 backdrop-blur-sm p-2 text-white hover:bg-black/80 transition-colors cursor-pointer"
          :title="t('fullscreen')"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9m11.25-5.25v4.5m0-4.5h-4.5m4.5 0L15 9m-11.25 11.25v-4.5m0 4.5h4.5m-4.5 0L9 15m11.25 5.25v-4.5m0 4.5h-4.5m4.5 0L15 15" />
          </svg>
        </button>
        <button
          @click="emit('clear')"
          class="rounded-lg bg-black/60 backdrop-blur-sm p-2 text-white hover:bg-red-600/80 transition-colors cursor-pointer"
          :title="t('clear')"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
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
      <span v-if="usage.elapsedMs != null" :title="t('elapsed')">
        ⏱ {{ usage.elapsedMs >= 1000 ? (usage.elapsedMs / 1000).toFixed(1) + 's' : usage.elapsedMs + 'ms' }}
      </span>
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
      v-if="showFullscreen && fullscreenImage"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 cursor-pointer"
      @click="closeFullscreen"
    >
      <img
        :src="`data:${fullscreenImage.mimeType};base64,${fullscreenImage.base64}`"
        alt="Generated image fullscreen"
        class="max-w-[95vw] max-h-[95vh] object-contain"
        @click.stop
      />
      <button
        @click="closeFullscreen"
        class="absolute top-4 right-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/30 transition-colors cursor-pointer"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </Teleport>
</template>
