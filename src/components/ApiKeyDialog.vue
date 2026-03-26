<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionRoot,
  TransitionChild,
  Listbox,
  ListboxButton,
  ListboxOptions,
  ListboxOption,
} from '@headlessui/vue'
import { useApiKeyStore } from '../stores/apiKey'
import { useI18n } from '../composables/useI18n'
import type { Provider } from '../types'
import type { MessageKey } from '../i18n/messages'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const apiKeyStore = useApiKeyStore()
const { t } = useI18n()

const providerOptions: { value: Provider; labelKey: MessageKey; placeholderKey: MessageKey }[] = [
  { value: 'gemini', labelKey: 'providerGemini', placeholderKey: 'apiKeyPlaceholder' },
  { value: 'openrouter', labelKey: 'providerOpenRouter', placeholderKey: 'openRouterKeyPlaceholder' },
]

const selectedProvider = ref<Provider>('gemini')

// Per-provider key inputs
const keyInputs = ref<Record<Provider, string>>({
  gemini: '',
  openrouter: '',
})

const currentInput = computed({
  get: () => keyInputs.value[selectedProvider.value],
  set: (val: string) => { keyInputs.value[selectedProvider.value] = val },
})

const currentPlaceholder = computed(
  () => t(providerOptions.find((o) => o.value === selectedProvider.value)?.placeholderKey ?? 'apiKeyPlaceholder'),
)

const hasCurrentKey = computed(() => apiKeyStore.hasKeyFor(selectedProvider.value))

watch(
  () => props.open,
  (val) => {
    if (val) {
      keyInputs.value = {
        gemini: apiKeyStore.geminiKey,
        openrouter: apiKeyStore.openRouterKey,
      }
    }
  },
)

function save() {
  for (const opt of providerOptions) {
    apiKeyStore.setKey(opt.value, keyInputs.value[opt.value])
  }
  emit('close')
}

function clearCurrent() {
  apiKeyStore.clearKey(selectedProvider.value)
  keyInputs.value[selectedProvider.value] = ''
}

const canSave = computed(() =>
  providerOptions.some((opt) => keyInputs.value[opt.value].trim().length > 0),
)
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

            <!-- Provider selector -->
            <div class="mt-4">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ t('provider') }}
              </label>
              <Listbox v-model="selectedProvider">
                <div class="relative">
                  <ListboxButton
                    class="relative w-full cursor-pointer rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 py-2 pl-3 pr-10 text-left text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <span class="block truncate">{{ t(providerOptions.find((o) => o.value === selectedProvider)?.labelKey ?? 'providerGemini') }}</span>
                    <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
                      ▾
                    </span>
                  </ListboxButton>
                  <ListboxOptions
                    class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-1 text-sm shadow-lg focus:outline-none"
                  >
                    <ListboxOption
                      v-for="opt in providerOptions"
                      :key="opt.value"
                      :value="opt.value"
                      v-slot="{ active, selected }"
                    >
                      <li
                        :class="[
                          'cursor-pointer select-none px-3 py-2',
                          active ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-900 dark:text-violet-200' : 'text-gray-900 dark:text-gray-100',
                        ]"
                      >
                        <div class="flex items-center justify-between">
                          <span :class="['font-medium', selected ? 'text-violet-600 dark:text-violet-400' : '']">
                            {{ t(opt.labelKey) }}
                          </span>
                          <span v-if="selected" class="text-violet-600 dark:text-violet-400">✓</span>
                        </div>
                      </li>
                    </ListboxOption>
                  </ListboxOptions>
                </div>
              </Listbox>
            </div>

            <!-- API Key input (changes per selected provider) -->
            <div class="mt-4">
              <div class="flex items-center justify-between mb-1">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {{ t('apiKeyLabel') }}
                </label>
                <button
                  v-if="hasCurrentKey"
                  @click="clearCurrent"
                  class="text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                  :title="t('clearKey')"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              <input
                v-model="currentInput"
                type="password"
                :placeholder="currentPlaceholder"
                class="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                @keydown.enter="save"
              />
            </div>

            <div class="mt-5 flex items-center justify-end">
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
                  :disabled="!canSave"
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
