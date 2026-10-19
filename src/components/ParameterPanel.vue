<script setup lang="ts">
import { computed } from 'vue'
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/vue'
import { getAspectRatios, getImageSizes, getResolution, getUnsupportedImageSizes, getThinkingLevels, estimateImageOutputCost, supportsGoogleSearch, supportsImageConfiguration, supportsImageQuality, supportsSeedParameter, isMaiImageModel, isGptImageModel, getImageQualities, resolveImageQuality, MODEL_PRICING, supportsImageSizeConfiguration } from '../config/models'
import type { GenerationConfig, DownloadFormat, ImageQuality, Provider } from '../types'
import type { MessageKey } from '../i18n/messages'
import { useI18n } from '../composables/useI18n'

const props = defineProps<{ modelId: string; provider: Provider; notifyOnEnd: boolean; suggestAspectRatio: boolean }>()
const config = defineModel<GenerationConfig>({ required: true })
const downloadFormat = defineModel<DownloadFormat>('downloadFormat', { required: true })
const resizeAsPng = defineModel<boolean>('resizeAsPng', { required: true })

defineEmits<{
  (e: 'notify-change', value: boolean): void
  (e: 'suggest-aspect-ratio-change', value: boolean): void
}>()

const { t } = useI18n()

const aspectRatios = computed(() => getAspectRatios(props.modelId))
const imageSizes = computed(() => getImageSizes(props.modelId, props.provider))
const resolution = computed(() => getResolution(config.value.aspectRatio ?? '1:1', config.value.imageSize ?? '1K', props.modelId, props.provider))
const tokenPricing = computed(() => isMaiImageModel(props.modelId) || isGptImageModel(props.modelId) ? MODEL_PRICING[props.modelId] : undefined)
const selectedImageQuality = computed(() => resolveImageQuality(props.modelId, config.value.imageQuality))
const qualityLabelKeys: Record<ImageQuality, MessageKey> = {
  auto: 'qualityAuto', low: 'qualityLow', medium: 'qualityMedium', high: 'qualityHigh', xhigh: 'qualityXhigh', max: 'qualityMax',
}
const unsupportedSizes = computed(() => getUnsupportedImageSizes(props.provider))
function isSizeDisabled(size: string) {
  return unsupportedSizes.value.includes(size)
}
function sizeDisabledTitle(size: string) {
  if (isSizeDisabled(size)) return t('imageSizeNotSupported')
  return isGptImageModel(props.modelId) && size !== '1K' ? t('gptImageSizeHint') : undefined
}

function setAspectRatio(ratio: string) {
  config.value = { ...config.value, aspectRatio: ratio }
}

function setImageSize(size: GenerationConfig['imageSize']) {
  if (size && isSizeDisabled(size)) return
  // If current size is not available for this model, reset
  const validValues = imageSizes.value.map((s) => s.value)
  const newSize = validValues.includes(size as any) ? size : (validValues[0] as GenerationConfig['imageSize'])
  config.value = { ...config.value, imageSize: newSize }
}

function setThinkingLevel(level: GenerationConfig['thinkingLevel']) {
  config.value = { ...config.value, thinkingLevel: level }
}

function setImageQuality(quality: GenerationConfig['imageQuality']) {
  config.value = { ...config.value, imageQuality: quality }
}

function setSeed(event: Event) {
  const value = (event.target as HTMLInputElement).value.trim()
  if (value === '') {
    const { seed: _seed, ...rest } = config.value
    config.value = rest
    return
  }

  const seed = Number(value)
  if (Number.isSafeInteger(seed)) config.value = { ...config.value, seed }
}

function setBatchSize(size: number) {
  config.value = { ...config.value, batchSize: Math.max(1, Math.min(9, size)) }
}

const estimatedTotalCost = computed(() =>
  estimateImageOutputCost(
    props.modelId,
    isMaiImageModel(props.modelId) && config.value.aspectRatio === 'auto' ? '1K' : config.value.imageSize ?? '1K',
    config.value.batchSize ?? 1,
    selectedImageQuality.value,
    props.provider,
    config.value.aspectRatio ?? '1:1',
  )
)

