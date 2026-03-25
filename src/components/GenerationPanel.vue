<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Listbox,
  ListboxButton,
  ListboxOptions,
  ListboxOption,
} from '@headlessui/vue'
import { AVAILABLE_MODELS } from '../config/models'
import type { ModelOption, InputImage } from '../types'
import { useI18n } from '../composables/useI18n'
import type { MessageKey } from '../i18n/messages'

const MAX_IMAGES = 14

const { t } = useI18n()

const modelDescKeys: Record<string, MessageKey> = {
  'gemini-3.1-flash-image-preview': 'modelNanoBanana2Desc',
  'gemini-3-pro-image-preview': 'modelNanoBananaProDesc',
}

const prompt = defineModel<string>('prompt', { default: '' })
const selectedModel = defineModel<ModelOption>('model', { required: true })
const inputImages = defineModel<InputImage[]>('inputImages', { default: () => [] })

const emit = defineEmits<{
  (e: 'generate'): void
  (e: 'cancel'): void
}>()

defineProps<{
  loading: boolean
}>()

const dragOver = ref(false)
const fileInput = ref<HTMLInputElement>()
const showFullscreenPrompt = ref(false)

// Drag reorder state
const dragIdx = ref<number | null>(null)
const dropIdx = ref<number | null>(null)

const canGenerate = computed(() => prompt.value.trim().length > 0)
const canAddMore = computed(() => inputImages.value.length < MAX_IMAGES)

function handleDrop(e: DragEvent) {
  dragOver.value = false
  if (!e.dataTransfer?.files?.length) return
  addFiles(e.dataTransfer.files)
}

function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.length) {
    addFiles(input.files)
    input.value = ''
  }
}

function addFiles(files: FileList) {
  const remaining = MAX_IMAGES - inputImages.value.length
  const toAdd = Array.from(files)
    .filter((f) => f.type.startsWith('image/'))
    .slice(0, remaining)

  for (const file of toAdd) {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const [header, data] = result.split(',')
      const mimeType = header.match(/data:(.*?);/)?.[1] ?? 'image/png'
      inputImages.value = [
        ...inputImages.value,
        { id: crypto.randomUUID(), base64: data, mimeType },
      ]
    }
    reader.readAsDataURL(file)
  }
}

function removeImage(id: string) {
  inputImages.value = inputImages.value.filter((img) => img.id !== id)
}

function clearAllImages() {
  inputImages.value = []
}

function openFilePicker() {
  fileInput.value?.click()
}

// Drag reorder handlers
function onThumbDragStart(idx: number) {
  dragIdx.value = idx
}

function onThumbDragOver(e: DragEvent, idx: number) {
  e.preventDefault()
  dropIdx.value = idx
}

