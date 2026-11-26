<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from '../composables/useI18n'
import { useApiKeyStore } from '../stores/apiKey'
import { getModelDescriptionKey } from '../config/modelDescriptions'
import {
  CATALOG_PROVIDERS,
  buildModelCatalog,
  filterAndSortCatalog,
  formatCatalogUnitPrice,
  getCatalogOverviewStats,
  type CatalogCapability,
  type CatalogModelEntry,
  type CatalogProviderFilter,
  type CatalogSortBy,
} from '../config/modelCatalog'
import type { MessageKey } from '../i18n/messages'
import type { ModelOption, Provider } from '../types'

const props = defineProps<{
  currentModel: ModelOption
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'select', model: ModelOption): void
}>()

const { t, locale } = useI18n()
const apiKeyStore = useApiKeyStore()

const providerFilter = ref<CatalogProviderFilter>('all')
const authorFilter = ref('all')
const searchQuery = ref('')
const sortBy = ref<CatalogSortBy>('releaseDesc')
const viewMode = ref<'cards' | 'table'>('cards')

const providerLabelKeys: Record<Provider, MessageKey> = {
  gemini: 'providerGemini',
  openrouter: 'providerOpenRouter',
  vercel: 'providerVercel',
}

const providerShortNames: Record<Provider, string> = {
  gemini: 'Gemini',
  openrouter: 'OpenRouter',
  vercel: 'Vercel',
}

const capabilityLabelKeys: Record<CatalogCapability, MessageKey> = {
  thinking: 'catalogCapThinking',
  googleSearch: 'catalogCapGoogleSearch',
  webGrounding: 'catalogCapWebGrounding',
  transparentBg: 'catalogCapTransparentBg',
  qualityControl: 'catalogCapQuality',
  seed: 'catalogCapSeed',
}

const sortOptions: { value: CatalogSortBy; labelKey: MessageKey }[] = [
  { value: 'releaseDesc', labelKey: 'catalogSortReleaseDesc' },
  { value: 'releaseAsc', labelKey: 'catalogSortReleaseAsc' },
  { value: 'priceAsc', labelKey: 'catalogSortPriceAsc' },
  { value: 'priceDesc', labelKey: 'catalogSortPriceDesc' },
  { value: 'nameAsc', labelKey: 'catalogSortNameAsc' },
]

function describeModel(model: ModelOption): string {
  const key = getModelDescriptionKey(model)
  return key ? t(key) : model.description
}

function providerLabel(provider: Provider): string {
  return t(providerLabelKeys[provider])
}

const fullCatalog = computed(() => buildModelCatalog('all'))
const providerCounts = computed(() => ({
  all: fullCatalog.value.length,
  gemini: buildModelCatalog('gemini').length,
  openrouter: buildModelCatalog('openrouter').length,
  vercel: buildModelCatalog('vercel').length,
}))

const providerCatalog = computed(() => buildModelCatalog(providerFilter.value))

const authorOptions = computed(() => {
  const seen = new Map<string, { id: string; name: string; count: number }>()
  for (const entry of providerCatalog.value) {
    const existing = seen.get(entry.authorId)
    if (existing) existing.count += 1
    else seen.set(entry.authorId, { id: entry.authorId, name: entry.authorName, count: 1 })
  }
  return [...seen.values()]
})

watch(authorOptions, (authors) => {
  if (authorFilter.value !== 'all' && !authors.some((a) => a.id === authorFilter.value)) {
    authorFilter.value = 'all'
  }
})

const filteredEntries = computed(() => filterAndSortCatalog(providerCatalog.value, {
  query: searchQuery.value,
  authorId: authorFilter.value,
  sortBy: sortBy.value,
  getDescription: describeModel,
}))

const overviewStats = computed(() => getCatalogOverviewStats(
  filteredEntries.value.length > 0 ? filteredEntries.value : providerCatalog.value,
))

const maxReferenceCost = computed(() => {
  const costs = providerCatalog.value.map((e) => e.referenceCost)
  return Math.max(0.01, ...costs)
})

function formatReleaseDate(isoDate: string): string {
  if (!isoDate) return '—'
  const [y, m, d] = isoDate.split('-').map(Number)
  if (!y || !m || !d) return isoDate
  return new Intl.DateTimeFormat(locale.value === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)))
}

