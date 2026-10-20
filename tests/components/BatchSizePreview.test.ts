import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref, type App } from 'vue'
import BatchSizePreview from '../../src/components/BatchSizePreview.vue'
import { GEMINI_FLASH_IMAGE_MODEL, getResolution } from '../../src/config/models'
import { estimateConfigCost, formatCost } from '../../src/generationSpec'
import type { GenerationConfig } from '../../src/types'
import { en } from '../helpers'

let app: App | undefined
let host: HTMLDivElement

function mount(initial: number, specConfig?: Pick<GenerationConfig, 'aspectRatio' | 'imageSize'>) {
  const count = ref(initial)
  const config = ref(specConfig)
  host = document.createElement('div')
  document.body.append(host)
  app = createApp({
    setup: () => () => h(BatchSizePreview, {
      modelValue: count.value,
      'onUpdate:modelValue': (value: number) => { count.value = value },
      ...(config.value ? { modelId: GEMINI_FLASH_IMAGE_MODEL, provider: 'gemini' as const, config: config.value } : {}),
    }),
  })
  app.mount(host)
  return Object.assign(count, { config })
}

function trigger() {
  return host.querySelector<HTMLButtonElement>('button')!
}

function cell(n: number) {
  return host.querySelector<HTMLButtonElement>(`[data-count="${n}"]`)!
}

function placeholders() {
  return host.querySelectorAll('[data-placeholder]')
}

afterEach(() => {
  app?.unmount()
  host?.remove()
})

describe('batch preview quantity picker', () => {
  it('opens nine choices, previews a count and commits it back to the shared model', async () => {
    const count = mount(3)
    expect(placeholders()).toHaveLength(3)
    trigger().click()
    await nextTick()
    expect(host.querySelectorAll('[data-count]')).toHaveLength(9)
    expect(document.activeElement).toBe(cell(3))
    cell(5).dispatchEvent(new MouseEvent('mouseenter'))
    await nextTick()
    expect(host.querySelectorAll('[data-count].bg-violet-50')).toHaveLength(5)
    expect(count.value).toBe(3)
    cell(5).click()
    await nextTick()
    expect(count.value).toBe(5)
    expect(placeholders()).toHaveLength(5)
    expect(host.querySelector('[data-count]')).toBeNull()
    expect(document.activeElement).toBe(trigger())
  })

  it('cancels with Escape or the close button without committing the preview', async () => {
    const count = mount(3)
    trigger().click()
    await nextTick()
    cell(9).focus()
    cell(9).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(count.value).toBe(3)
    expect(placeholders()).toHaveLength(3)
    expect(document.activeElement).toBe(trigger())
    trigger().click()
    await nextTick()
    host.querySelector<HTMLButtonElement>(`button[aria-label="${en.cancel}"]`)!.click()
    await nextTick()
    expect(count.value).toBe(3)
    expect(placeholders()).toHaveLength(3)
  })

  it('lets Escape propagate when the picker is closed', async () => {
    mount(3)
    let reached = false
    const listener = (event: KeyboardEvent) => { reached = event.key === 'Escape' && !event.defaultPrevented }
    document.addEventListener('keydown', listener)
    try {
      trigger().focus()
      trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
      expect(reached).toBe(true)

      reached = false
      trigger().click()
      await nextTick()
      cell(4).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
      expect(reached).toBe(false)
    } finally {
      document.removeEventListener('keydown', listener)
    }
  })

  it('keeps previewing the focused cell when the mouse leaves the grid', async () => {
    mount(2)
    trigger().click()
    await nextTick()
    cell(6).focus()
    cell(8).dispatchEvent(new MouseEvent('mouseenter'))
    await nextTick()
    expect(host.querySelectorAll('[data-count].bg-violet-50')).toHaveLength(8)
    host.querySelector('[role="group"]')!.dispatchEvent(new MouseEvent('mouseleave'))
    await nextTick()
    expect(host.querySelectorAll('[data-count].bg-violet-50')).toHaveLength(6)
    cell(6).blur()
    await nextTick()
    expect(host.querySelectorAll('[data-count].bg-violet-50')).toHaveLength(2)
  })

  it('reflects external changes and supports selecting both limits', async () => {
    const count = mount(1)
    expect(placeholders()).toHaveLength(1)
    count.value = 9
    await nextTick()
    expect(placeholders()).toHaveLength(9)
    for (const n of [1, 9]) {
      trigger().click()
      await nextTick()
      cell(n).click()
      await nextTick()
      expect(count.value).toBe(n)
      expect(placeholders()).toHaveLength(n)
    }
  })
})

describe('preview spec line', () => {
  const cost = (n: number) => formatCost(estimateConfigCost(GEMINI_FLASH_IMAGE_MODEL, 'gemini', { aspectRatio: '16:9', imageSize: '2K' }, n)!, GEMINI_FLASH_IMAGE_MODEL)
  const text = (sel: string) => host.querySelector(sel)?.textContent?.replace(/\s+/g, ' ').trim()

  it('is hidden without model information', () => {
    mount(2)
    expect(host.querySelector('[data-spec]')).toBeNull()
  })

  it('shows ratio glyph, size, resolution and cost, following the previewed count', async () => {
    const count = mount(2, { aspectRatio: '16:9', imageSize: '2K' })
    expect(text('[data-spec-ratio]')).toBe('16:9')
    const glyph = host.querySelector<HTMLElement>('[data-ratio-glyph]')!
    expect([glyph.style.width, glyph.style.height]).toEqual(['14px', '8px'])
    expect(text('[data-spec-size]')).toBe('2K')
    expect(text('[data-spec-resolution]')).toBe(getResolution('16:9', '2K', GEMINI_FLASH_IMAGE_MODEL, 'gemini'))
    expect(text('[data-spec-cost]')).toBe(`${en.estCostTotal} ~$${cost(2)} (2 × ~$${cost(1)})`)

    trigger().click()
    await nextTick()
    cell(7).dispatchEvent(new MouseEvent('mouseenter'))
    await nextTick()
    expect(text('[data-spec-cost]')).toContain(`~$${cost(7)} (7 × `)
    expect(count.value).toBe(2)
  })

  it('updates when the config or count changes externally', async () => {
    const count = mount(2, { aspectRatio: '16:9', imageSize: '2K' })
    count.config.value = { aspectRatio: '1:1', imageSize: '1K' }
    count.value = 1
    await nextTick()
    expect(text('[data-spec-ratio]')).toBe('1:1')
    expect(text('[data-spec-size]')).toBe('1K')
    expect(text('[data-spec-cost]')).not.toContain('×')
  })
})
