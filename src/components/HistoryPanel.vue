<script setup lang="ts">
import { useHistoryStore } from '../stores/history'
import type { HistoryEntry } from '../types'

const emit = defineEmits<{
  (e: 'select', entry: HistoryEntry): void
}>()

const historyStore = useHistoryStore()

function formatTime(ts: number) {
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - ts
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
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
        History
      </h3>
      <button
        v-if="historyStore.entries.length > 0"
        @click="historyStore.clearAll()"
        class="text-xs text-red-500 hover:underline cursor-pointer"
      >
        Clear All
      </button>
    </div>

    <div v-if="historyStore.entries.length === 0" class="text-center py-8">
      <p class="text-sm text-gray-400 dark:text-gray-600">No history yet</p>
    </div>

    <div v-else class="flex flex-col gap-2 overflow-y-auto flex-1 pr-1">
      <div
        v-for="entry in historyStore.entries"
        :key="entry.id"
        class="group relative rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden hover:border-violet-400 dark:hover:border-violet-600 transition-colors cursor-pointer"
        @click="emit('select', entry)"
      >
        <img
          :src="thumbUrl(entry)"
          :alt="entry.prompt"
          class="w-full aspect-square object-cover"
          loading="lazy"
        />
        <div class="p-2">
          <p class="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
            {{ entry.prompt }}
          </p>
          <p class="text-[10px] text-gray-400 dark:text-gray-600 mt-1">
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
