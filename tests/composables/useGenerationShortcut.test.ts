import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, ref, type App } from 'vue'
import { useGenerationShortcut } from '../../src/composables/useGenerationShortcut'

let app: App | undefined
let host: HTMLDivElement

function mount() {
  const enabled = ref(true)
  const generate = vi.fn()
  host = document.createElement('div')
  document.body.append(host)
  app = createApp({
    setup() {
      useGenerationShortcut(() => enabled.value, generate)
      return () => h('div')
    },
  })
  app.mount(host)
  return { enabled, generate }
}

function press(target: EventTarget, options: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', {
    key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true, ...options,
  })
  target.dispatchEvent(event)
  return event
}

afterEach(() => {
  app?.unmount()
  host?.remove()
})

describe('global generation shortcut', () => {
  it('generates once from the body, buttons and editors outside the app root', () => {
    const { generate } = mount()
    press(document.body)
    expect(generate).toHaveBeenCalledTimes(1)

    for (const tag of ['button', 'input', 'textarea', 'div']) {
      const target = document.createElement(tag)
      target.tabIndex = 0
      if (tag === 'div') target.contentEditable = 'true'
      const localHandler = vi.fn()
      target.addEventListener('keydown', localHandler)
      document.body.append(target)
      try {
        target.focus()
        generate.mockClear()
        expect(press(target).defaultPrevented).toBe(true)
        expect(generate).toHaveBeenCalledTimes(1)
        expect(localHandler).not.toHaveBeenCalled()
      } finally {
        target.remove()
      }
    }
  })

  it('uses current generation availability for each key press', () => {
    const { enabled, generate } = mount()
    enabled.value = false
    press(document.body)
    expect(generate).not.toHaveBeenCalled()
    enabled.value = true
    press(document.body)
    expect(generate).toHaveBeenCalledTimes(1)
  })

  it('ignores plain Enter, other shortcuts, key repeats and IME composition', () => {
    const { generate } = mount()
    expect(press(document.body, { ctrlKey: false }).defaultPrevented).toBe(false)
    expect(press(document.body, { key: 'Escape' }).defaultPrevented).toBe(false)
    expect(press(document.body, { isComposing: true }).defaultPrevented).toBe(false)
    press(document.body, { repeat: true })
    expect(generate).not.toHaveBeenCalled()
  })

  it('removes the global listener when the app unmounts', () => {
    const { generate } = mount()
    app!.unmount()
    app = undefined
    expect(press(document.body).defaultPrevented).toBe(false)
    expect(generate).not.toHaveBeenCalled()
  })
})
