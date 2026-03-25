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

const MAX_IMAGES = 14

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
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Model</label>
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
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ model.description }}</p>
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
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prompt</label>
      <textarea
        v-model="prompt"
        rows="4"
        placeholder="Describe the image you want to generate..."
        class="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
        @keydown.ctrl.enter="canGenerate && !loading && $emit('generate')"
      />
    </div>

    <!-- Image upload for image-to-image -->
    <div>
      <div class="flex items-center justify-between mb-1">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Reference Images
          <span class="font-normal text-gray-400">({{ inputImages.length }}/{{ MAX_IMAGES }})</span>
        </label>
        <button
          v-if="inputImages.length > 0"
          @click="clearAllImages"
          class="text-xs text-red-500 hover:underline cursor-pointer"
        >
          Clear all
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
          {{ inputImages.length > 0 ? 'Add more images' : 'Drop images here or click to upload' }}
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
        Generating...
      </span>
      <span v-else>
        {{ inputImages.length > 0 ? 'Edit Image' : 'Generate Image' }}
        <kbd class="ml-1 text-xs opacity-60">Ctrl+Enter</kbd>
      </span>
    </button>
    <button
      v-if="loading"
      @click="$emit('cancel')"
      class="rounded-lg px-3 py-2.5 text-sm font-semibold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors cursor-pointer"
      title="Cancel generation"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
    </div>
  </div>
</template>
