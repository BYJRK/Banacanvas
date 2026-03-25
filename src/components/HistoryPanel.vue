<script setup lang="ts">
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
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="flex items-center justify-between px-1 mb-3">
      <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
        {{ t('history') }}
      </h3>
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
