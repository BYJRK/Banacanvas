<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/vue'
import { groupModelsByAuthor } from '../config/modelGroups'
import { getModelDescriptionKey } from '../config/modelDescriptions'
import { useI18n } from '../composables/useI18n'
import type { ModelOption } from '../types'

const props = defineProps<{ models: ModelOption[] }>()
const selectedModel = defineModel<ModelOption>({ required: true })
const { t } = useI18n()
const groups = computed(() => groupModelsByAuthor(props.models))
const activeAuthor = ref<string | null>(null)
const activeGroup = computed(() => groups.value.find((group) => group.id === activeAuthor.value))
const options = ref<HTMLElement>()

async function showGroup(author: string | null) {
  activeAuthor.value = author
  await nextTick()
  const buttons = options.value?.querySelectorAll<HTMLButtonElement>('button')
  const selected = options.value?.querySelector<HTMLButtonElement>('button[aria-current="true"]')
  ;(selected ?? buttons?.[0])?.focus()
}

function moveFocus(event: KeyboardEvent) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  const buttons = [...(options.value?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
  if (!buttons.length) return
  event.preventDefault()
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
    : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
  buttons[next]?.focus()
}

function describeModel(model: ModelOption) {
  const key = getModelDescriptionKey(model)
  return key ? t(key) : model.description
}
</script>

<template>
  <Popover v-slot="{ close }" class="relative">
    <PopoverButton
      :aria-label="`${t('model')}: ${selectedModel.name}`"
      class="relative w-full cursor-pointer rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 py-2 pl-3 pr-10 text-left text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
      @click="activeAuthor = null"
    >
      <span class="block truncate">{{ selectedModel.name }}</span>
      <span aria-hidden="true" class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">▾</span>
    </PopoverButton>

    <PopoverPanel
      focus
      class="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm shadow-lg focus:outline-none"
      @keydown.left.prevent="activeGroup && showGroup(null)"
    >
      <div class="border-b border-gray-100 dark:border-gray-700 px-3 py-2">
        <button
          v-if="activeGroup"
          type="button"
          class="flex w-full items-center gap-2 rounded text-left font-medium text-gray-700 dark:text-gray-200 hover:text-violet-600 dark:hover:text-violet-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 cursor-pointer"
          :aria-label="t('backToModelAuthors')"
          @click="showGroup(null)"
        >
          <span aria-hidden="true">‹</span>
          {{ activeGroup.name }}
          <span class="ml-auto text-xs font-normal text-gray-400">{{ t('backToModelAuthors') }}</span>
        </button>
        <p v-else class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('chooseModelAuthor') }}</p>
      </div>

      <div
        ref="options"
        role="group"
        :aria-label="activeGroup ? `${activeGroup.name} · ${t('model')}` : t('chooseModelAuthor')"
        class="max-h-64 overflow-y-auto py-1"
        @keydown="moveFocus"
      >
        <template v-if="!activeGroup">
          <button
            v-for="group in groups"
            :key="group.id"
            type="button"
            :aria-current="group.models.some((model) => model.id === selectedModel.id) ? 'true' : undefined"
            class="flex w-full items-center gap-2 px-3 py-2.5 text-left text-gray-900 dark:text-gray-100 hover:bg-violet-50 dark:hover:bg-violet-900/30 focus:bg-violet-50 dark:focus:bg-violet-900/30 focus:outline-none cursor-pointer"
            @click="showGroup(group.id)"
            @keydown.right.prevent="showGroup(group.id)"
          >
            <span class="flex-1 font-medium">{{ group.name }}</span>
            <span v-if="group.models.some((model) => model.id === selectedModel.id)" aria-hidden="true" class="text-violet-600 dark:text-violet-400">✓</span>
            <span class="text-xs text-gray-400">{{ group.models.length }}</span>
            <span aria-hidden="true" class="text-gray-400">›</span>
          </button>
        </template>
        <template v-else>
          <button
            v-for="model in activeGroup.models"
            :key="model.id"
            type="button"
            :aria-current="model.id === selectedModel.id ? 'true' : undefined"
            class="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-violet-50 dark:hover:bg-violet-900/30 focus:bg-violet-50 dark:focus:bg-violet-900/30 focus:outline-none cursor-pointer"
            @click="selectedModel = model; close()"
          >
            <span class="min-w-0 flex-1">
              <span :class="['block font-medium', model.id === selectedModel.id ? 'text-violet-600 dark:text-violet-400' : 'text-gray-900 dark:text-gray-100']">{{ model.name }}</span>
              <span class="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{{ describeModel(model) }}</span>
            </span>
            <span v-if="model.id === selectedModel.id" aria-hidden="true" class="text-violet-600 dark:text-violet-400">✓</span>
          </button>
        </template>
      </div>
    </PopoverPanel>
  </Popover>
</template>