function formatCost(cost: number): string {
  if (isGptImageModel(props.modelId)) return cost.toFixed(3)
  if (cost < 0.001) return cost.toFixed(6)
  if (cost < 0.1) return cost.toFixed(4)
  return cost.toFixed(2)
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
      {{ t('parameters') }}
    </h3>

    <!-- Image Size -->
    <div v-if="supportsImageSizeConfiguration(props.modelId, props.provider) && !((isMaiImageModel(props.modelId) || isGptImageModel(props.modelId)) && config.aspectRatio === 'auto')">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {{ t('imageSize') }}
      </label>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="size in imageSizes"
          :key="size.value"
          @click="setImageSize(size.value as GenerationConfig['imageSize'])"
          :disabled="isSizeDisabled(size.value)"
          :title="sizeDisabledTitle(size.value)"
          :class="[
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            isSizeDisabled(size.value)
              ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
              : config.imageSize === size.value
                ? 'bg-violet-600 text-white cursor-pointer'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer',
          ]"
        >
          {{ size.label }}
        </button>
      </div>
    </div>

    <!-- Aspect Ratio -->
    <div v-if="supportsImageConfiguration(props.modelId)">
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
          {{ ratio === 'auto' ? t('aspectRatioAuto') : ratio }}
        </button>
      </div>
      <p v-if="resolution" class="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
        {{ t('outputResolution') }}: {{ resolution }}
      </p>
    </div>

    <!-- Rendering Quality -->
    <div v-if="supportsImageQuality(props.modelId)">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {{ t('imageQuality') }}
      </label>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="quality in getImageQualities(props.modelId)"
          :key="quality"
          @click="setImageQuality(quality)"
          :class="[
            'rounded-md px-3 py-1 text-xs font-medium transition-colors cursor-pointer',
            selectedImageQuality === quality
              ? 'bg-violet-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700',
          ]"
        >
          {{ t(qualityLabelKeys[quality]) }}
        </button>
      </div>
    </div>

    <div v-if="isGptImageModel(props.modelId)">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('imageBackground') }}</label>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="background in (['auto', 'opaque', 'transparent'] as const)"
          :key="background"
          type="button"
          @click="config = { ...config, imageBackground: background }"
          :class="[
            'rounded-md px-3 py-1 text-xs font-medium transition-colors cursor-pointer',
            (config.imageBackground ?? 'auto') === background
              ? 'bg-violet-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700',
          ]"
        >
          {{ t(background === 'auto' ? 'qualityAuto' : background === 'opaque' ? 'backgroundOpaque' : 'backgroundTransparent') }}
        </button>
      </div>
    </div>

    <!-- Seed (Seedream 5.0 Lite only) -->
    <div v-if="supportsSeedParameter(props.modelId)">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2" for="generation-seed">
        {{ t('seed') }}
      </label>
      <input
        id="generation-seed"
        type="number"
        step="1"
        :value="config.seed"
        :placeholder="t('seedRandom')"
        class="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
        @change="setSeed"
      />
      <p class="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
        {{ t('seedHint') }}
      </p>
    </div>

    <!-- Thinking Level (Gemini only) -->
    <div v-if="props.provider === 'gemini'">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {{ t('thinkingLevel') }}
      </label>
      <div class="flex gap-1.5">
        <button
          v-for="level in getThinkingLevels(props.modelId)"
          :key="level.value"
          @click="setThinkingLevel(level.value as GenerationConfig['thinkingLevel'])"
          :class="[
            'rounded-md px-3 py-1 text-xs font-medium transition-colors cursor-pointer',
            config.thinkingLevel === level.value
              ? 'bg-violet-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700',
          ]"
        >
          {{ level.value === 'MINIMAL' ? t('thinkingMinimal') : level.value === 'MEDIUM' ? t('thinkingMedium') : t('thinkingHigh') }}
        </button>
      </div>
    </div>

    <!-- Google Search (Gemini only, not supported by Flash Lite Image) -->
    <div v-if="props.provider === 'gemini' && supportsGoogleSearch(props.modelId)" class="flex items-center justify-between">
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

    <!-- Bing Search (MAI only) -->
    <div v-if="isMaiImageModel(props.modelId)" class="flex items-center justify-between gap-3">
      <div class="relative flex items-center gap-1.5">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
          {{ t('webGrounding') }}
        </span>
        <Popover class="flex">
          <PopoverButton
            :aria-label="t('webGroundingInfo')"
            class="inline-flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 cursor-pointer"
          >
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <circle cx="10" cy="10" r="7.25" />
              <path d="M10 9v5" stroke-linecap="round" />
              <circle cx="10" cy="6" r="0.75" fill="currentColor" stroke="none" />
            </svg>
          </PopoverButton>
          <PopoverPanel class="absolute left-0 top-full z-50 mt-2 w-60 max-w-[calc(100vw-3rem)] rounded-lg border border-gray-200 bg-white p-3 text-xs leading-relaxed text-gray-600 shadow-lg dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
            <p>{{ t('maiImageHint') }}</p>
            <p class="mt-2">{{ t('maiWebGroundingPrice') }}</p>
          </PopoverPanel>
        </Popover>
      </div>
      <button
        type="button"
        role="switch"
        :aria-checked="config.webGrounding ?? false"
        :aria-label="t('webGrounding')"
        @click="config = { ...config, webGrounding: !config.webGrounding }"
        :class="[
          'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900',
          config.webGrounding ? 'bg-violet-600' : 'bg-gray-300 dark:bg-gray-700',
        ]"
      >
        <span
          :class="[
            'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
            config.webGrounding ? 'translate-x-4' : 'translate-x-0',
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

    <!-- Batch Size -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {{ t('batchSize') }}
      </label>
      <div class="flex items-center gap-3">
        <input
          type="range"
          min="1"
          max="9"
          :value="config.batchSize ?? 1"
          @input="setBatchSize(Number(($event.target as HTMLInputElement).value))"
          class="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-violet-600"
        />
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300 w-6 text-center">{{ config.batchSize ?? 1 }}</span>
      </div>
      <div v-if="estimatedTotalCost != null" class="relative mt-1.5 flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
        <span>{{ t('estCostTotal') }}: ~${{ formatCost(estimatedTotalCost) }}</span>
        <Popover v-if="isGptImageModel(props.modelId)" class="flex">
          <PopoverButton :aria-label="t('costEstimateInfo')" class="inline-flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 cursor-pointer">
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <circle cx="10" cy="10" r="7.25" />
              <path d="M10 9v5" stroke-linecap="round" />
              <circle cx="10" cy="6" r="0.75" fill="currentColor" stroke="none" />
            </svg>
          </PopoverButton>
          <PopoverPanel class="absolute left-0 top-full z-50 mt-2 w-60 max-w-[calc(100vw-3rem)] rounded-lg border border-gray-200 bg-white p-3 text-xs leading-relaxed text-gray-600 shadow-lg dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
            <p>{{ t('gptImageOutputCostHint') }}</p>
            <p v-if="props.provider === 'openrouter'" class="mt-2">{{ t('gptOpenRouterCostHint') }}</p>
          </PopoverPanel>
        </Popover>
      </div>
      <p v-else-if="tokenPricing" class="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
        {{ t('imageTokenPricing').replace('{text}', String(tokenPricing.inputText)).replace('{image}', String(tokenPricing.inputImage)).replace('{output}', String(tokenPricing.outputImage)) }}
      </p>
    </div>

    <!-- Download Format -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {{ t('downloadFormat') }}
      </label>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="fmt in (['png', 'jpg', 'webp'] as const)"
          :key="fmt"
          @click="downloadFormat = fmt"
          :class="[
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
            downloadFormat === fmt
              ? 'bg-violet-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700',
          ]"
        >
          {{ fmt === 'png' ? t('formatPng') : fmt === 'jpg' ? t('formatJpg') : t('formatWebp') }}
        </button>
      </div>
    </div>

    <!-- Reference Image Resize Format -->
    <div class="flex items-center justify-between">
      <label for="resize-images-as-png" class="text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ t('resizeImagesAsPng') }}
      </label>
      <button
        id="resize-images-as-png"
        type="button"
        role="switch"
        :aria-checked="resizeAsPng"
        @click="resizeAsPng = !resizeAsPng"
        :class="[
          'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900',
          resizeAsPng ? 'bg-violet-600' : 'bg-gray-300 dark:bg-gray-700',
        ]"
      >
        <span
          :class="[
            'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
            resizeAsPng ? 'translate-x-4' : 'translate-x-0',
          ]"
        />
      </button>
    </div>

    <!-- Notify on Completion -->
    <div class="flex items-center justify-between">
      <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ t('notifyOnEnd') }}
      </label>
      <button
        @click="$emit('notify-change', !notifyOnEnd)"
        :class="[
          'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900',
          notifyOnEnd ? 'bg-violet-600' : 'bg-gray-300 dark:bg-gray-700',
        ]"
      >
        <span
          :class="[
            'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
            notifyOnEnd ? 'translate-x-4' : 'translate-x-0',
          ]"
        />
      </button>
    </div>

    <!-- Suggest Aspect Ratio on first reference image -->
    <div class="flex items-center justify-between">
      <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ t('suggestAspectRatio') }}
      </label>
      <button
        @click="$emit('suggest-aspect-ratio-change', !suggestAspectRatio)"
        :class="[
          'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900',
          suggestAspectRatio ? 'bg-violet-600' : 'bg-gray-300 dark:bg-gray-700',
        ]"
      >
        <span
          :class="[
            'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
            suggestAspectRatio ? 'translate-x-4' : 'translate-x-0',
          ]"
        />
      </button>
    </div>
  </div>
</template>
