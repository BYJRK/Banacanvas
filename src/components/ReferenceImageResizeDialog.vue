<script setup lang="ts">
import { computed } from 'vue'
import { Dialog, DialogDescription, DialogPanel, DialogTitle } from '@headlessui/vue'
import type { ReferenceImageResizeRequest } from '../types'
import { useI18n } from '../composables/useI18n'

const props = defineProps<{ request: ReferenceImageResizeRequest | null }>()
const emit = defineEmits<{ decide: [resize: boolean] }>()
const { t } = useI18n()
const description = computed(() => {
  const request = props.request
  if (!request) return ''
  return t('referenceImageResizeDescription')
    .replace('{width}', String(request.width))
    .replace('{height}', String(request.height))
    .replace('{targetWidth}', String(request.targetWidth))
    .replace('{targetHeight}', String(request.targetHeight))
})
</script>

<template>
  <Dialog :open="request !== null" class="relative z-50" @close="emit('decide', false)">
    <div class="fixed inset-0 bg-black/40" aria-hidden="true" />
    <div class="fixed inset-0 flex items-center justify-center p-4">
      <DialogPanel class="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
        <DialogTitle class="text-base font-semibold text-gray-900 dark:text-gray-100">
          {{ t('referenceImageResizeTitle') }}
        </DialogTitle>
        <DialogDescription class="mt-3 text-sm text-gray-600 dark:text-gray-400">
          {{ description }}
        </DialogDescription>
        <div class="mt-5 flex justify-end gap-3">
          <button type="button" class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-500 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800" @click="emit('decide', false)">
            {{ t('referenceImageKeepOriginal') }}
          </button>
          <button type="button" class="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500" @click="emit('decide', true)">
            {{ t('referenceImageResizeConfirm') }}
          </button>
        </div>
      </DialogPanel>
    </div>
  </Dialog>
</template>
