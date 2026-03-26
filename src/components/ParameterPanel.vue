<script setup lang="ts">
import { computed } from 'vue'
import { getAspectRatios, getImageSizes, getResolution, THINKING_LEVELS } from '../config/models'
import type { GenerationConfig, Provider } from '../types'
import { useI18n } from '../composables/useI18n'

const props = defineProps<{ modelId: string; provider: Provider }>()
const config = defineModel<GenerationConfig>({ required: true })

const { t } = useI18n()

const aspectRatios = computed(() => getAspectRatios(props.modelId))
const imageSizes = computed(() => getImageSizes(props.modelId))
const resolution = computed(() => getResolution(config.value.aspectRatio ?? '1:1', config.value.imageSize ?? '1K'))

function setAspectRatio(ratio: string) {
  config.value = { ...config.value, aspectRatio: ratio }
}

function setImageSize(size: GenerationConfig['imageSize']) {
  // If current size is not available for this model, reset
  const validValues = imageSizes.value.map((s) => s.value)
  const newSize = validValues.includes(size as any) ? size : (validValues[0] as GenerationConfig['imageSize'])
  config.value = { ...config.value, imageSize: newSize }
}

function setThinkingLevel(level: GenerationConfig['thinkingLevel']) {
  config.value = { ...config.value, thinkingLevel: level }
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
      {{ t('parameters') }}
    </h3>

    <!-- Image Size -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {{ t('imageSize') }}
      </label>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="size in imageSizes"
          :key="size.value"
          @click="setImageSize(size.value as GenerationConfig['imageSize'])"
          :class="[
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
            config.imageSize === size.value
              ? 'bg-violet-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700',
          ]"
        >
          {{ size.label }}
        </button>
      </div>
    </div>

    <!-- Aspect Ratio -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {{ t('aspectRatio') }}
      </label>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="ratio in aspectRatios"
          :key="ratio"
          @click="setAspectRatio(ratio)"
          :class="[
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
            config.aspectRatio === ratio
              ? 'bg-violet-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700',
          ]"
        >
          {{ ratio }}
        </button>
      </div>
      <p v-if="resolution" class="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
        {{ t('outputResolution') }}: {{ resolution }}
      </p>
    </div>

    <!-- Thinking Level (Gemini only) -->
    <div v-if="props.provider === 'gemini'">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {{ t('thinkingLevel') }}
      </label>
      <div class="flex gap-1.5">
        <button
          v-for="level in THINKING_LEVELS"
          :key="level.value"
          @click="setThinkingLevel(level.value as GenerationConfig['thinkingLevel'])"
          :class="[
            'rounded-md px-3 py-1 text-xs font-medium transition-colors cursor-pointer',
            config.thinkingLevel === level.value
              ? 'bg-violet-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700',
          ]"
        >
          {{ level.value === 'MINIMAL' ? t('thinkingMinimal') : t('thinkingHigh') }}
        </button>
      </div>
    </div>

    <!-- Google Search (Gemini only) -->
    <div v-if="props.provider === 'gemini'" class="flex items-center justify-between">
      <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ t('googleSearch') }}
      </label>
      <button
        @click="config = { ...config, googleSearch: !config.googleSearch }"
        :class="[
          'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900',
          config.googleSearch ? 'bg-violet-600' : 'bg-gray-300 dark:bg-gray-700',
        ]"
      >
        <span
          :class="[
            'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
            config.googleSearch ? 'translate-x-4' : 'translate-x-0',
          ]"
        />
      </button>
    </div>

    <!-- Person Generation (Gemini only) -->
    <div v-if="props.provider === 'gemini'">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {{ t('personGeneration') }}
      </label>
      <select
        :value="config.personGeneration ?? 'ALLOW_ALL'"
        @change="config = { ...config, personGeneration: ($event.target as HTMLSelectElement).value as GenerationConfig['personGeneration'] }"
        class="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
      >
        <option value="ALLOW_ALL">{{ t('personAllowAll') }}</option>
        <option value="ALLOW_ADULT">{{ t('personAdultOnly') }}</option>
        <option value="ALLOW_NONE">{{ t('personNone') }}</option>
      </select>
    </div>
  </div>
</template>
