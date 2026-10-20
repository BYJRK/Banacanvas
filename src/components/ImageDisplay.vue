<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import type { UsageInfo, DownloadFormat, BatchResultItem, GenerationConfig, Provider } from '../types'
import { useI18n } from '../composables/useI18n'
import BatchSizePreview from './BatchSizePreview.vue'

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
  canAddReference: boolean
  referenceLimit: number
  modelId?: string
  provider?: Provider
  generationConfig?: GenerationConfig
}>()

const batchSize = defineModel<number>('batchSize', { default: 1 })

const emit = defineEmits<{
  (e: 'clear'): void
  (e: 'addReference', base64: string, mimeType: string): void
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

  // If already matches target format, download directly without re-encoding
  if (mimeType === targetMime) {
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `banacanvas-${Date.now()}.${fmt}`
    link.click()
    return
  }

  // Decode base64 to blob, then re-encode via canvas for format conversion
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

function openFullscreen(base64?: string, mimeType?: string, index?: number) {
  if (!base64 || !mimeType) return
  fullscreenImage.value = { base64, mimeType }
  fullscreenIndex.value = index ?? -1
  showFullscreen.value = true
  // Reset zoom/pan state
  zoomLevel.value = 1
  panX.value = 0
  panY.value = 0
}

function closeFullscreen() {
  showFullscreen.value = false
  fullscreenImage.value = null
  fullscreenIndex.value = -1
  zoomLevel.value = 1
  panX.value = 0
  panY.value = 0
}

// --- Batch navigation in fullscreen ---
const fullscreenIndex = ref(-1)

const navigableResults = computed(() =>
  (props.batchResults ?? []).filter((r) => r.imageBase64 && r.imageMimeType)
)

const canNavigate = computed(() => fullscreenIndex.value >= 0 && navigableResults.value.length > 1)

function navigate(delta: number) {
  if (!canNavigate.value) return
  const list = navigableResults.value
  // Find current position within navigable list by identity
  const currentItem = list[fullscreenIndex.value] ?? list.find((r) =>
    r.imageBase64 === fullscreenImage.value?.base64 && r.imageMimeType === fullscreenImage.value?.mimeType
  )
  let idx = currentItem ? list.indexOf(currentItem) : fullscreenIndex.value
  idx = (idx + delta + list.length) % list.length
  const next = list[idx]
  if (!next?.imageBase64 || !next?.imageMimeType) return
  fullscreenImage.value = { base64: next.imageBase64, mimeType: next.imageMimeType }
  fullscreenIndex.value = idx
  zoomLevel.value = 1
  panX.value = 0
  panY.value = 0
}

function onKeydown(e: KeyboardEvent) {
  if (!showFullscreen.value) return
  if (e.key === 'Escape') {
    closeFullscreen()
  } else if (e.key === 'ArrowLeft' && canNavigate.value) {
    e.preventDefault()
    navigate(-1)
  } else if (e.key === 'ArrowRight' && canNavigate.value) {
    e.preventDefault()
    navigate(1)
  } else if (e.key === '0' && isViewTransformed.value) {
    e.preventDefault()
    resetView()
  }
}

watch(showFullscreen, (visible) => {
  if (visible) window.addEventListener('keydown', onKeydown)
  else window.removeEventListener('keydown', onKeydown)
})

onUnmounted(() => window.removeEventListener('keydown', onKeydown))

// --- Zoom & Pan ---
const zoomLevel = ref(1)
const panX = ref(0)
const panY = ref(0)
const MIN_ZOOM = 0.5
const MAX_ZOOM = 10
const ZOOM_STEP = 0.15

const fullscreenImgRef = ref<HTMLImageElement | null>(null)
const fullscreenContainerRef = ref<HTMLDivElement | null>(null)

const isViewTransformed = computed(() => zoomLevel.value !== 1 || panX.value !== 0 || panY.value !== 0)

function resetView() {
  zoomLevel.value = 1
  panX.value = 0
  panY.value = 0
}

const imageTransform = computed(() => `translate(${panX.value}px, ${panY.value}px) scale(${zoomLevel.value})`)

const showMinimap = computed(() => {
  if (!fullscreenImgRef.value || zoomLevel.value <= 1) return false
  return true
})

function onWheel(e: WheelEvent) {
  e.preventDefault()
  const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
  const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomLevel.value + delta * zoomLevel.value))

  if (!fullscreenImgRef.value || !fullscreenContainerRef.value) {
    zoomLevel.value = newZoom
    return
  }

  // Zoom toward cursor position
  const rect = fullscreenContainerRef.value.getBoundingClientRect()
  const cursorX = e.clientX - rect.left - rect.width / 2
  const cursorY = e.clientY - rect.top - rect.height / 2

  const ratio = newZoom / zoomLevel.value
  panX.value = cursorX - ratio * (cursorX - panX.value)
  panY.value = cursorY - ratio * (cursorY - panY.value)
  zoomLevel.value = newZoom
}

