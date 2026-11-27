import { describe, expect, it } from 'vitest'
import {
  AVAILABLE_MODELS,
  GEMINI_FLASH_IMAGE_MODEL,
  GEMINI_PRO_IMAGE_MODEL,
  GPT_IMAGE_2_6_FLARE_MODEL,
  MAI_IMAGE_2_7_MODEL,
  MUSE_IMAGE_MODEL,
  RECRAFT_V4_1_FLASH_V2_MODEL,
  SEEDREAM_5_0_PRO_MODEL,
  getBaseModelId,
} from '../../src/config/models'
import {
  buildModelCatalog,
  filterAndSortCatalog,
  formatCatalogUnitPrice,
  getCatalogOverviewStats,
} from '../../src/config/modelCatalog'

describe('buildModelCatalog', () => {
  it('merges multi-provider entries by canonical base model ID', () => {
    const all = buildModelCatalog('all')
    const uniqueBaseIds = new Set(AVAILABLE_MODELS.map((m) => getBaseModelId(m.id)))
    expect(all.length).toBe(uniqueBaseIds.size)

    const flash = all.find((e) => e.baseId === GEMINI_FLASH_IMAGE_MODEL)!
    expect(flash.providers).toEqual(['gemini', 'openrouter', 'vercel'])
    expect(flash.authorName).toBe('Google')
    expect(flash.sizeTiers.map((t) => t.size)).toEqual(['512', '1K', '2K', '4K'])
    expect(flash.sizeTiers.find((t) => t.size === '512')?.providerOnly).toEqual(['gemini', 'vercel'])
    expect(flash.sizeTiers.find((t) => t.size === '1K')?.providerOnly).toBeUndefined()
  })

  it('adapts size tiers and capabilities to the selected provider filter', () => {
    const orFlash = buildModelCatalog('openrouter').find((e) => e.baseId === GEMINI_FLASH_IMAGE_MODEL)!
    expect(orFlash.sizeTiers.map((t) => t.size)).toEqual(['1K', '2K', '4K'])
    expect(orFlash.capabilities).not.toContain('thinking')
    expect(orFlash.capabilities).not.toContain('googleSearch')

    const vercelMai27 = buildModelCatalog('vercel').find((e) => e.baseId === MAI_IMAGE_2_7_MODEL)!
    expect(vercelMai27.supportsCustomSize).toBe(true)
    expect(vercelMai27.sizeTiers.map((t) => t.size)).toEqual(['1K', '1.5K', '2K'])
    expect(vercelMai27.capabilities).toContain('transparentBg')

    const orMai27 = buildModelCatalog('openrouter').find((e) => e.baseId === MAI_IMAGE_2_7_MODEL)!
    expect(orMai27.supportsCustomSize).toBe(false)
    expect(orMai27.sizeTiers).toHaveLength(1)
    expect(orMai27.sizeTiers[0]).toMatchObject({ size: 'auto', resolution: '1024×1024' })
    expect(orMai27.capabilities).not.toContain('transparentBg')
  })

  it('computes quality cost ranges, flat pricing flags, and automatic-size models', () => {
    const all = buildModelCatalog('all')

    const muse = all.find((e) => e.baseId === MUSE_IMAGE_MODEL)!
    expect(muse.supportsCustomSize).toBe(false)
    expect(muse.aspectRatios).toEqual([])
    expect(muse.referenceCost).toBeCloseTo(0.01, 9)
    expect(muse.isExactFlatPrice).toBe(true)
    expect(muse.imagesPerDollar).toBe(100)

    const seedreamPro = all.find((e) => e.baseId === SEEDREAM_5_0_PRO_MODEL)!
    expect(seedreamPro.sizeTiers.map((t) => [t.size, t.unitCost])).toEqual([
      ['1K', 0.045],
      ['2K', 0.09],
    ])

    const gpt26 = all.find((e) => e.baseId === GPT_IMAGE_2_6_FLARE_MODEL)!
    const tier1k = gpt26.sizeTiers.find((t) => t.size === '1K')!
    expect(tier1k.minQualityCost).toBeLessThan(tier1k.unitCost)
    expect(tier1k.maxQualityCost).toBeGreaterThan(tier1k.unitCost)
    expect(gpt26.isExactFlatPrice).toBe(false)

    const recraftAll = all.find((e) => e.baseId === RECRAFT_V4_1_FLASH_V2_MODEL)!
    expect(recraftAll.aspectRatios.length).toBe(12)
    expect(recraftAll.providerDiffNote).toBe('catalogDiffOpenRouterAspectRatio')

    const recraftVercel = buildModelCatalog('vercel').find((e) => e.baseId === RECRAFT_V4_1_FLASH_V2_MODEL)!
    expect(recraftVercel.aspectRatios).toEqual([])
    expect(recraftVercel.providerDiffNote).toBeUndefined()

    const recraftOpenRouter = buildModelCatalog('openrouter').find((e) => e.baseId === RECRAFT_V4_1_FLASH_V2_MODEL)!
    expect(recraftOpenRouter.aspectRatios.length).toBe(12)
  })
})

describe('filterAndSortCatalog and stats', () => {
  const catalog = buildModelCatalog('all')

  it('sorts by release date and reference price', () => {
    const oldestFirst = filterAndSortCatalog(catalog, { sortBy: 'releaseAsc' })
    expect(oldestFirst[0].baseId).toBe(GEMINI_PRO_IMAGE_MODEL)

    const cheapestFirst = filterAndSortCatalog(catalog, { sortBy: 'priceAsc' })
    expect(cheapestFirst[0].baseId).toBe(RECRAFT_V4_1_FLASH_V2_MODEL)
    expect(cheapestFirst.at(-1)!.baseId).toBe(GEMINI_PRO_IMAGE_MODEL)
  })

  it('filters by author and free-text query', () => {
    const microsoftOnly = filterAndSortCatalog(catalog, { authorId: 'microsoft' })
    expect(microsoftOnly.length).toBe(4)
    expect(microsoftOnly.every((e) => e.authorId === 'microsoft')).toBe(true)

    const byQuery = filterAndSortCatalog(catalog, { query: 'riverflow' })
    expect(byQuery.map((e) => e.authorId)).toEqual(['sourceful', 'sourceful'])
  })

  it('computes overview stats and formats exact vs estimated prices', () => {
    const stats = getCatalogOverviewStats(catalog)!
    expect(stats.totalModels).toBe(catalog.length)
    expect(stats.cheapestModelName).toBe('Recraft V4.1 Flash V2')
    expect(stats.minReferenceCost).toBeCloseTo(0.007, 9)
    expect(stats.newestReleaseDate).toBe('2026-11-17')
    expect(getCatalogOverviewStats([])).toBeNull()

    expect(formatCatalogUnitPrice(0.01, true)).toBe('$0.01')
    expect(formatCatalogUnitPrice(0.0184, true)).toBe('$0.0184')
    expect(formatCatalogUnitPrice(0.034816, false)).toBe('~$0.035')
  })
})
