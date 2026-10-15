<script setup lang="ts">
import { computed, ref, shallowRef, watch, onMounted, onUnmounted } from 'vue'
import { useHistoryStore } from '../stores/history'
import { getHistoryInputImages } from '../historyImages'
import type { HistoryEntry, HistoryGroup } from '../types'
import { useI18n } from '../composables/useI18n'
import { useHistoryPreferences } from '../composables/useHistoryPreferences'
import HistoryGroupCard from './history/HistoryGroupCard.vue'
import HistoryBatchPopover from './history/HistoryBatchPopover.vue'

const props = withDefaults(defineProps<{ fullPage?: boolean; active?: boolean }>(), { fullPage: false, active: true })
const emit = defineEmits<{
  (e: 'openFullPage'): void
  (e: 'back'): void
  (e: 'select', entry: HistoryEntry): void
  (e: 'selectBatch', entries: HistoryEntry[]): void
  (e: 'toast', message: string, type?: 'success' | 'error' | 'info'): void
}>()
const historyStore = useHistoryStore()
const { t } = useI18n()
const { viewMode, groupBatches } = useHistoryPreferences()
const showViewDropdown = ref(false)
const viewDropdownRef = ref<HTMLElement | null>(null)
const viewDropdownToggle = ref<HTMLButtonElement | null>(null)
function onViewDropdownEscape(event: KeyboardEvent) {
  if (!showViewDropdown.value) return
  event.preventDefault()
  event.stopPropagation()
  showViewDropdown.value = false
  viewDropdownToggle.value?.focus()
}
function onDocClick(event: MouseEvent) {
  if (viewDropdownRef.value && !viewDropdownRef.value.contains(event.target as Node)) {
    showViewDropdown.value = false
  }
}
onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))

function formatTime(ts: number) {
  const d = new Date(ts)
  const diff = Date.now() - ts
  if (diff < 60_000) return t('justNow')
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}${t('timeSuffixMinutes')}`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}${t('timeSuffixHours')}`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}
const storageUsedBytes = ref(0)
const storageQuotaBytes = ref(0)
async function refreshStorageEstimate() {
  if (!navigator.storage?.estimate) return
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate()
    storageUsedBytes.value = usage
    storageQuotaBytes.value = quota
  } catch { /* storage estimates may be unavailable */ }
}
watch(() => historyStore.entries.length, refreshStorageEstimate, { immediate: true })
const storagePercent = computed(() => storageQuotaBytes.value > 0
  ? Math.min(100, (storageUsedBytes.value / storageQuotaBytes.value) * 100) : 0)
const storageLabel = computed(() => `${t('storageTitle')}: ${formatBytes(storageUsedBytes.value)} / ${formatBytes(storageQuotaBytes.value)}`)
const DONUT_R = 7
const DONUT_C = 2 * Math.PI * DONUT_R
const meterColor = computed(() =>
  storagePercent.value >= 90 ? 'stroke-red-500' :
  storagePercent.value >= 70 ? 'stroke-amber-500' : 'stroke-violet-500'
)
const showMeterTooltip = ref(false)
const meterAnchor = ref<HTMLElement | null>(null)
const tooltipPos = ref({ top: 0, left: 0 })
function onMeterEnter() {
  if (meterAnchor.value) {
    const rect = meterAnchor.value.getBoundingClientRect()
    tooltipPos.value = { top: rect.bottom + 8, left: rect.right }
  }
  showMeterTooltip.value = true
}

const containerRef = ref<HTMLElement | null>(null)
const containerWidth = ref(0)
let resizeObserver: ResizeObserver | null = null
onMounted(() => {
  if (containerRef.value) {
    resizeObserver = new ResizeObserver(([entry]) => {
      if (entry) containerWidth.value = entry.contentRect.width
    })
    resizeObserver.observe(containerRef.value)
  }
})
onUnmounted(() => resizeObserver?.disconnect())
const gridCols = computed(() => props.fullPage
  ? Math.max(1, Math.min(5, Math.floor((containerWidth.value + 16) / 256)))
  : containerWidth.value >= 400 ? 2 : 1)
const waterfallColCount = computed(() => props.fullPage
  ? Math.max(1, Math.min(6, Math.floor((containerWidth.value + 16) / 220)))
  : containerWidth.value >= 400 ? 3 : 2)
const waterfallColumns = computed(() => {
  const cols: HistoryGroup[][] = Array.from({ length: waterfallColCount.value }, () => [])
  historyGroups.value.forEach((group, i) => cols[i % waterfallColCount.value].push(group))
  return cols
})