// --- Image dragging ---
const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartY = ref(0)
const dragStartPanX = ref(0)
const dragStartPanY = ref(0)

function onImagePointerDown(e: PointerEvent) {
  if (zoomLevel.value <= 1) return
  isDragging.value = true
  dragStartX.value = e.clientX
  dragStartY.value = e.clientY
  dragStartPanX.value = panX.value
  dragStartPanY.value = panY.value
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
}

function onImagePointerMove(e: PointerEvent) {
  if (!isDragging.value) return
  panX.value = dragStartPanX.value + (e.clientX - dragStartX.value)
  panY.value = dragStartPanY.value + (e.clientY - dragStartY.value)
}

function onImagePointerUp() {
  isDragging.value = false
}

// --- Minimap ---
const MINIMAP_SIZE = 160
const isMinimapDragging = ref(false)

// Bumped on image load / window resize so layout-dependent geometry recomputes
const layoutTick = ref(0)
function bumpLayout() {
  layoutTick.value++
}
window.addEventListener('resize', bumpLayout)
onUnmounted(() => window.removeEventListener('resize', bumpLayout))

function getMinimapGeometry() {
  void layoutTick.value
  const img = fullscreenImgRef.value
  const container = fullscreenContainerRef.value
  if (!img || !container) return null

  // Layout size of the image at zoom=1 (offsetWidth/Height ignore CSS transforms)
  const displayedW = img.offsetWidth
  const displayedH = img.offsetHeight
  const containerW = container.clientWidth
  const containerH = container.clientHeight
  if (!displayedW || !displayedH || !containerW || !containerH) return null

  const minimapScale = Math.min(MINIMAP_SIZE / displayedW, MINIMAP_SIZE / displayedH)
  const minimapImgW = displayedW * minimapScale
  const minimapImgH = displayedH * minimapScale
  // Minimap image is centered inside the square minimap box
  const offsetX = (MINIMAP_SIZE - minimapImgW) / 2
  const offsetY = (MINIMAP_SIZE - minimapImgH) / 2

  return { displayedW, displayedH, containerW, containerH, minimapImgW, minimapImgH, offsetX, offsetY }
}

const minimapViewport = computed(() => {
  const g = getMinimapGeometry()
  if (!g) return { x: 0, y: 0, w: MINIMAP_SIZE, h: MINIMAP_SIZE, imgW: MINIMAP_SIZE, imgH: MINIMAP_SIZE, imgX: 0, imgY: 0 }

  const scaledW = g.displayedW * zoomLevel.value
  const scaledH = g.displayedH * zoomLevel.value

  const viewW = (g.containerW / scaledW) * g.minimapImgW
  const viewH = (g.containerH / scaledH) * g.minimapImgH

  const viewX = g.offsetX + (g.minimapImgW - viewW) / 2 - (panX.value / scaledW) * g.minimapImgW
  const viewY = g.offsetY + (g.minimapImgH - viewH) / 2 - (panY.value / scaledH) * g.minimapImgH

  return {
    x: viewX,
    y: viewY,
    w: viewW,
    h: viewH,
    imgW: g.minimapImgW,
    imgH: g.minimapImgH,
    imgX: g.offsetX,
    imgY: g.offsetY,
  }
})

function onMinimapPointerDown(e: PointerEvent) {
  e.stopPropagation()
  isMinimapDragging.value = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  updatePanFromMinimap(e)
}

