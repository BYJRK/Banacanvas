<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionRoot,
  TransitionChild,
} from '@headlessui/vue'
import { useApiKeyStore } from '../stores/apiKey'
import { useI18n } from '../composables/useI18n'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const apiKeyStore = useApiKeyStore()
const inputKey = ref(apiKeyStore.apiKey)
const { t } = useI18n()

watch(
  () => props.open,
  (val) => {
    if (val) inputKey.value = apiKeyStore.apiKey
  },
)

function save() {
  apiKeyStore.setApiKey(inputKey.value)
  emit('close')
}

function clear() {
  apiKeyStore.clearApiKey()
  inputKey.value = ''
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
            class="w-full max-w-md rounded-xl bg-white dark:bg-gray-900 p-6 shadow-xl ring-1 ring-gray-200 dark:ring-gray-800"
          >
            <DialogTitle class="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {{ t('apiKeyTitle') }}
            </DialogTitle>

            <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {{ t('apiKeyDescription') }}
            </p>

            <div
              class="mt-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-700 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800"
            >
              {{ t('apiKeyWarning') }}
            </div>

            <div class="mt-4">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ t('apiKeyLabel') }}
              </label>
              <input
                v-model="inputKey"
                type="password"
                :placeholder="t('apiKeyPlaceholder')"
                class="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                @keydown.enter="save"
              />
            </div>

            <div class="mt-5 flex items-center justify-between">
              <button
                v-if="apiKeyStore.hasKey"
                @click="clear"
                class="text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                :title="t('clearKey')"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <span v-else />
              <div class="flex gap-2">
                <button
                  @click="emit('close')"
                  class="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                  :title="t('cancel')"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <button
                  @click="save"
                  :disabled="!inputKey.trim()"
                  class="rounded-lg bg-violet-600 p-2 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  :title="t('save')"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
              </div>
            </div>
          </DialogPanel>
        </TransitionChild>
      </div>
    </Dialog>
  </TransitionRoot>
</template>