// Preserve the existing grouping heuristic for legacy history entries.
const BATCH_WINDOW_MS = 60_000
function canGroup(a: HistoryEntry, b: HistoryEntry): boolean {
  if (a.prompt !== b.prompt || a.config.model !== b.config.model) return false
  if ((a.config.provider ?? 'gemini') !== (b.config.provider ?? 'gemini')) return false
  if ((a.config.aspectRatio ?? '') !== (b.config.aspectRatio ?? '')) return false
  if ((a.config.imageSize ?? '') !== (b.config.imageSize ?? '')) return false
  if ((a.config.imageQuality ?? '') !== (b.config.imageQuality ?? '')) return false
  if ((a.config.seed ?? null) !== (b.config.seed ?? null)) return false
  const aInputs = getHistoryInputImages(a)
  const bInputs = getHistoryInputImages(b)
  if (aInputs.length !== bInputs.length) return false
  if (aInputs.some((image, index) => image.base64 !== bInputs[index].base64 || image.mimeType !== bInputs[index].mimeType)) return false
  return Math.abs(a.timestamp - b.timestamp) <= BATCH_WINDOW_MS
}
const historyGroups = computed<HistoryGroup[]>(() => {
  const groups: HistoryGroup[] = []
  for (const entry of historyStore.entries) {
    const last = groups[groups.length - 1]
    if (groupBatches.value && last && canGroup(last.entries[last.entries.length - 1], entry)) {
      last.entries.push(entry)
    } else {
      groups.push({ key: entry.id, entries: [entry], ordered: [], representative: entry })
    }
  }
  for (const group of groups) {
    group.ordered = [...group.entries].sort((a, b) => a.timestamp - b.timestamp)
  }
  return groups
})
const openBatch = shallowRef<{ key: string; anchor: HTMLButtonElement; id: string } | null>(null)
const activeGroup = computed(() => historyGroups.value.find((group) => group.key === openBatch.value?.key))
function closeBatch(restoreFocus = false) {
  const anchor = openBatch.value?.anchor
  openBatch.value = null
  if (restoreFocus && props.active && anchor?.isConnected) anchor.focus({ preventScroll: true })
}
function toggleGroup(group: HistoryGroup, anchor: HTMLButtonElement, id: string) {
  if (openBatch.value?.key === group.key) closeBatch()
  else openBatch.value = { key: group.key, anchor, id }
}
watch(activeGroup, (group) => {
  if (!group || group.entries.length < 2) closeBatch()
})
watch([viewMode, () => props.fullPage, () => props.active], () => closeBatch())
function handleBatchImageSelect(entry: HistoryEntry) {
  closeBatch()
  emit('select', entry)
}
function handleSelectGroup(group: HistoryGroup) {
  if (group.entries.length === 1) emit('select', group.entries[0])
  else emit('selectBatch', group.ordered)
}
async function handleRemoveGroup(group: HistoryGroup) {
  try {
    for (const entry of group.entries) await historyStore.removeEntry(entry.id)
  } catch (e: unknown) {
    emit('toast', e instanceof Error ? e.message : String(e), 'error')
  }
}
async function handleClear() {
  try { await historyStore.clearAll() } catch (e: unknown) {
    emit('toast', e instanceof Error ? e.message : String(e), 'error')
  }
}

const exporting = ref(false)
const showImportDialog = ref(false)
const pendingImportFile = ref<File | null>(null)
const importFileInput = ref<HTMLInputElement | null>(null)
async function handleExport() {
  if (historyStore.entries.length === 0) return
  exporting.value = true
  try {
    const blob = await historyStore.exportZip()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `banacanvas-history-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.zip`
    a.click()
    URL.revokeObjectURL(url)
    emit('toast', t('exportSuccess'), 'success')
  } catch (e: unknown) {
    emit('toast', e instanceof Error ? e.message : String(e), 'error')
  } finally {
    exporting.value = false
  }
}
function onImportFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  pendingImportFile.value = file
  showImportDialog.value = true
}
async function confirmImport(mode: 'merge' | 'overwrite') {
  showImportDialog.value = false
  const file = pendingImportFile.value
  pendingImportFile.value = null
  if (!file) return
  try {
    const count = await historyStore.importZip(file, mode)
    await refreshStorageEstimate()
    emit('toast', t('importSuccess').replace('{count}', String(count)), 'success')
  } catch (e: unknown) {
    emit('toast', e instanceof Error ? e.message : t('importErrorInvalid'), 'error')
  }
}
</script>