function isVariantActive(variant: ModelOption): boolean {
  return variant.provider === props.currentModel.provider && variant.id === props.currentModel.id
}

function isEntryActive(entry: CatalogModelEntry): boolean {
  return entry.variants.some(isVariantActive)
}

function priceBarWidth(cost: number): string {
  const pct = Math.min(100, Math.max(6, Math.round((cost / maxReferenceCost.value) * 100)))
  return `${pct}%`
}

function priceBarColor(cost: number): string {
  if (cost <= 0.025) return 'bg-emerald-500'
  if (cost >= 0.1) return 'bg-amber-500'
  return 'bg-violet-500'
}

function aspectRatioBadgeText(entry: CatalogModelEntry): string {
  const fixedCount = entry.aspectRatios.filter((r) => r !== 'auto').length
  return entry.hasAutoAspectRatio
    ? t('catalogAspectRatiosWithAuto', { count: fixedCount })
    : t('catalogAspectRatiosCount', { count: fixedCount })
}

function qualityRangeText(entry: CatalogModelEntry): string | undefined {
  const tier = entry.sizeTiers.find((s) => s.size === entry.referenceSize) ?? entry.sizeTiers[0]
  if (!tier || tier.minQualityCost == null || tier.maxQualityCost == null) return undefined
  return t('catalogQualityPriceRange', {
    size: tier.size === 'auto' ? '1K' : tier.size,
    min: formatCatalogUnitPrice(tier.minQualityCost, entry.isExactFlatPrice),
    max: formatCatalogUnitPrice(tier.maxQualityCost, entry.isExactFlatPrice),
  })
}

function tokenPricingText(entry: CatalogModelEntry): string | undefined {
  const p = entry.tokenPricing
  if (!p) return undefined
  if (p.inputImage != null && p.inputImage !== p.inputText) {
    return t('catalogTokenRatesWithImgIn', {
      text: p.inputText,
      image: p.inputImage,
      output: p.outputImage,
    })
  }
  return t('catalogTokenRates', {
    input: p.inputText,
    output: p.outputImage,
  })
}

function resetFilters() {
  providerFilter.value = 'all'
  authorFilter.value = 'all'
  searchQuery.value = ''
  sortBy.value = 'releaseDesc'
}
</script>

