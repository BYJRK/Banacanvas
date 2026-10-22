import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref, type App } from 'vue'
import GroupedModelSelector from '../../src/components/GroupedModelSelector.vue'
import { getModelsForProvider, QWEN_IMAGE_2_1_TURBO_MODEL } from '../../src/config/models'
import type { ModelOption, Provider } from '../../src/types'
import { en } from '../helpers'

let app: App | undefined
let host: HTMLDivElement
const models = getModelsForProvider('openrouter')

function mount(provider: Provider = 'openrouter') {
  const providerModels = getModelsForProvider(provider)
  const selected = ref(providerModels[0])
  host = document.createElement('div')
  document.body.append(host)
  app = createApp({
    setup: () => () => h(GroupedModelSelector, {
      models: providerModels,
      modelValue: selected.value,
      'onUpdate:modelValue': (model: ModelOption) => { selected.value = model },
    }),
  })
  app.mount(host)
  return selected
}

const trigger = () => host.querySelector<HTMLButtonElement>('button')!
const choices = () => [...host.querySelectorAll<HTMLButtonElement>('[role="group"] button')]
const choice = (text: string) => choices().find((button) => button.textContent?.includes(text))!
async function click(button: HTMLButtonElement) {
  button.click()
  await nextTick()
  await nextTick()
}

afterEach(() => {
  app?.unmount()
  host?.remove()
})

describe('grouped model selector', () => {
  it('groups Vercel models and preserves provider-specific descriptions and selection', async () => {
    const selected = mount('vercel')
    await click(trigger())
    expect(choices().map((button) => button.textContent)).toEqual([
      expect.stringContaining('Microsoft'), expect.stringContaining('OpenAI'), expect.stringContaining('Google'),
    ])
    await click(choice('Google'))
    expect(host.textContent).toContain(en.modelVercelNanoBanana2Desc)
    expect(host.textContent).not.toContain(en.modelORNanoBanana2Desc)
    await click(choice('Nano Banana 2 Lite'))
    expect(selected.value).toMatchObject({ provider: 'vercel', id: 'google/gemini-3.1-flash-lite-image' })
    expect(host.querySelector('[role="group"]')).toBeNull()
    expect(document.activeElement).toBe(trigger())
  })

  it('selects an author then a model and restores trigger focus', async () => {
    const selected = mount()
    await click(trigger())
    expect(choices()).toHaveLength(8)
    expect(choice('Google').getAttribute('aria-current')).toBe('true')
    await click(choice('Qwen'))
    expect(choices()).toHaveLength(2)
    expect(host.textContent).toContain(en.modelQwenImage21TurboDesc)
    await click(choice('Qwen Image 2.1 Turbo'))
    expect(selected.value.id).toBe(QWEN_IMAGE_2_1_TURBO_MODEL)
    expect(host.querySelector('[role="group"]')).toBeNull()
    expect(document.activeElement).toBe(trigger())
    await click(trigger())
    expect(choices()).toHaveLength(8)
    expect(choice('Qwen').getAttribute('aria-current')).toBe('true')
  })

  it('returns to authors without changing selection and supports arrow navigation', async () => {
    const selected = mount()
    await click(trigger())
    await click(choice('Qwen'))
    choices()[0].focus()
    choices()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(document.activeElement).toBe(choices()[1])
    choices()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    await nextTick()
    await nextTick()
    expect(choices()).toHaveLength(8)
    expect(document.activeElement).toBe(choice('Google'))
    await click(choice('Qwen'))
    await click(host.querySelector<HTMLButtonElement>(`[aria-label="${en.backToModelAuthors}"]`)!)
    expect(choices()).toHaveLength(8)
    expect(selected.value.id).toBe(models[0].id)
  })

  it('dismisses with Escape without changing the model', async () => {
    const selected = mount()
    await click(trigger())
    await click(choice('Qwen'))
    choices()[0].focus()
    choices()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(host.querySelector('[role="group"]')).toBeNull()
    expect(selected.value.id).toBe(models[0].id)
    expect(document.activeElement).toBe(trigger())
  })
})
