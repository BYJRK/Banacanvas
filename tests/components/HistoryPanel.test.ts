import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, shallowRef, type App } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import HistoryPanel from '../../src/components/HistoryPanel.vue'
import { useHistoryStore } from '../../src/stores/history'
import type { HistoryEntry } from '../../src/types'
import { deferred, en } from '../helpers'

let app: App | undefined
let host: HTMLDivElement
const toast = vi.fn()

const entry: HistoryEntry = {
  id: 'saved',
  timestamp: 1,
  prompt: 'saved image',
  config: { provider: 'gemini', model: 'gemini-3.1-flash-image', aspectRatio: '1:1' },
  imageBase64: btoa('saved image'),
  imageMimeType: 'image/png',
}

function mount() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useHistoryStore()
  store.entries = [{ ...entry }]
  store.ready = true
  const active = shallowRef(true)
  host = document.createElement('div')
  document.body.append(host)
  app = createApp({ setup: () => () => h(HistoryPanel, { active: active.value, onToast: toast }) })
  app.use(pinia)
  app.mount(host)
  return { store, active }
}

function button(label: string, root: ParentNode = host) {
  return [...root.querySelectorAll<HTMLButtonElement>('button')]
    .find((node) => node.getAttribute('aria-label') === label || node.textContent?.trim() === label)!
}

const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]')

async function openClearDialog() {
  button(en.clearAll).focus()
  button(en.clearAll).click()
  await vi.waitFor(() => expect(dialog()).not.toBeNull())
  await vi.waitFor(() => expect(document.activeElement).toBe(button(en.cancel, dialog()!)))
}

beforeEach(() => toast.mockClear())
afterEach(() => {
  app?.unmount()
  host?.remove()
})

describe('history initialization feedback', () => {
  it('shows loading and error states instead of an empty history, then allows retry', async () => {
    const { store } = mount()
    store.entries = []
    store.ready = false
    store.initializing = true
    await nextTick()
    expect(host.querySelector('[role="status"]')?.textContent).toBe(en.historyLoading)
    expect(host.textContent).not.toContain(en.noHistory)
    expect(button(en.importHistory).disabled).toBe(true)

    store.initializing = false
    store.initError = 'Read failed'
    await nextTick()
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(en.historyLoadFailed.replace('{error}', 'Read failed'))
    expect(host.textContent).not.toContain(en.noHistory)

    const pending = deferred<IDBDatabase>()
    const init = vi.spyOn(store, 'init').mockImplementation(() => {
      store.initializing = true
      store.initError = null
      return pending.promise
    })
    button(en.historyRetry).click()
    await nextTick()
    expect(init).toHaveBeenCalledTimes(1)
    expect(host.querySelector('[role="status"]')?.textContent).toBe(en.historyLoading)
    store.initializing = false
    store.ready = true
    pending.resolve({} as IDBDatabase)
    await nextTick()
    expect(host.textContent).toContain(en.noHistory)
    expect(button(en.importHistory).disabled).toBe(false)
  })

  it('keeps initialization actions disabled until history is ready', async () => {
    const { store } = mount()
    store.ready = false
    store.initializing = true
    await nextTick()
    for (const label of [en.importHistory, en.exportHistory, en.clearAll]) {
      expect(button(label).disabled).toBe(true)
    }
  })
})

describe('clear history confirmation', () => {
  it('requires confirmation and focuses cancel; cancel or Escape keeps saved entries', async () => {
    const { store } = mount()
    const clear = vi.spyOn(store, 'clearAll').mockResolvedValue()
    await openClearDialog()
    expect(clear).not.toHaveBeenCalled()
    expect(dialog()?.textContent).toContain(en.clearHistoryTitle)
    expect(dialog()?.textContent).toContain(en.clearHistoryDescription.replace('{count}', '1'))
    button(en.cancel, dialog()!).click()
    await vi.waitFor(() => expect(dialog()).toBeNull())
    expect(store.entries).toHaveLength(1)

    await openClearDialog()
    let escaped = false
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') escaped = true }
    document.addEventListener('keydown', onEscape)
    try {
      button(en.cancel, dialog()!).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
      await vi.waitFor(() => expect(dialog()).toBeNull())
      expect(escaped).toBe(false)
      expect(clear).not.toHaveBeenCalled()
      expect(store.entries).toHaveLength(1)
    } finally {
      document.removeEventListener('keydown', onEscape)
    }
  })

  it('waits for clearing to commit and prevents duplicate confirmation or dismissal while busy', async () => {
    const { store } = mount()
    const pending = deferred<void>()
    const clear = vi.spyOn(store, 'clearAll').mockImplementation(async () => {
      await pending.promise
      store.entries = []
    })
    await openClearDialog()
    const confirm = button(en.clearHistoryConfirm, dialog()!)
    confirm.click()
    await nextTick()
    expect(clear).toHaveBeenCalledTimes(1)
    expect(dialog()?.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(confirm.disabled).toBe(true)
    expect(confirm.textContent?.trim()).toBe(en.historyClearing)
    expect(button(en.cancel, dialog()!).disabled).toBe(true)
    confirm.click()
    dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await nextTick()
    expect(dialog()).not.toBeNull()
    expect(store.entries).toHaveLength(1)
    expect(clear).toHaveBeenCalledTimes(1)
    pending.resolve()
    await vi.waitFor(() => expect(dialog()).toBeNull())
    expect(store.entries).toEqual([])
    expect(host.textContent).toContain(en.noHistory)
  })

  it('keeps the confirmation open and entries intact on failure so clearing can be retried', async () => {
    const { store } = mount()
    const clear = vi.spyOn(store, 'clearAll').mockRejectedValueOnce(new Error('Delete failed')).mockResolvedValueOnce()
    await openClearDialog()
    button(en.clearHistoryConfirm, dialog()!).click()
    await vi.waitFor(() => expect(toast).toHaveBeenCalledWith('Delete failed', 'error'))
    expect(dialog()).not.toBeNull()
    expect(store.entries).toHaveLength(1)
    expect(button(en.clearHistoryConfirm, dialog()!).disabled).toBe(false)
    button(en.clearHistoryConfirm, dialog()!).click()
    await vi.waitFor(() => expect(dialog()).toBeNull())
    expect(clear).toHaveBeenCalledTimes(2)
  })

  it('dismisses an idle confirmation when its history panel becomes inactive', async () => {
    const { store, active } = mount()
    const clear = vi.spyOn(store, 'clearAll').mockResolvedValue()
    await openClearDialog()
    active.value = false
    await vi.waitFor(() => expect(dialog()).toBeNull())
    expect(clear).not.toHaveBeenCalled()
  })
})