<template>
  <section class="max-w-7xl mx-auto w-full space-y-5 pb-6" :aria-label="t('modelCatalog')">
    <!-- Top navigation & header -->
    <div class="space-y-3">
      <button
        type="button"
        class="inline-flex items-center gap-2 text-xs font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
        @click="emit('back')"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 12H5m7-7l-7 7 7 7" />
        </svg>
        {{ t('backToWorkspace') }}
      </button>

      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            {{ t('modelCatalogTitle') }}
          </h1>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {{ t('modelCatalogSubtitle', { shown: filteredEntries.length, total: fullCatalog.length, providers: CATALOG_PROVIDERS.length }) }}
          </p>
        </div>

        <!-- View mode toggle -->
        <div class="inline-flex rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-0.5">
          <button
            type="button"
            :aria-label="t('catalogViewCards')"
            :aria-pressed="viewMode === 'cards'"
            :title="t('catalogViewCards')"
            class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer"
            :class="viewMode === 'cards'
              ? 'bg-violet-600 text-white'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'"
            @click="viewMode = 'cards'"
          >
            <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M3 3h6v6H3V3zm8 0h6v6h-6V3zM3 11h6v6H3v-6zm8 0h6v6h-6v-6z" />
            </svg>
            {{ t('catalogViewCards') }}
          </button>
          <button
            type="button"
            :aria-label="t('catalogViewTable')"
            :aria-pressed="viewMode === 'table'"
            :title="t('catalogViewTable')"
            class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer"
            :class="viewMode === 'table'
              ? 'bg-violet-600 text-white'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'"
            @click="viewMode = 'table'"
          >
            <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M3 4h14v3H3V4zm0 5h14v3H3V9zm0 5h14v3H3v-3z" />
            </svg>
            {{ t('catalogViewTable') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Overview stats strip -->
    <div v-if="overviewStats" class="grid grid-cols-1 sm:grid-cols-3 gap-3" data-catalog-stats>
      <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
        <p class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('catalogStatCheapest') }}</p>
        <p class="mt-1 text-lg font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
          {{ formatCatalogUnitPrice(overviewStats.minReferenceCost, true) }}
          <span class="text-xs font-normal text-gray-500 dark:text-gray-400">{{ t('catalogPerImage') }}</span>
        </p>
        <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate">
          {{ overviewStats.cheapestModelName }} · {{ t('catalogImagesPerDollar', { count: Math.max(1, Math.floor(1 / overviewStats.minReferenceCost)) }) }}
        </p>
      </div>

      <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
        <p class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('catalogStatMedian') }}</p>
        <p class="mt-1 text-lg font-semibold text-violet-600 dark:text-violet-400 tabular-nums">
          {{ formatCatalogUnitPrice(overviewStats.medianReferenceCost, false) }}
          <span class="text-xs font-normal text-gray-500 dark:text-gray-400">{{ t('catalogPerImage') }}</span>
        </p>
        <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate">
          {{ formatCatalogUnitPrice(overviewStats.minReferenceCost, false) }} – {{ formatCatalogUnitPrice(overviewStats.maxReferenceCost, false) }}
        </p>
      </div>

      <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
        <p class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('catalogStatNewest') }}</p>
        <p class="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
          {{ formatReleaseDate(overviewStats.newestReleaseDate) }}
        </p>
        <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate" :title="overviewStats.newestModelNames.join(' · ')">
          {{ overviewStats.newestModelNames.join(' · ') }}
        </p>
      </div>
    </div>

    <!-- Filter & search bar -->
    <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3.5 space-y-3">
      <div class="flex flex-col sm:flex-row gap-2.5">
        <!-- Search -->
        <div class="relative flex-1">
          <svg class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
          <input
            v-model="searchQuery"
            type="search"
            :placeholder="t('catalogSearchPlaceholder')"
            :aria-label="t('catalogSearchPlaceholder')"
            class="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 pl-9 pr-8 py-1.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <button
            v-if="searchQuery"
            type="button"
            :aria-label="t('catalogClearSearch')"
            class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
            @click="searchQuery = ''"
          >
            ✕
          </button>
        </div>

        <!-- Sort -->
        <div class="flex items-center gap-2 shrink-0">
          <label for="catalog-sort" class="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {{ t('catalogSortLabel') }}
          </label>
          <select
            id="catalog-sort"
            v-model="sortBy"
            class="rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 px-2.5 py-1.5 text-xs font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500 cursor-pointer"
          >
            <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">
              {{ t(opt.labelKey) }}
            </option>
          </select>
        </div>
      </div>

      <!-- Provider filter tabs -->
      <div class="flex flex-wrap items-center gap-1.5" role="group" :aria-label="t('provider')">
        <button
          v-for="prov in (['all', ...CATALOG_PROVIDERS] as const)"
          :key="prov"
          type="button"
          :data-provider-filter="prov"
          :aria-pressed="providerFilter === prov"
          class="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer"
          :class="providerFilter === prov
            ? 'bg-violet-600 text-white'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'"
          @click="providerFilter = prov"
        >
          <span>{{ prov === 'all' ? t('catalogAllProviders') : providerLabel(prov) }}</span>
          <span
            class="rounded-full px-1.5 py-0.2 text-[11px] tabular-nums"
            :class="providerFilter === prov ? 'bg-white/20 text-white' : 'bg-gray-200/80 dark:bg-gray-700 text-gray-600 dark:text-gray-400'"
          >
            {{ providerCounts[prov] }}
          </span>
        </button>
      </div>

      <!-- Author filter pills -->
      <div v-if="authorOptions.length > 1" class="flex flex-wrap items-center gap-1.5 pt-1 border-t border-gray-100 dark:border-gray-800" role="group" :aria-label="t('chooseModelAuthor')">
        <button
          type="button"
          :aria-pressed="authorFilter === 'all'"
          class="rounded-md px-2 py-0.5 text-xs font-medium transition-colors cursor-pointer"
          :class="authorFilter === 'all'
            ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'"
          @click="authorFilter = 'all'"
        >
          {{ t('catalogAllAuthors') }}
        </button>
        <button
          v-for="author in authorOptions"
          :key="author.id"
          type="button"
          :data-author-filter="author.id"
          :aria-pressed="authorFilter === author.id"
          class="rounded-md px-2 py-0.5 text-xs font-medium transition-colors cursor-pointer"
          :class="authorFilter === author.id
            ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'"
          @click="authorFilter = author.id"
        >
          {{ author.name }}
          <span class="opacity-60 tabular-nums">({{ author.count }})</span>
        </button>
      </div>
    </div>

    <p class="text-xs text-gray-500 dark:text-gray-400">
      {{ t('catalogPricingNote') }}
    </p>

    <!-- Empty state -->
    <div
      v-if="filteredEntries.length === 0"
      class="rounded-xl border border-dashed border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 p-10 text-center"
    >
      <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('catalogNoResults') }}</p>
      <button
        type="button"
        class="mt-3 rounded-lg bg-violet-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-violet-700 transition-colors cursor-pointer"
        @click="resetFilters"
      >
        {{ t('catalogResetFilters') }}
      </button>
    </div>

    <!-- Card View -->
    <div v-else-if="viewMode === 'cards'" class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <article
        v-for="entry in filteredEntries"
        :key="entry.baseId"
        :data-model-card="entry.baseId"
        class="flex flex-col justify-between rounded-xl border bg-white dark:bg-gray-900 p-4 transition-shadow hover:shadow-sm"
        :class="isEntryActive(entry)
          ? 'border-violet-400 dark:border-violet-600 ring-1 ring-violet-400/40 dark:ring-violet-600/40'
          : 'border-gray-200 dark:border-gray-800'"
      >
        <div class="space-y-3">
          <!-- Card header: Author, Release Date, Name, Price -->
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-1.5 text-xs">
                <span class="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 font-medium text-gray-700 dark:text-gray-300">
                  {{ entry.authorName }}
                </span>
                <span class="text-gray-500 dark:text-gray-400" :data-release-date="entry.releaseDate">
                  {{ t('catalogReleasedOn', { date: formatReleaseDate(entry.releaseDate) }) }}
                </span>
                <span
                  v-if="isEntryActive(entry)"
                  class="rounded-full bg-violet-100 dark:bg-violet-950/60 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:text-violet-300"
                >
                  {{ t('catalogCurrentModel') }}
                </span>
              </div>
              <h2 class="mt-1.5 text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                {{ entry.name }}
              </h2>
              <p class="font-mono text-[11px] text-gray-400 dark:text-gray-500 truncate">
                {{ entry.baseId }}
              </p>
            </div>

            <!-- Reference price & $1 intuition -->
            <div class="text-right shrink-0">
              <div class="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                {{ formatCatalogUnitPrice(entry.referenceCost, entry.isExactFlatPrice) }}
                <span class="text-xs font-normal text-gray-500 dark:text-gray-400">{{ t('catalogPerImage') }}</span>
              </div>
              <div class="flex items-center justify-end gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
                <span v-if="entry.supportsCustomSize" class="rounded bg-gray-100 dark:bg-gray-800 px-1 py-0.2">{{ entry.referenceSize }}</span>
                <span v-if="entry.imagesPerDollar > 0" class="text-emerald-600 dark:text-emerald-400 font-medium">
                  {{ t('catalogImagesPerDollar', { count: entry.imagesPerDollar }) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Visual relative price bar -->
          <div class="w-full h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden" aria-hidden="true">
            <div class="h-full rounded-full transition-all" :class="priceBarColor(entry.referenceCost)" :style="{ width: priceBarWidth(entry.referenceCost) }" />
          </div>

          <!-- Description -->
          <p class="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
            {{ describeModel(entry.activeModel) }}
          </p>

          <!-- Resolution & per-tier price breakdown -->
          <div class="space-y-1.5">
            <div class="flex flex-wrap gap-1.5" data-size-tiers>
              <div
                v-for="tier in entry.sizeTiers"
                :key="tier.size"
                class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60 px-2.5 py-1 text-xs tabular-nums"
              >
                <span class="font-semibold text-gray-800 dark:text-gray-200">
                  {{ tier.size === 'auto'
                    ? (entry.aspectRatios.length === 0 ? t('catalogAutoSizeAndRatio') : t('catalogAutoSize'))
                    : tier.size }}
                </span>
                <span v-if="tier.resolution" class="text-gray-400 dark:text-gray-500">
                  {{ tier.resolution }}
                </span>
                <span class="font-medium text-violet-600 dark:text-violet-400">
                  {{ formatCatalogUnitPrice(tier.unitCost, entry.isExactFlatPrice) }}
                </span>
                <span
                  v-if="tier.providerOnly"
                  class="rounded bg-amber-100/80 dark:bg-amber-950/50 px-1 text-[10px] text-amber-700 dark:text-amber-300"
                >
                  {{ tier.providerOnly.map((p) => providerShortNames[p]).join('/') }}
                </span>
              </div>
            </div>

            <p v-if="qualityRangeText(entry)" class="text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
              {{ qualityRangeText(entry) }}
            </p>
            <p v-if="tokenPricingText(entry)" class="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">
              {{ tokenPricingText(entry) }}
            </p>
          </div>

          <!-- Capabilities & limits badges -->
          <div class="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span
              v-if="entry.aspectRatios.length > 0"
              :title="entry.aspectRatios.join(', ')"
              class="rounded-md bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[11px] text-gray-600 dark:text-gray-300"
            >
              {{ aspectRatioBadgeText(entry) }}
            </span>
            <span class="rounded-md bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[11px] text-gray-600 dark:text-gray-300">
              {{ t('catalogMaxReferences', { count: entry.maxReferenceImages }) }}
            </span>
            <span
              v-for="cap in entry.capabilities"
              :key="cap"
              class="rounded-md bg-violet-50 dark:bg-violet-950/40 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:text-violet-300"
            >
              {{ t(capabilityLabelKeys[cap]) }}
            </span>
          </div>

          <!-- Provider differences note -->
          <p v-if="entry.providerDiffNote" class="text-[11px] text-amber-700 dark:text-amber-400/90 bg-amber-50/70 dark:bg-amber-950/25 rounded-lg px-2.5 py-1.5">
            {{ t(entry.providerDiffNote) }}
          </p>
        </div>

        <!-- Provider quick-select buttons -->
        <div class="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center gap-2">
          <button
            v-for="variant in entry.variants"
            :key="`${variant.provider}:${variant.id}`"
            type="button"
            :aria-label="t('catalogSelectProvider', { provider: providerLabel(variant.provider) })"
            class="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer"
            :class="isVariantActive(variant)
              ? 'border-violet-600 bg-violet-600 text-white'
              : providerFilter !== 'all' && variant.provider === providerFilter
                ? 'border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:border-violet-300 dark:hover:border-violet-700 hover:text-violet-600 dark:hover:text-violet-300'"
            @click="emit('select', variant)"
          >
            <span
              v-if="apiKeyStore.hasKeyFor(variant.provider)"
              class="h-1.5 w-1.5 rounded-full shrink-0"
              :class="isVariantActive(variant) ? 'bg-emerald-300' : 'bg-emerald-500'"
              :title="t('catalogKeyConfigured')"
            />
            <span>{{ providerLabel(variant.provider) }}</span>
            <span aria-hidden="true">{{ isVariantActive(variant) ? '✓' : '→' }}</span>
          </button>
        </div>
      </article>
    </div>

    <!-- Table View -->
    <div v-else class="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <table class="w-full text-left border-collapse text-xs">
        <thead>
          <tr class="border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400">
            <th class="py-2.5 px-3.5 font-semibold">{{ t('catalogColModel') }}</th>
            <th class="py-2.5 px-3 font-semibold whitespace-nowrap">{{ t('catalogColRelease') }}</th>
            <th class="py-2.5 px-3 font-semibold">{{ t('catalogColResolutions') }}</th>
            <th class="py-2.5 px-3 font-semibold whitespace-nowrap">{{ t('catalogColUnitPrice') }}</th>
            <th class="py-2.5 px-3 font-semibold">{{ t('catalogColCapabilities') }}</th>
            <th class="py-2.5 px-3.5 font-semibold">{{ t('catalogColProviders') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
          <tr
            v-for="entry in filteredEntries"
            :key="entry.baseId"
            :data-model-row="entry.baseId"
            class="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors"
            :class="isEntryActive(entry) ? 'bg-violet-50/40 dark:bg-violet-950/20' : ''"
          >
            <!-- Model -->
            <td class="py-3 px-3.5 align-top">
              <div class="flex items-center gap-1.5">
                <span class="font-semibold text-sm text-gray-900 dark:text-gray-100">{{ entry.name }}</span>
                <span
                  v-if="isEntryActive(entry)"
                  class="rounded-full bg-violet-100 dark:bg-violet-950/60 px-1.5 py-0.2 text-[10px] font-medium text-violet-700 dark:text-violet-300"
                >
                  {{ t('catalogCurrentModel') }}
                </span>
              </div>
              <div class="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                {{ entry.authorName }} · <span class="font-mono text-gray-400">{{ entry.baseId }}</span>
              </div>
            </td>

            <!-- Release Date -->
            <td class="py-3 px-3 align-top whitespace-nowrap text-gray-700 dark:text-gray-300 tabular-nums">
              {{ formatReleaseDate(entry.releaseDate) }}
            </td>

            <!-- Resolutions & Ratios -->
            <td class="py-3 px-3 align-top space-y-1">
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="tier in entry.sizeTiers"
                  :key="tier.size"
                  class="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[11px] text-gray-700 dark:text-gray-300 tabular-nums"
                >
                  {{ tier.size === 'auto' ? t('catalogAutoSize') : tier.size }}<template v-if="tier.resolution"> ({{ tier.resolution }})</template>
                </span>
              </div>
              <div class="text-[11px] text-gray-400 dark:text-gray-500">
                <span v-if="entry.aspectRatios.length > 0">{{ aspectRatioBadgeText(entry) }} · </span>
                <span>{{ t('catalogMaxReferences', { count: entry.maxReferenceImages }) }}</span>
              </div>
            </td>

            <!-- Unit Price -->
            <td class="py-3 px-3 align-top whitespace-nowrap tabular-nums space-y-0.5">
              <div
                v-for="tier in entry.sizeTiers"
                :key="tier.size"
                class="text-gray-800 dark:text-gray-200"
              >
                <span v-if="entry.supportsCustomSize" class="text-gray-400 mr-1">{{ tier.size }}:</span>
                <span class="font-semibold text-violet-600 dark:text-violet-400">
                  {{ formatCatalogUnitPrice(tier.unitCost, entry.isExactFlatPrice) }}
                </span>
              </div>
              <div v-if="entry.imagesPerDollar > 0" class="text-[11px] text-emerald-600 dark:text-emerald-400">
                {{ t('catalogImagesPerDollar', { count: entry.imagesPerDollar }) }}
              </div>
              <div v-if="tokenPricingText(entry)" class="text-[10px] text-gray-400 dark:text-gray-500">
                {{ tokenPricingText(entry) }}
              </div>
            </td>

            <!-- Capabilities -->
            <td class="py-3 px-3 align-top">
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="cap in entry.capabilities"
                  :key="cap"
                  class="rounded bg-violet-50 dark:bg-violet-950/40 px-1.5 py-0.5 text-[11px] text-violet-700 dark:text-violet-300"
                >
                  {{ t(capabilityLabelKeys[cap]) }}
                </span>
                <span v-if="entry.capabilities.length === 0" class="text-gray-400">—</span>
              </div>
            </td>

            <!-- Providers -->
            <td class="py-3 px-3.5 align-top">
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="variant in entry.variants"
                  :key="`${variant.provider}:${variant.id}`"
                  type="button"
                  :aria-label="t('catalogSelectProvider', { provider: providerLabel(variant.provider) })"
                  class="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap"
                  :class="isVariantActive(variant)
                    ? 'border-violet-600 bg-violet-600 text-white'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-300'"
                  @click="emit('select', variant)"
                >
                  <span
                    v-if="apiKeyStore.hasKeyFor(variant.provider)"
                    class="h-1.5 w-1.5 rounded-full"
                    :class="isVariantActive(variant) ? 'bg-emerald-300' : 'bg-emerald-500'"
                  />
                  {{ providerShortNames[variant.provider] }}
                  <span aria-hidden="true">{{ isVariantActive(variant) ? '✓' : '→' }}</span>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
