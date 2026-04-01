<script setup lang="ts">
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionRoot,
  TransitionChild,
} from '@headlessui/vue'
import { useI18n } from '../composables/useI18n'

const props = defineProps<{
  open: boolean
  imageWidth: number
  imageHeight: number
  suggestedRatio: string
}>()

const emit = defineEmits<{
  (e: 'apply'): void
  (e: 'close'): void
}>()

const { t } = useI18n()

function descriptionText() {
  return t('aspectRatioSuggestionDesc')
    .replace('{width}', String(props.imageWidth))
    .replace('{height}', String(props.imageHeight))
    .replace('{ratio}', props.suggestedRatio)
}
</script>

<template>
  <TransitionRoot :show="open" as="template">
    <Dialog @close="emit('close')" class="relative z-50">
      <TransitionChild
        enter="ease-out duration-200"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-150"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-black/40" />
      </TransitionChild>

      <div class="fixed inset-0 flex items-center justify-center p-4">
        <TransitionChild
          enter="ease-out duration-200"
          enter-from="opacity-0 scale-95"
          enter-to="opacity-100 scale-100"
          leave="ease-in duration-150"
          leave-from="opacity-100 scale-100"
          leave-to="opacity-0 scale-95"
        >
          <DialogPanel
            class="w-full max-w-sm rounded-xl bg-white dark:bg-gray-900 p-6 shadow-xl ring-1 ring-gray-200 dark:ring-gray-800"
          >
            <DialogTitle class="text-base font-semibold text-gray-900 dark:text-gray-100">
              {{ t('aspectRatioSuggestionTitle') }}
            </DialogTitle>

            <p class="mt-3 text-sm text-gray-600 dark:text-gray-400">
              {{ descriptionText() }}
            </p>

            <div class="mt-5 flex justify-end gap-3">
              <button
                type="button"
                class="rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
                @click="emit('close')"
              >
                {{ t('skip') }}
              </button>
              <button
                type="button"
                class="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
                @click="emit('apply')"
              >
                {{ t('apply') }}
              </button>
            </div>
          </DialogPanel>
        </TransitionChild>
      </div>
    </Dialog>
  </TransitionRoot>
</template>
