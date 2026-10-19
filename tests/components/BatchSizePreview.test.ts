import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref, type App } from 'vue'
import BatchSizePreview from '../../src/components/BatchSizePreview.vue'
import { en } from '../helpers'

let app: App | undefined
let host: HTMLDivElement

function mount(initial: number) {
  const count = ref(initial)
  host = document.createElement('div')
  document.body.append(host)
  app = createApp({
    setup: () => () => h(BatchSizePreview, {
      modelValue: count.value,
      'onUpdate:modelValue': (value: number) => { count.value = value },
    }),
  })
  app.mount(host)
  return count
}

function trigger() {
  return host.querySelector<HTMLButtonElement>('button')!
}

function cell(n: number) {
  return host.querySelector<HTMLButtonElement>(`[data-count="${n}"]`)!
}

function placeholders() {
  return Array.from(host.querySelectorAll('span.block.text-sm')).filter((el) => el.textContent === en.emptyState)
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
