<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { DialogTitle } from '@headlessui/vue'
import type { HistoryEntry, HistoryGroup } from '../../types'
import { useI18n } from '../../composables/useI18n'

const props = defineProps<{ group: HistoryGroup; id: string; modal?: boolean }>()
const emit = defineEmits<{ close: []; select: [entry: HistoryEntry] }>()
const { t } = useI18n()
const grid = useTemplateRef<HTMLDivElement>('grid')
const countLabel = computed(() => t('historyBatchImages').replace('{count}', String(props.group.entries.length)))

function focusImage(direction: number, event: KeyboardEvent) {
  const images = Array.from(grid.value?.querySelectorAll<HTMLButtonElement>('[data-batch-image]') ?? [])
  const index = images.indexOf(event.target as HTMLButtonElement)
  if (index < 0) return
  const next = images[Math.max(0, Math.min(images.length - 1, index + direction))]
  next?.focus({ preventScroll: true })
  next?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}
</script>

<template>
  <div class="sticky top-0 z-10 flex items-start justify-between gap-3 px-4 pt-4 pb-3 bg-white dark:bg-gray-900">
    <div class="min-w-0">
      <component :is="modal ? DialogTitle : 'h3'" :id="`${id}-title`" :as="modal ? 'h3' : undefined" class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ countLabel }}</component>
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2 break-words">{{ group.representative.prompt }}</p>
    </div>
    <button type="button" :aria-label="t('collapseBatch')" class="shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer focus-visible:outline-2 focus-visible:outline-violet-500" @click="emit('close')">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
  <div ref="grid" class="grid grid-cols-3 gap-3 px-4 pt-1 pb-4" @keydown.left.prevent="focusImage(-1, $event)" @keydown.right.prevent="focusImage(1, $event)" @keydown.up.prevent="focusImage(-3, $event)" @keydown.down.prevent="focusImage(3, $event)">
    <button v-for="(image, index) in group.ordered" :key="image.id" data-batch-image type="button" class="group/image min-w-0 text-left cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500" :aria-label="t('viewBatchImage').replace('{index}', String(index + 1)).replace('{count}', String(group.entries.length))" @click="emit('select', image)">
      <div class="rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 group-hover/image:border-violet-400 transition-colors">
        <img :src="`data:${image.imageMimeType};base64,${image.imageBase64}`" :alt="image.prompt" class="w-full aspect-square max-h-[28dvh] object-contain" loading="lazy" />
      </div>
    </button>
  </div>
</template>
