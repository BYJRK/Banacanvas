import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref, type App } from 'vue'
import ParameterPanel from '../../src/components/ParameterPanel.vue'
import {
  MINIMAX_H3_IMAGE_MODEL,
  GPT_IMAGE_2_5_FLARE_MODEL,
  GPT_IMAGE_2_5_SUNBURST_MODEL,
  GPT_IMAGE_2_6_FLARE_MODEL,
  GPT_IMAGE_2_6_SUNBURST_MODEL,
} from '../../src/config/models'
import type { GenerationConfig, Provider } from '../../src/types'
import { en } from '../helpers'

let app: App | undefined
let host: HTMLDivElement

function mount(model: string, provider: Provider = 'openrouter', overrides: Partial<GenerationConfig> = {}) {
  const config = ref<GenerationConfig>({
    model, provider, aspectRatio: 'auto', imageQuality: 'auto', imageSize: '1K', batchSize: 2, ...overrides,
  })
  host = document.createElement('div')
  document.body.append(host)
  app = createApp({
    setup: () => () => h(ParameterPanel, {
      modelId: model, provider, modelValue: config.value,
      'onUpdate:modelValue': (value: GenerationConfig) => { config.value = value },
      downloadFormat: 'png', resizeAsPng: false, notifyOnEnd: false, suggestAspectRatio: true,
    }),
  })
  app.mount(host)
  return config
}

function text(selector: string) {
  return host.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim()
}

afterEach(() => {
  app?.unmount()
  host?.remove()
})

describe.each([
  [GPT_IMAGE_2_5_FLARE_MODEL, '0.018'],
  [GPT_IMAGE_2_5_SUNBURST_MODEL, '0.018'],
  [GPT_IMAGE_2_6_FLARE_MODEL, '0.074'],
  [GPT_IMAGE_2_6_SUNBURST_MODEL, '0.074'],
])('%s batch estimate', (model, lowBatchCost) => {
  it('shows a reference total for auto settings and follows quantity and quality changes', async () => {
    mount(model)

    const slider = host.querySelector<HTMLInputElement>('input[type="range"]')!
    expect(slider.parentElement?.nextElementSibling).toBe(host.querySelector('[data-cost-estimate]'))
    expect(text('[data-cost-estimate]')).toBe(`${en.estCostTotal}: ~$0.105`)
    expect(host.textContent).not.toContain('USD / 1M tokens')

    slider.value = '3'
    slider.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    expect(text('[data-cost-estimate]')).toBe(`${en.estCostTotal}: ~$0.158`)

    Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.trim() === en.qualityLow)!.click()
    await nextTick()
    expect(text('[data-cost-estimate]')).toBe(`${en.estCostTotal}: ~$${lowBatchCost}`)
  })
})

describe.each([GPT_IMAGE_2_5_FLARE_MODEL, GPT_IMAGE_2_5_SUNBURST_MODEL, GPT_IMAGE_2_6_FLARE_MODEL, GPT_IMAGE_2_6_SUNBURST_MODEL])('%s Vercel estimate', (model) => {
  it('uses selected dimensions, then a 1K reference when aspect ratio is auto', async () => {
    const config = mount(model, 'vercel', { aspectRatio: '1:1', imageSize: '2K', imageQuality: 'high' })
    expect(text('[data-cost-estimate]')).toBe(`${en.estCostTotal}: ~$0.214`)

    config.value = { ...config.value, aspectRatio: 'auto' }
    await nextTick()
    expect(text('[data-cost-estimate]')).toBe(`${en.estCostTotal}: ~$0.105`)
  })
})


describe.each(['openrouter', 'vercel'] as const)('MiniMax %s estimate', (provider) => {
  it('updates reference totals with resolution and explains the estimate', async () => {
    mount(MINIMAX_H3_IMAGE_MODEL, provider, { aspectRatio: '1:1' })
    expect(text('[data-cost-estimate]')).toBe(`${en.estCostTotal}: ~$0.0436`)
    Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.trim() === '4K')!.click()
    await nextTick()
    expect(text('[data-cost-estimate]')).toBe(`${en.estCostTotal}: ~$0.14`)
    host.querySelector<HTMLButtonElement>(`button[aria-label="${en.costEstimateInfo}"]`)!.click()
    await nextTick()
    expect(host.textContent).toContain(en.minimaxReferenceCostHint)
    expect(host.textContent).not.toContain(en.gptImageOutputCostHint)
  })
})
