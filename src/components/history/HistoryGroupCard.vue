<script setup lang="ts">
import { computed, useId } from 'vue'
import type { HistoryEntry, HistoryGroup, HistoryViewMode } from '../../types'
import { useI18n } from '../../composables/useI18n'
import { AVAILABLE_MODELS } from '../../config/models'

const props = defineProps<{
  group: HistoryGroup
  viewMode: HistoryViewMode
  expanded: boolean
  fullPage: boolean
  timeLabel: string
}>()
const emit = defineEmits<{
  select: [entry: HistoryEntry]
  selectGroup: [group: HistoryGroup]
  remove: [group: HistoryGroup]
  toggle: [group: HistoryGroup]
}>()
const { t } = useI18n()
const expansionId = useId()
const entry = computed(() => props.group.representative)
const modelName = computed(() => {
  const found = AVAILABLE_MODELS.find((model) => model.id === entry.value.config.model && model.provider === (entry.value.config.provider ?? 'gemini'))
  return found?.name ?? entry.value.config.model.split('/').pop()
})
const selectionLabel = computed(() => props.group.entries.length > 1
  ? t('batchGroupTooltip').replace('{count}', String(props.group.entries.length))
  : entry.value.prompt)
function thumbUrl(image: HistoryEntry) {
  return `data:${image.imageMimeType};base64,${image.imageBase64}`
}
</script>

<template>
  <article class="group relative min-w-0 shrink-0 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden hover:border-violet-400 dark:hover:border-violet-600 transition-colors">
    <button
      type="button"
      class="block w-full text-left cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-violet-500"
      :class="viewMode === 'list' ? 'flex items-start gap-3 p-3 pr-9' : ''"
      :aria-label="selectionLabel"
      :title="entry.prompt"
      @click="emit('selectGroup', group)"
    >
      <div class="relative" :class="viewMode === 'list' ? 'shrink-0' : ''">
        <img
          :src="thumbUrl(entry)" :alt="entry.prompt" loading="lazy"
          class="object-cover object-center"
          :class="viewMode === 'list' ? (fullPage ? 'w-20 h-20 rounded' : 'w-12 h-12 rounded') : viewMode === 'grid' ? 'w-full aspect-16/9' : 'w-full'"
        />
        <span v-if="group.entries.length > 1" class="absolute bottom-1 right-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-medium text-white">
          ×{{ group.entries.length }}
        </span>
      </div>
      <div :class="viewMode === 'list' ? 'flex-1 min-w-0' : 'p-2.5'">
        <p v-if="fullPage || viewMode === 'list'" class="text-xs text-gray-700 dark:text-gray-300 line-clamp-2 mb-1.5 leading-relaxed">{{ entry.prompt }}</p>
        <div class="flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-gray-500 dark:text-gray-400">
          <span>{{ timeLabel }}</span>
          <template v-if="fullPage || viewMode === 'list'">
            <span v-if="entry.config.aspectRatio">{{ entry.config.aspectRatio }}</span>
            <span v-if="entry.config.imageSize">{{ entry.config.imageSize }}</span>
            <span v-if="entry.config.imageQuality">{{ entry.config.imageQuality }}</span>
            <span v-if="entry.config.seed !== undefined">seed {{ entry.config.seed }}</span>
            <span class="text-violet-500 dark:text-violet-400">{{ modelName }}</span>
          </template>
        </div>
      </div>
    </button>
    <button
      type="button" @click="emit('remove', group)"
      class="absolute top-1.5 right-1.5 rounded-full bg-black/50 p-1.5 text-white sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity hover:bg-red-600 cursor-pointer focus-visible:outline-2 focus-visible:outline-violet-500"
      :aria-label="group.entries.length > 1 ? t('deleteBatch') : t('deleteHistoryImage')"
      :title="group.entries.length > 1 ? t('deleteBatch') : t('deleteHistoryImage')"
    >
      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
    <template v-if="group.entries.length > 1">
      <button
        type="button" class="flex items-center justify-between gap-2 w-full px-3 py-2 text-xs font-medium text-violet-600 dark:text-violet-400 bg-violet-50/60 dark:bg-violet-950/20 border-t border-gray-100 dark:border-gray-800 hover:bg-violet-100 dark:hover:bg-violet-950/40 cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-violet-500"
        :aria-expanded="expanded" :aria-controls="expansionId"
        @click="emit('toggle', group)"
      >
        {{ expanded ? t('collapseBatch') : t('expandBatch').replace('{count}', String(group.entries.length)) }}
        <svg class="w-3.5 h-3.5" :class="expanded ? 'rotate-180' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div v-if="expanded" :id="expansionId" class="grid grid-cols-2 gap-2 p-2 border-t border-gray-100 dark:border-gray-800" :class="viewMode === 'list' && fullPage ? 'sm:grid-cols-3 lg:grid-cols-5' : ''">
        <button
          v-for="(image, index) in group.ordered" :key="image.id" type="button"
          class="relative rounded overflow-hidden bg-gray-100 dark:bg-gray-800 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 hover:ring-2 hover:ring-violet-400"
          :aria-label="t('viewBatchImage').replace('{index}', String(index + 1)).replace('{count}', String(group.entries.length))"
          :title="image.prompt" @click="emit('select', image)"
        >
          <img :src="thumbUrl(image)" :alt="image.prompt" class="w-full aspect-square object-contain" loading="lazy" />
          <span class="absolute bottom-1 left-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">{{ index + 1 }}</span>
        </button>
      </div>
    </template>
  </article>
</template>