function onThumbDragEnd() {
  if (dragIdx.value !== null && dropIdx.value !== null && dragIdx.value !== dropIdx.value) {
    const items = [...inputImages.value]
    const [moved] = items.splice(dragIdx.value, 1)
    items.splice(dropIdx.value, 0, moved)
    inputImages.value = items
  }
  dragIdx.value = null
  dropIdx.value = null
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Model selector -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('model') }}</label>
      <Listbox v-model="selectedModel">
        <div class="relative">
          <ListboxButton
            class="relative w-full cursor-pointer rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 py-2 pl-3 pr-10 text-left text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <span class="block truncate">{{ selectedModel.name }}</span>
            <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
              ▾
            </span>
          </ListboxButton>
          <ListboxOptions
            class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-1 text-sm shadow-lg focus:outline-none"
          >
            <ListboxOption
              v-for="model in AVAILABLE_MODELS"
              :key="model.id"
              :value="model"
              v-slot="{ active, selected }"
            >
              <li
                :class="[
                  'cursor-pointer select-none px-3 py-2',
                  active ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-900 dark:text-violet-200' : 'text-gray-900 dark:text-gray-100',
                ]"
              >
                <div class="flex items-center justify-between">
                  <div>
                    <span :class="['font-medium', selected ? 'text-violet-600 dark:text-violet-400' : '']">
                      {{ model.name }}
                    </span>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t(modelDescKeys[model.id] ?? 'modelNanoBanana2Desc') }}</p>
                  </div>
                  <span v-if="selected" class="text-violet-600 dark:text-violet-400">✓</span>
                </div>
              </li>
            </ListboxOption>
          </ListboxOptions>
        </div>
      </Listbox>
    </div>

    <!-- Prompt input -->
    <div>
      <div class="flex items-center justify-between mb-1">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('prompt') }}</label>
        <button
          @click="showFullscreenPrompt = true"
          class="text-gray-400 hover:text-violet-500 transition-colors cursor-pointer"
          :title="t('fullscreenEdit')"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9m11.25-5.25v4.5m0-4.5h-4.5m4.5 0L15 9m-11.25 11.25v-4.5m0 4.5h4.5m-4.5 0L9 15m11.25 5.25v-4.5m0 4.5h-4.5m4.5 0L15 15" />
          </svg>
        </button>
      </div>
      <textarea
        v-model="prompt"
        rows="4"
        :placeholder="t('promptPlaceholder')"
        class="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
        @keydown.ctrl.enter="canGenerate && !loading && $emit('generate')"
      />
    </div>

    <!-- Image upload for image-to-image -->
    <div>
      <div class="flex items-center justify-between mb-1">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {{ t('referenceImages') }}
          <span class="font-normal text-gray-400">({{ inputImages.length }}/{{ MAX_IMAGES }})</span>
        </label>
        <button
          v-if="inputImages.length > 0"
          @click="clearAllImages"
          class="text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
          :title="t('clearAll')"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      <!-- Thumbnail grid with drag reorder -->
      <div v-if="inputImages.length > 0" class="flex flex-wrap gap-1.5 mb-2">
        <div
          v-for="(img, idx) in inputImages"
          :key="img.id"
          draggable="true"
          @dragstart="onThumbDragStart(idx)"
          @dragover="onThumbDragOver($event, idx)"
          @dragend="onThumbDragEnd"
          :class="[
            'group relative w-14 h-14 rounded-md overflow-hidden border-2 cursor-grab active:cursor-grabbing transition-all',
            dragIdx === idx ? 'opacity-40 scale-95' : '',
            dropIdx === idx && dragIdx !== null && dragIdx !== idx ? 'border-violet-500' : 'border-transparent',
          ]"
        >
          <img
            :src="`data:${img.mimeType};base64,${img.base64}`"
            class="w-full h-full object-cover"
            draggable="false"
          />
          <button
            @click.stop="removeImage(img.id)"
            class="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          >
            ×
          </button>
          <span class="absolute bottom-0 left-0 w-full bg-black/50 text-white text-[9px] text-center leading-tight">
            {{ idx + 1 }}
          </span>
        </div>
      </div>

      <!-- Upload zone -->
      <div
        v-if="canAddMore"
        @drop.prevent="handleDrop"
        @dragover.prevent="dragOver = true"
        @dragleave="dragOver = false"
        @click="openFilePicker"
        :class="[
          'flex flex-col items-center justify-center rounded-lg border-2 border-dashed cursor-pointer transition-colors',
          inputImages.length > 0 ? 'p-3' : 'p-6',
          dragOver
            ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
            : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600',
        ]"
      >
        <svg class="w-6 h-6 text-gray-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {{ inputImages.length > 0 ? t('addMoreImages') : t('dropImages') }}
        </p>
      </div>
      <input ref="fileInput" type="file" accept="image/*" multiple class="hidden" @change="handleFileSelect" />
    </div>

    <!-- Generate + Cancel buttons -->
    <div class="flex gap-2">
    <button
      @click="$emit('generate')"
      :disabled="!canGenerate || loading"
      :class="[
        'flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all cursor-pointer',
        loading
          ? 'bg-gray-400 dark:bg-gray-600 text-white cursor-wait'
          : 'bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed',
      ]"
    >
      <span v-if="loading" class="flex items-center justify-center gap-2">
        <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        {{ t('generating') }}
      </span>
      <span v-else class="flex items-center justify-center gap-1.5">
        <svg v-if="inputImages.length > 0" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
        <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
        </svg>
        {{ inputImages.length > 0 ? t('editImage') : t('generateImage') }}
        <kbd class="ml-0.5 text-xs opacity-60">Ctrl+↵</kbd>
      </span>
    </button>
    <button
      v-if="loading"
      @click="$emit('cancel')"
      class="rounded-lg px-3 py-2.5 text-sm font-semibold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors cursor-pointer"
      :title="t('cancelGeneration')"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
    </div>

    <!-- Fullscreen prompt editor -->
    <Teleport to="body">
      <div
        v-if="showFullscreenPrompt"
        class="fixed inset-0 z-[100] flex flex-col bg-white dark:bg-gray-900"
      >
        <!-- Header -->
        <div class="shrink-0 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-6 py-3">
          <div class="flex items-center gap-3">
            <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">{{ t('prompt') }}</h2>
            <span class="text-xs text-gray-400">{{ prompt.length }} {{ t('promptCharCount') }}</span>
          </div>
          <button
            @click="showFullscreenPrompt = false"
            class="rounded-lg bg-violet-600 p-2 text-white hover:bg-violet-700 transition-colors cursor-pointer"
            :title="t('done')"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
        <!-- Editor -->
        <textarea
          v-model="prompt"
          :placeholder="t('promptPlaceholder')"
          class="flex-1 w-full px-6 py-4 text-base text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none resize-none"
          autofocus
          @keydown.escape="showFullscreenPrompt = false"
        />
      </div>
    </Teleport>
  </div>
</template>
