<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { useI18n } from '../composables/useI18n'

const batchSize = defineModel<number>({ default: 1 })
const { t } = useI18n()
const choosing = ref(false)
const previewCount = ref<number | null>(null)
const container = ref<HTMLDivElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)

async function openPicker() {
  choosing.value = true
  previewCount.value = null
  await nextTick()
  container.value?.querySelector<HTMLButtonElement>(`[data-count="${batchSize.value}"]`)?.focus()
}

async function closePicker(count?: number) {
  if (count !== undefined) batchSize.value = count
  choosing.value = false
  previewCount.value = null
  await nextTick()
  trigger.value?.focus()
}
</script>

<template>
  <div ref="container" class="select-none" @keydown.esc.stop.prevent="closePicker()">
    <div v-if="choosing" class="batch-size-picker mx-auto flex w-full max-w-xs flex-col gap-3">
      <div class="flex items-center justify-between gap-3">
        <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('batchPickerHint') }}</p>
        <button
          type="button"
          :aria-label="t('cancel')"
          :title="t('cancel')"
          class="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 cursor-pointer"
          @click="closePicker()"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-width="2" d="m6 6 12 12M6 18 18 6" />
          </svg>
        </button>
      </div>
      <div class="grid grid-cols-3 gap-2" :aria-label="t('batchSize')" role="group" @mouseleave="previewCount = null">
        <button
          v-for="n in 9"
          :key="n"
          type="button"
          :data-count="n"
          :aria-label="t('selectBatchCount').replace('{count}', String(n))"
          :aria-pressed="batchSize === n"
          class="flex aspect-square items-center justify-center rounded-xl border-2 text-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950 cursor-pointer"
          :class="n <= (previewCount ?? batchSize)
            ? 'border-violet-300 bg-violet-50 text-violet-600 dark:border-violet-700 dark:bg-violet-950/30 dark:text-violet-400'
            : 'border-dashed border-gray-200 text-gray-400 dark:border-gray-800 dark:text-gray-600'"
          @mouseenter="previewCount = n"
          @focus="previewCount = n"
          @blur="previewCount = null"
          @click="closePicker(n)"
        >
          {{ n }}
        </button>
      </div>
    </div>
    <button
      v-else
      ref="trigger"
      type="button"
      :aria-label="t('changeBatchCount').replace('{count}', String(batchSize))"
      :title="t('changeBatchCount').replace('{count}', String(batchSize))"
      class="group block w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950 cursor-pointer"
      @click="openPicker"
    >
      <span :class="batchSize > 1
        ? ['grid gap-3', batchSize === 2 || batchSize === 4 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3']
        : 'block'">
        <span
          v-for="n in batchSize"
          :key="n"
          class="relative flex items-center justify-center rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-800 transition-colors group-hover:border-violet-300 group-hover:bg-violet-50/40 dark:group-hover:border-violet-700 dark:group-hover:bg-violet-950/20"
          :class="batchSize > 1 ? 'aspect-square p-3' : 'p-12'"
          aria-hidden="true"
        >
          <span v-if="batchSize > 1" class="absolute bottom-2 left-2 text-xs font-medium text-gray-400 dark:text-gray-600">#{{ n }}</span>
          <span class="text-center text-gray-400 dark:text-gray-600">
            <svg class="mx-auto mb-3 opacity-50" :class="batchSize > 1 ? 'w-10 h-10' : 'w-16 h-16'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span class="block text-sm">{{ t('emptyState') }}</span>
          </span>
        </span>
      </span>
    </button>
  </div>
</template>

<style scoped>
@media (prefers-reduced-motion: no-preference) {
  .batch-size-picker {
    animation: picker-in 160ms ease-out;
  }
}

@keyframes picker-in {
  from {
    opacity: 0;
    transform: scale(0.94);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
