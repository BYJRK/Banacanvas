<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { Dialog, DialogDescription, DialogPanel, DialogTitle } from '@headlessui/vue'
import { useI18n } from '../../composables/useI18n'

const props = defineProps<{ open: boolean; busy: boolean; count: number }>()
const emit = defineEmits<{ close: []; confirm: [] }>()
const { t } = useI18n()
const cancelButton = useTemplateRef<HTMLButtonElement>('cancelButton')
function close() {
  if (!props.busy) emit('close')
}
</script>

<template>
  <Dialog :open="open" :initial-focus="cancelButton" class="relative z-[110]" @close="close">
    <div class="fixed inset-0 bg-black/40" aria-hidden="true" />
    <div class="fixed inset-0 flex items-center justify-center p-4">
      <DialogPanel :aria-busy="busy" class="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800" @keydown.esc.stop.prevent="close">
        <DialogTitle class="text-base font-semibold text-gray-900 dark:text-gray-100">
          {{ t('clearHistoryTitle') }}
        </DialogTitle>
        <DialogDescription class="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          {{ t('clearHistoryDescription', { count }) }}
        </DialogDescription>
        <div class="mt-5 flex justify-end gap-3">
          <button ref="cancelButton" type="button" :disabled="busy" class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800" @click="close">
            {{ t('cancel') }}
          </button>
          <button type="button" :disabled="busy" class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-50" @click="emit('confirm')">
            {{ t(busy ? 'historyClearing' : 'clearHistoryConfirm') }}
          </button>
        </div>
      </DialogPanel>
    </div>
  </Dialog>
</template>
