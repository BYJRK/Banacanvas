<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useHistoryStore } from '../stores/history'
import type { HistoryEntry } from '../types'
import { useI18n } from '../composables/useI18n'
import { AVAILABLE_MODELS } from '../config/models'

const emit = defineEmits<{
  (e: 'select', entry: HistoryEntry): void
}>()

const historyStore = useHistoryStore()
const { t } = useI18n()

function formatTime(ts: number) {
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - ts
  if (diff < 60_000) return t('justNow')
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}${t('timeSuffixMinutes')}`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}${t('timeSuffixHours')}`
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function thumbUrl(entry: HistoryEntry) {
  return `data:${entry.imageMimeType};base64,${entry.imageBase64}`
}

// Storage meter — uses navigator.storage.estimate() for IndexedDB-aware measurement
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const storageUsedBytes = ref(0)
const storageQuotaBytes = ref(0)

async function refreshStorageEstimate() {
  if (!navigator.storage?.estimate) return
  const { usage = 0, quota = 0 } = await navigator.storage.estimate()
  storageUsedBytes.value = usage
  storageQuotaBytes.value = quota
}

refreshStorageEstimate()
watch(() => historyStore.entries, refreshStorageEstimate, { deep: true })

// View mode
type HistoryViewMode = 'grid' | 'waterfall' | 'list'
const viewMode = ref<HistoryViewMode>((localStorage.getItem('historyViewMode') as HistoryViewMode) || 'grid')
watch(viewMode, (v) => localStorage.setItem('historyViewMode', v))

const showViewDropdown = ref(false)
const viewDropdownRef = ref<HTMLElement | null>(null)
function onDocClick(e: MouseEvent) {
  if (viewDropdownRef.value && !viewDropdownRef.value.contains(e.target as Node)) {
    showViewDropdown.value = false
  }
}
onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))

// Waterfall: split entries into N columns based on container width
const containerRef = ref<HTMLElement | null>(null)
const containerWidth = ref(0)

let resizeObserver: ResizeObserver | null = null
onMounted(() => {
  if (containerRef.value) {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        containerWidth.value = entry.contentRect.width
      }
    })
    resizeObserver.observe(containerRef.value)
  }
})
onUnmounted(() => {
  resizeObserver?.disconnect()
})

// Grid: 1 column default, 2 columns when wide
const gridCols = computed(() => containerWidth.value >= 400 ? 2 : 1)

// Waterfall: 2 columns default, 3 columns when wide
const waterfallColCount = computed(() => containerWidth.value >= 400 ? 3 : 2)
const waterfallColumns = computed(() => {
  const cols: HistoryEntry[][] = Array.from({ length: waterfallColCount.value }, () => [])
  historyStore.entries.forEach((entry, i) => {
    cols[i % waterfallColCount.value].push(entry)
  })
  return cols
})

// List: resolve short model name
function modelName(entry: HistoryEntry): string {
  const found = AVAILABLE_MODELS.find((m) => m.id === entry.config.model && m.provider === entry.config.provider)
  return found ? found.name : (entry.config.model.split('/').pop() ?? entry.config.model)
}

const storagePercent = computed(() =>
  storageQuotaBytes.value > 0 ? Math.min(100, (storageUsedBytes.value / storageQuotaBytes.value) * 100) : 0
)
const DONUT_R = 7
const DONUT_C = 2 * Math.PI * DONUT_R

const meterColor = computed(() =>
  storagePercent.value >= 90 ? 'stroke-red-500' :
  storagePercent.value >= 70 ? 'stroke-amber-500' :
  'stroke-violet-500'
)

const showMeterTooltip = ref(false)
const meterAnchor = ref<HTMLElement | null>(null)
const tooltipPos = ref({ top: 0, left: 0 })

function onMeterEnter() {
  if (meterAnchor.value) {
    const rect = meterAnchor.value.getBoundingClientRect()
    tooltipPos.value = {
      top: rect.bottom + 8,
      left: rect.right,
    }
  }
  showMeterTooltip.value = true
}
</script>

