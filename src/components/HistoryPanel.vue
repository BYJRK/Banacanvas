<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useHistoryStore } from '../stores/history'
import type { HistoryEntry } from '../types'
import { useI18n } from '../composables/useI18n'

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
  <div class="flex flex-col h-full">
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

    <div v-else class="flex flex-col gap-2 overflow-y-auto flex-1 min-h-0 pr-1">
      <div
        v-for="entry in historyStore.entries"
        :key="entry.id"
        class="group relative shrink-0 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden hover:border-violet-400 dark:hover:border-violet-600 transition-colors cursor-pointer"
        @click="emit('select', entry)"
        :title="entry.prompt.length > 100 ? entry.prompt.slice(0, 100) + '…' : entry.prompt"
      >
        <img
          :src="thumbUrl(entry)"
          :alt="entry.prompt"
          class="w-full aspect-16/9 object-cover object-center"
          loading="lazy"
        />
        <div class="p-2">
          <p class="text-[10px] text-gray-400 dark:text-gray-600">
            {{ formatTime(entry.timestamp) }}
          </p>
        </div>
        <!-- Delete button -->
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
</template>