<template>
  <section ref="containerRef" class="flex flex-col h-full min-h-0" :aria-label="t('history')">
    <div class="shrink-0 mb-4 space-y-3">
      <button type="button" class="flex items-center gap-2 text-xs font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500" @click="fullPage ? emit('back') : emit('openFullPage')">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path v-if="fullPage" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 12H5m7-7l-7 7 7 7" />
          <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M3 3l6 6m12-6l-6 6M3 21l6-6m12 6l-6-6" />
        </svg>
        {{ fullPage ? t('backToWorkspace') : t('openHistoryPage') }}
      </button>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="font-semibold text-gray-800 dark:text-gray-100" :class="fullPage ? 'text-2xl tracking-tight' : 'text-sm uppercase tracking-wider'">{{ t('history') }}</h2>
          <p v-if="fullPage" class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ t('historyImageCount').replace('{count}', String(historyStore.entries.length)) }}</p>
        </div>
        <div class="flex items-center gap-2">
          <!-- Storage meter -->
          <div ref="meterAnchor" class="flex items-center" :aria-label="storageLabel" tabindex="0" @mouseenter="onMeterEnter" @mouseleave="showMeterTooltip = false" @focus="onMeterEnter" @blur="showMeterTooltip = false">
            <svg viewBox="0 0 20 20" class="w-5 h-5 cursor-default shrink-0" aria-hidden="true">
              <circle cx="10" cy="10" :r="DONUT_R" fill="none" stroke-width="3" class="stroke-gray-200 dark:stroke-gray-700" />
              <circle cx="10" cy="10" :r="DONUT_R" fill="none" stroke-width="3" stroke-linecap="round" :stroke-dasharray="DONUT_C" :stroke-dashoffset="DONUT_C * (1 - storagePercent / 100)" transform="rotate(-90 10 10)" :class="meterColor" />
            </svg>
          </div>
          <Teleport to="body">
            <div v-if="showMeterTooltip" class="fixed z-[200] w-56 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl p-3 text-xs text-gray-700 dark:text-gray-300 pointer-events-none" :style="{ top: tooltipPos.top + 'px', left: tooltipPos.left + 'px', transform: 'translateX(-100%)' }">
              <div class="flex justify-between mb-1.5 font-medium">
                <span>{{ formatBytes(storageUsedBytes) }}</span>
                <span class="text-gray-500 dark:text-gray-400">{{ formatBytes(storageQuotaBytes) }}</span>
              </div>
              <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                <div class="h-1 rounded-full transition-all" :class="storagePercent >= 90 ? 'bg-red-500' : storagePercent >= 70 ? 'bg-amber-500' : 'bg-violet-500'" :style="{ width: storagePercent + '%' }" />
              </div>
            </div>
          </Teleport>
          <!-- Group batches toggle -->
          <button type="button" @click="groupBatches = !groupBatches" class="rounded p-1 transition-colors cursor-pointer" :class="groupBatches ? 'text-violet-500 hover:text-violet-600' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'" :title="groupBatches ? t('groupBatchesOn') : t('groupBatchesOff')" :aria-label="groupBatches ? t('groupBatchesOn') : t('groupBatchesOff')" :aria-pressed="groupBatches">
            <svg v-if="groupBatches" class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M5 3h7a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" opacity="0.4" />
              <path d="M8 6h7a2 2 0 012 2v7a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2z" />
            </svg>
            <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <rect x="3" y="3" width="14" height="14" rx="2" stroke-width="1.5" />
            </svg>
          </button>
          <!-- View mode dropdown -->
          <div ref="viewDropdownRef" class="relative" @keydown.esc="onViewDropdownEscape">
            <button ref="viewDropdownToggle" type="button" @click="showViewDropdown = !showViewDropdown" class="flex items-center gap-0.5 rounded p-1 transition-colors cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" :title="t('viewMode')" :aria-label="t('viewMode')" :aria-expanded="showViewDropdown">
              <svg v-if="viewMode === 'grid'" class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M3 3h6v6H3V3zm8 0h6v6h-6V3zM3 11h6v6H3v-6zm8 0h6v6h-6v-6z" />
              </svg>
              <svg v-else-if="viewMode === 'waterfall'" class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M3 3h6v13H3V3zm8 0h6v8h-6V3z" />
              </svg>
              <svg v-else class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M3 5h2v2H3V5zm4 0h10v2H7V5zM3 9h2v2H3V9zm4 0h10v2H7V9zM3 13h2v2H3v-2zm4 0h10v2H7v-2z" />
              </svg>
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div v-if="showViewDropdown" class="absolute right-0 top-full mt-1 w-36 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg z-50 py-1">
              <button v-for="mode in (['grid', 'waterfall', 'list'] as const)" :key="mode" type="button" @click="viewMode = mode; showViewDropdown = false" class="flex items-center gap-2 w-full px-3 py-1.5 text-xs cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-800" :class="viewMode === mode ? 'text-violet-500 font-medium' : 'text-gray-600 dark:text-gray-300'">
                <svg v-if="mode === 'grid'" class="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M3 3h6v6H3V3zm8 0h6v6h-6V3zM3 11h6v6H3v-6zm8 0h6v6h-6v-6z" />
                </svg>
                <svg v-else-if="mode === 'waterfall'" class="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M3 3h6v13H3V3zm8 0h6v8h-6V3z" />
                </svg>
                <svg v-else class="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M3 5h2v2H3V5zm4 0h10v2H7V5zM3 9h2v2H3V9zm4 0h10v2H7V9zM3 13h2v2H3v-2zm4 0h10v2H7v-2z" />
                </svg>
                {{ t(mode === 'grid' ? 'viewGrid' : mode === 'waterfall' ? 'viewWaterfall' : 'viewList') }}
              </button>
            </div>
          </div>
          <!-- Export button -->
          <button v-if="historyStore.entries.length > 0" type="button" @click="handleExport" :disabled="exporting" class="text-gray-400 hover:text-violet-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" :title="t('exportHistory')" :aria-label="t('exportHistory')">
            <svg v-if="exporting" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
          <!-- Import button -->
          <button type="button" @click="importFileInput?.click()" class="text-gray-400 hover:text-violet-500 transition-colors cursor-pointer" :title="t('importHistory')" :aria-label="t('importHistory')">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </button>
          <input ref="importFileInput" type="file" accept=".zip" class="hidden" @change="onImportFileSelected" />
          <button v-if="historyStore.entries.length > 0" type="button" @click="handleClear" class="text-gray-400 hover:text-red-500 transition-colors cursor-pointer" :title="t('clearAll')" :aria-label="t('clearAll')">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
    <div v-if="!historyStore.entries.length" class="flex-1 flex items-center justify-center rounded-xl border border-dashed border-gray-200 dark:border-gray-800 text-sm text-gray-500 dark:text-gray-400 p-8">{{ t('noHistory') }}</div>
    <div v-else-if="viewMode === 'waterfall'" data-history-scroll class="flex items-start gap-3 overflow-y-auto flex-1 min-h-0 p-1">
      <div v-for="(col, index) in waterfallColumns" :key="index" class="flex flex-col gap-3 flex-1 min-w-0">
        <HistoryGroupCard v-for="group in col" :key="group.key" :group="group" :view-mode="viewMode" :full-page="fullPage" :expanded="openBatch?.key === group.key" :time-label="formatTime(group.representative.timestamp)" @select-group="handleSelectGroup" @remove="handleRemoveGroup" @toggle="toggleGroup" />
      </div>
    </div>
    <div v-else data-history-scroll class="grid auto-rows-max items-start gap-3 overflow-y-auto flex-1 min-h-0 p-1" :style="{ gridTemplateColumns: `repeat(${viewMode === 'list' ? 1 : gridCols}, minmax(0, 1fr))` }">
      <HistoryGroupCard v-for="group in historyGroups" :key="group.key" :group="group" :view-mode="viewMode" :full-page="fullPage" :expanded="openBatch?.key === group.key" :time-label="formatTime(group.representative.timestamp)" @select-group="handleSelectGroup" @remove="handleRemoveGroup" @toggle="toggleGroup" />
    </div>
    <HistoryBatchPopover v-if="active && openBatch && activeGroup" :key="openBatch.id" :group="activeGroup" :anchor="openBatch.anchor" :id="openBatch.id" @close="closeBatch" @select="handleBatchImageSelect" />
    <Teleport to="body">
      <div v-if="showImportDialog" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" @click.self="showImportDialog = false; pendingImportFile = null">
        <div class="bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-80 p-5">
          <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">{{ t('importModeTitle') }}</h3>
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">{{ t('importModeDesc') }}</p>
          <div class="flex flex-col gap-2">
            <button @click="confirmImport('merge')" class="flex items-center gap-3 w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-violet-400 dark:hover:border-violet-600 transition-colors cursor-pointer text-left">
              <svg class="w-5 h-5 text-violet-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v16m8-8H4" />
              </svg>
              <div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('importModeMerge') }}</p>
                <p class="text-[11px] text-gray-400 dark:text-gray-500">{{ t('importModeMergeDesc') }}</p>
              </div>
            </button>
            <button @click="confirmImport('overwrite')" class="flex items-center gap-3 w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-red-400 dark:hover:border-red-600 transition-colors cursor-pointer text-left">
              <svg class="w-5 h-5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('importModeOverwrite') }}</p>
                <p class="text-[11px] text-gray-400 dark:text-gray-500">{{ t('importModeOverwriteDesc') }}</p>
              </div>
            </button>
          </div>
          <button @click="showImportDialog = false; pendingImportFile = null" class="mt-3 w-full text-center text-xs text-gray-500 dark:text-gray-400 cursor-pointer py-1">{{ t('cancel') }}</button>
        </div>
      </div>
    </Teleport>
  </section>
</template>