function onMinimapPointerMove(e: PointerEvent) {
  if (!isMinimapDragging.value) return
  updatePanFromMinimap(e)
}

function onMinimapPointerUp() {
  isMinimapDragging.value = false
}

function updatePanFromMinimap(e: PointerEvent) {
  const g = getMinimapGeometry()
  if (!g) return

  const minimapEl = e.currentTarget as HTMLElement
  const rect = minimapEl.getBoundingClientRect()
  // Exclude the border so coords are relative to the MINIMAP_SIZE content box
  const clickX = e.clientX - rect.left - minimapEl.clientLeft
  const clickY = e.clientY - rect.top - minimapEl.clientTop

  // Click position relative to the center of the minimap image (-0.5..0.5)
  const relX = (clickX - g.offsetX) / g.minimapImgW - 0.5
  const relY = (clickY - g.offsetY) / g.minimapImgH - 0.5

  panX.value = -relX * g.displayedW * zoomLevel.value
  panY.value = -relY * g.displayedH * zoomLevel.value
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
            loading="lazy"
            decoding="async"
            @click="openFullscreen(item.imageBase64, item.imageMimeType, index)"
          />
          <div class="absolute top-1 right-1 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity">
            <button
              @click="emit('addReference', item.imageBase64!, item.imageMimeType!)"
              :disabled="!canAddReference"
              class="rounded-md bg-black/60 backdrop-blur-sm p-1.5 text-white hover:bg-black/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              :title="canAddReference ? t('addToReferences') : t('referenceImagesLimitReached').replace('{count}', String(referenceLimit))"
              :aria-label="t('addToReferences')"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="2" y="4" width="11" height="16" rx="2" stroke-width="1.75" />
                <circle cx="5.5" cy="8" r="1" fill="currentColor" stroke="none" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="m4 17 2.5-3 2 2 2.5-3M22 12h-7m0 0 3-3m-3 3 3 3" />
              </svg>
            </button>
            <button
              @click="downloadImage(item.imageBase64!, item.imageMimeType!)"
              class="rounded-md bg-black/60 backdrop-blur-sm p-1.5 text-white hover:bg-black/80 transition-colors cursor-pointer"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
            <button
              @click="openFullscreen(item.imageBase64, item.imageMimeType, index)"
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
      <span v-if="usage.estimatedCost != null" class="ml-auto font-medium text-violet-600 dark:text-violet-400" :title="t(usage.costIsExact ? 'actualCost' : 'estimatedCost')">
        {{ usage.costIsExact ? '' : '~' }}${{ usage.estimatedCost < 0.01 ? usage.estimatedCost.toFixed(4) : usage.estimatedCost.toFixed(3) }}
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
        decoding="async"
        @click="openFullscreen(imageBase64, imageMimeType)"
      />
      <!-- Overlay controls -->
      <div class="absolute top-2 right-2 flex gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity">
        <button
          v-if="imageMimeType"
          @click="emit('addReference', imageBase64, imageMimeType)"
          :disabled="!canAddReference"
          class="rounded-lg bg-black/60 backdrop-blur-sm p-2 text-white hover:bg-black/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          :title="canAddReference ? t('addToReferences') : t('referenceImagesLimitReached').replace('{count}', String(referenceLimit))"
          :aria-label="t('addToReferences')"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="2" y="4" width="11" height="16" rx="2" stroke-width="1.75" />
            <circle cx="5.5" cy="8" r="1" fill="currentColor" stroke="none" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="m4 17 2.5-3 2 2 2.5-3M22 12h-7m0 0 3-3m-3 3 3 3" />
          </svg>
        </button>
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
      <span v-if="usage.estimatedCost != null" class="ml-auto font-medium text-violet-600 dark:text-violet-400" :title="t(usage.costIsExact ? 'actualCost' : 'estimatedCost')">
        {{ usage.costIsExact ? '' : '~' }}${{ usage.estimatedCost < 0.01 ? usage.estimatedCost.toFixed(4) : usage.estimatedCost.toFixed(3) }}
      </span>
    </div>
  </div>

  <!-- Empty state -->
  <BatchSizePreview v-else v-model="batchSize" :model-id="modelId" :provider="provider" :config="generationConfig" />

  <!-- Fullscreen overlay with zoom & minimap -->
  <Teleport to="body">
    <div
      v-if="showFullscreen && fullscreenImage"
      ref="fullscreenContainerRef"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 overflow-hidden"
      :class="zoomLevel > 1 ? 'cursor-grab' : 'cursor-pointer'"
      @click.self="zoomLevel <= 1 ? closeFullscreen() : undefined"
      @wheel.prevent="onWheel"
    >
      <img
        ref="fullscreenImgRef"
        :src="`data:${fullscreenImage.mimeType};base64,${fullscreenImage.base64}`"
        alt="Generated image fullscreen"
        class="max-w-[95vw] max-h-[95vh] object-contain select-none"
        decoding="async"
        @load="bumpLayout"
        :class="{ 'cursor-grabbing': isDragging, 'cursor-grab': zoomLevel > 1 && !isDragging }"
        :style="{ transform: imageTransform, transformOrigin: 'center center', transition: isDragging ? 'none' : 'transform 0.1s ease-out' }"
        draggable="false"
        @pointerdown="onImagePointerDown"
        @pointermove="onImagePointerMove"
        @pointerup="onImagePointerUp"
        @pointercancel="onImagePointerUp"
        @click.stop
      />

      <!-- Close button -->
      <button
        @click="closeFullscreen"
        class="absolute top-4 right-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/30 transition-colors cursor-pointer z-10"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <!-- Prev / Next arrows -->
      <button
        v-if="canNavigate"
        @click.stop="navigate(-1)"
        class="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-2 text-white hover:bg-white/30 transition-colors cursor-pointer z-10"
      >
        <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        v-if="canNavigate"
        @click.stop="navigate(1)"
        class="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-2 text-white hover:bg-white/30 transition-colors cursor-pointer z-10"
      >
        <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <!-- Counter -->
      <div
        v-if="canNavigate"
        class="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 backdrop-blur-sm px-3 py-1 text-sm text-white font-medium select-none z-10"
      >
        {{ fullscreenIndex + 1 }} / {{ navigableResults.length }}
      </div>

      <!-- Zoom level indicator (click to reset view) -->
      <button
        v-if="isViewTransformed"
        class="absolute bottom-4 left-4 flex items-center gap-1.5 rounded-lg bg-black/60 backdrop-blur-sm px-3 py-1.5 text-sm text-white font-medium select-none hover:bg-white/20 transition-colors cursor-pointer z-10"
        :title="`${t('resetView')} (0)`"
        @click.stop="resetView"
      >
        {{ Math.round(zoomLevel * 100) }}%
        <svg class="w-3.5 h-3.5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>

      <!-- Minimap -->
      <div
        v-if="showMinimap"
        class="absolute bottom-4 right-4 box-content rounded-lg overflow-hidden border border-white/20 bg-black/60 backdrop-blur-sm select-none"
        :style="{ width: MINIMAP_SIZE + 'px', height: MINIMAP_SIZE + 'px' }"
        @pointerdown="onMinimapPointerDown"
        @pointermove="onMinimapPointerMove"
        @pointerup="onMinimapPointerUp"
        @pointercancel="onMinimapPointerUp"
        @click.stop
      >
        <img
          :src="`data:${fullscreenImage.mimeType};base64,${fullscreenImage.base64}`"
          alt="Minimap"
          class="absolute max-w-none pointer-events-none"
          :style="{
            left: minimapViewport.imgX + 'px',
            top: minimapViewport.imgY + 'px',
            width: minimapViewport.imgW + 'px',
            height: minimapViewport.imgH + 'px',
          }"
          draggable="false"
        />
        <!-- Viewport indicator -->
        <div
          class="absolute border-2 border-violet-400 bg-violet-400/15 rounded-sm pointer-events-none"
          :style="{
            left: minimapViewport.x + 'px',
            top: minimapViewport.y + 'px',
            width: Math.max(minimapViewport.w, 8) + 'px',
            height: Math.max(minimapViewport.h, 8) + 'px',
          }"
        />
      </div>
    </div>
  </Teleport>
</template>