<template>
  <div ref="containerRef" class="flex flex-col h-full">
    <div class="flex items-center justify-between px-1 mb-3">
      <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
        {{ t('history') }}
      </h3>
      <div class="flex items-center gap-2">
        <!-- Storage meter -->
        <div
          ref="meterAnchor"
          class="flex items-center"
          @mouseenter="onMeterEnter"
          @mouseleave="showMeterTooltip = false"
        >
          <svg viewBox="0 0 20 20" class="w-5 h-5 cursor-default shrink-0">
            <circle cx="10" cy="10" :r="DONUT_R" fill="none" stroke-width="3" class="stroke-gray-200 dark:stroke-gray-700" />
            <circle
              cx="10" cy="10" :r="DONUT_R" fill="none" stroke-width="3"
              stroke-linecap="round"
              :stroke-dasharray="DONUT_C"
              :stroke-dashoffset="DONUT_C * (1 - storagePercent / 100)"
              transform="rotate(-90 10 10)"
              :class="meterColor"
            />
          </svg>
        </div>
        <!-- Teleported tooltip -->
        <Teleport to="body">
          <div
            v-if="showMeterTooltip"
            class="fixed z-[200] w-64 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl p-3 text-xs text-gray-700 dark:text-gray-300 pointer-events-none"
            :style="{ top: tooltipPos.top + 'px', left: tooltipPos.left + 'px', transform: 'translateX(-100%)' }"
          >
            <p class="font-semibold mb-2 text-gray-900 dark:text-gray-100">{{ t('storageTitle') }}</p>
            <div class="flex justify-between mb-1">
              <span class="text-gray-500 dark:text-gray-400">{{ t('storageUsed') }}</span>
              <span class="font-medium">{{ formatBytes(storageUsedBytes) }} / {{ formatBytes(storageQuotaBytes) }}</span>
            </div>
            <div class="flex justify-between mb-2">
              <span class="text-gray-500 dark:text-gray-400">{{ t('storageFree') }}</span>
              <span class="font-medium">{{ formatBytes(Math.max(0, storageQuotaBytes - storageUsedBytes)) }}</span>
            </div>
            <!-- Mini progress bar -->
            <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 mb-2">
              <div
                class="h-1 rounded-full transition-all"
                :class="storagePercent >= 90 ? 'bg-red-500' : storagePercent >= 70 ? 'bg-amber-500' : 'bg-violet-500'"
                :style="{ width: storagePercent + '%' }"
              />
            </div>
          </div>
        </Teleport>
        <!-- View mode dropdown -->
        <div class="relative" ref="viewDropdownRef">
          <button
            @click="showViewDropdown = !showViewDropdown"
            class="flex items-center gap-0.5 rounded p-1 transition-colors cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            :title="t('viewMode')"
          >
            <!-- Grid icon -->
            <svg v-if="viewMode === 'grid'" class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 3h6v6H3V3zm8 0h6v6h-6V3zM3 11h6v6H3v-6zm8 0h6v6h-6v-6z"/>
            </svg>
            <!-- Waterfall icon -->
            <svg v-else-if="viewMode === 'waterfall'" class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 3h6v13H3V3zm8 0h6v8h-6V3z"/>
            </svg>
            <!-- List icon -->
            <svg v-else class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 5h2v2H3V5zm4 0h10v2H7V5zM3 9h2v2H3V9zm4 0h10v2H7V9zM3 13h2v2H3v-2zm4 0h10v2H7v-2z"/>
            </svg>
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          <div
            v-if="showViewDropdown"
            class="absolute right-0 top-full mt-1 w-36 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg z-50 py-1"
          >
            <button
              v-for="mode in (['grid', 'waterfall', 'list'] as const)"
              :key="mode"
              @click="viewMode = mode; showViewDropdown = false"
              class="flex items-center gap-2 w-full px-3 py-1.5 text-xs cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
              :class="viewMode === mode ? 'text-violet-500 font-medium' : 'text-gray-600 dark:text-gray-300'"
            >
              <svg v-if="mode === 'grid'" class="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 3h6v6H3V3zm8 0h6v6h-6V3zM3 11h6v6H3v-6zm8 0h6v6h-6v-6z"/>
              </svg>
              <svg v-else-if="mode === 'waterfall'" class="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 3h6v13H3V3zm8 0h6v8h-6V3z"/>
              </svg>
              <svg v-else class="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 5h2v2H3V5zm4 0h10v2H7V5zM3 9h2v2H3V9zm4 0h10v2H7V9zM3 13h2v2H3v-2zm4 0h10v2H7v-2z"/>
              </svg>
              {{ t(mode === 'grid' ? 'viewGrid' : mode === 'waterfall' ? 'viewWaterfall' : 'viewList') }}
            </button>
          </div>
        </div>
        <button
          v-if="historyStore.entries.length > 0"
          @click="historyStore.clearAll()"
          class="text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
          :title="t('clearAll')"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>

    <div v-if="historyStore.entries.length === 0" class="text-center py-8">
      <p class="text-sm text-gray-400 dark:text-gray-600">{{ t('noHistory') }}</p>
    </div>

    <!-- Grid view -->
    <div v-else-if="viewMode === 'grid'" class="grid auto-rows-max gap-2 overflow-y-auto flex-1 min-h-0 pr-1" :style="{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }">
      <div
        v-for="entry in historyStore.entries"
        :key="entry.id"
        class="group relative shrink-0 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden hover:border-violet-400 dark:hover:border-violet-600 transition-colors cursor-pointer"
        @click="emit('select', entry)"
        :title="entry.prompt.length > 100 ? entry.prompt.slice(0, 100) + '…' : entry.prompt"
      >
        <img :src="thumbUrl(entry)" :alt="entry.prompt" class="w-full aspect-16/9 object-cover object-center" loading="lazy" />
        <div class="p-2">
          <p class="text-[10px] text-gray-400 dark:text-gray-600">{{ formatTime(entry.timestamp) }}</p>
        </div>
        <button
          @click.stop="historyStore.removeEntry(entry.id)"
          class="absolute top-1 right-1 rounded-full bg-black/50 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 cursor-pointer"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Waterfall view -->
    <div v-else-if="viewMode === 'waterfall'" class="flex gap-2 items-start overflow-y-auto flex-1 min-h-0 pr-1">
      <div v-for="(col, ci) in waterfallColumns" :key="ci" class="flex flex-col gap-2 flex-1 min-w-0">
        <div
          v-for="entry in col"
          :key="entry.id"
          class="group relative rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden hover:border-violet-400 dark:hover:border-violet-600 transition-colors cursor-pointer"
          @click="emit('select', entry)"
          :title="entry.prompt.length > 100 ? entry.prompt.slice(0, 100) + '…' : entry.prompt"
        >
          <img :src="thumbUrl(entry)" :alt="entry.prompt" class="w-full object-cover object-center" loading="lazy" />
          <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <p class="text-[10px] text-white/80">{{ formatTime(entry.timestamp) }}</p>
          </div>
          <button
            @click.stop="historyStore.removeEntry(entry.id)"
            class="absolute top-1 right-1 rounded-full bg-black/50 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 cursor-pointer"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- List view -->
    <div v-else class="flex flex-col gap-1 overflow-y-auto flex-1 min-h-0 pr-1">
      <div
        v-for="entry in historyStore.entries"
        :key="entry.id"
        class="group flex items-start gap-2.5 p-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-violet-400 dark:hover:border-violet-600 transition-colors cursor-pointer relative"
        @click="emit('select', entry)"
      >
        <img :src="thumbUrl(entry)" :alt="entry.prompt" class="w-12 h-12 rounded object-cover shrink-0" loading="lazy" />
        <div class="flex-1 min-w-0 pr-5">
          <p class="text-xs text-gray-700 dark:text-gray-300 line-clamp-2 mb-1 leading-relaxed">{{ entry.prompt }}</p>
          <div class="flex flex-wrap gap-x-2 gap-y-0.5">
            <span class="text-[10px] text-gray-400 dark:text-gray-600">{{ formatTime(entry.timestamp) }}</span>
            <span v-if="entry.config.aspectRatio" class="text-[10px] text-gray-400 dark:text-gray-600">{{ entry.config.aspectRatio }}</span>
            <span v-if="entry.config.imageSize" class="text-[10px] text-gray-400 dark:text-gray-600">{{ entry.config.imageSize }}</span>
            <span class="text-[10px] text-violet-400 dark:text-violet-500">{{ modelName(entry) }}</span>
          </div>
        </div>
        <button
          @click.stop="historyStore.removeEntry(entry.id)"
          class="absolute top-1.5 right-1.5 rounded-full bg-black/50 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 cursor-pointer"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
