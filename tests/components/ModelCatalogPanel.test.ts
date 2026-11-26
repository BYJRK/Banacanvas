import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, type App } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import ModelCatalogPanel from '../../src/components/ModelCatalogPanel.vue'
import {
  DEFAULT_MODEL,
  GEMINI_PRO_IMAGE_MODEL,
  MAI_IMAGE_2_7_MODEL,
  MUSE_IMAGE_MODEL,
} from '../../src/config/models'
import { buildModelCatalog } from '../../src/config/modelCatalog'
import type { ModelOption } from '../../src/types'
import { en } from '../helpers'

let app: App | undefined
let host: HTMLDivElement
const onBack = vi.fn()
const onSelect = vi.fn<(model: ModelOption) => void>()

function mount(currentModel: ModelOption = DEFAULT_MODEL) {
  const pinia = createPinia()
  setActivePinia(pinia)
  host = document.createElement('div')
  document.body.append(host)
  app = createApp({
    setup: () => () => h(ModelCatalogPanel, {
      currentModel,
      onBack,
      onSelect,
    }),
  })
  app.use(pinia)
  app.mount(host)
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('banacanvas-locale', 'en')
  onBack.mockClear()
  onSelect.mockClear()
})

afterEach(() => {
  app?.unmount()
  host?.remove()
})

describe('ModelCatalogPanel', () => {
  it('renders all unique models with release dates, pricing overview, and active indicator', () => {
    mount()
    const total = buildModelCatalog('all').length
    const cards = host.querySelectorAll('[data-model-card]')
    expect(cards.length).toBe(total)
    expect(host.textContent).toContain(en.modelCatalogTitle)
    expect(host.textContent).toContain('Muse Image')
    expect(host.textContent).toContain('$0.01')
    expect(host.querySelector(`[data-model-card="${DEFAULT_MODEL.id}"]`)?.textContent).toContain(en.catalogCurrentModel)
  })

  it('filters by provider, author, and search query and resets empty results', async () => {
    mount()

    host.querySelector<HTMLButtonElement>('[data-provider-filter="gemini"]')!.click()
    await nextTick()
    expect(host.querySelectorAll('[data-model-card]').length).toBe(4)

    host.querySelector<HTMLButtonElement>('[data-provider-filter="all"]')!.click()
    await nextTick()
    host.querySelector<HTMLButtonElement>('[data-author-filter="microsoft"]')!.click()
    await nextTick()
    expect(host.querySelectorAll('[data-model-card]').length).toBe(4)

    const search = host.querySelector<HTMLInputElement>('input[type="search"]')!
    search.value = 'nonexistent-model-xyz'
    search.dispatchEvent(new Event('input'))
    await nextTick()
    expect(host.querySelectorAll('[data-model-card]').length).toBe(0)
    expect(host.textContent).toContain(en.catalogNoResults)

    const resetBtn = [...host.querySelectorAll<HTMLButtonElement>('button')]
      .find((btn) => btn.textContent?.trim() === en.catalogResetFilters)!
    resetBtn.click()
    await nextTick()
    expect(host.querySelectorAll('[data-model-card]').length).toBe(buildModelCatalog('all').length)
  })

  it('sorts models and toggles between card and table views', async () => {
    mount()

    const sortSelect = host.querySelector<HTMLSelectElement>('#catalog-sort')!
    sortSelect.value = 'priceAsc'
    sortSelect.dispatchEvent(new Event('change'))
    await nextTick()

    const cardsByPrice = [...host.querySelectorAll<HTMLElement>('[data-model-card]')]
    expect(cardsByPrice[0].dataset.modelCard).toBe(MUSE_IMAGE_MODEL)
    expect(cardsByPrice.at(-1)!.dataset.modelCard).toBe(GEMINI_PRO_IMAGE_MODEL)

    const tableToggle = [...host.querySelectorAll<HTMLButtonElement>('button')]
      .find((btn) => btn.getAttribute('aria-label') === en.catalogViewTable)!
    tableToggle.click()
    await nextTick()

    expect(host.querySelectorAll('[data-model-card]').length).toBe(0)
    expect(host.querySelectorAll('[data-model-row]').length).toBe(buildModelCatalog('all').length)
  })

  it('emits select with the chosen provider variant and back when returning to workspace', () => {
    mount()

    const maiCard = host.querySelector<HTMLElement>(`[data-model-card="${MAI_IMAGE_2_7_MODEL}"]`)!
    const useVercelBtn = [...maiCard.querySelectorAll<HTMLButtonElement>('button')]
      .find((btn) => btn.getAttribute('aria-label') === en.catalogSelectProvider.replace('{provider}', en.providerVercel))!
    useVercelBtn.click()

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0][0]).toMatchObject({
      id: MAI_IMAGE_2_7_MODEL,
      provider: 'vercel',
    })

    const backBtn = [...host.querySelectorAll<HTMLButtonElement>('button')]
      .find((btn) => btn.textContent?.trim() === en.backToWorkspace)!
    backBtn.click()
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
