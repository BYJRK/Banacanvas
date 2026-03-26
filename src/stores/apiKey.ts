import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Provider } from '../types'

const GEMINI_STORAGE_KEY = 'banacanvas-api-key'
const OPENROUTER_STORAGE_KEY = 'banacanvas-openrouter-key'

export const useApiKeyStore = defineStore('apiKey', () => {
  const geminiKey = ref(localStorage.getItem(GEMINI_STORAGE_KEY) ?? '')
  const openRouterKey = ref(localStorage.getItem(OPENROUTER_STORAGE_KEY) ?? '')

  const hasGeminiKey = computed(() => geminiKey.value.length > 0)
  const hasOpenRouterKey = computed(() => openRouterKey.value.length > 0)

  function hasKeyFor(provider: Provider): boolean {
    if (provider === 'openrouter') return hasOpenRouterKey.value
    return hasGeminiKey.value
  }

  function getKey(provider: Provider): string {
    if (provider === 'openrouter') return openRouterKey.value
    return geminiKey.value
  }

  function setKey(provider: Provider, key: string) {
    const trimmed = key.trim()
    if (provider === 'openrouter') {
      openRouterKey.value = trimmed
      if (trimmed) {
        localStorage.setItem(OPENROUTER_STORAGE_KEY, trimmed)
      } else {
        localStorage.removeItem(OPENROUTER_STORAGE_KEY)
      }
    } else {
      geminiKey.value = trimmed
      if (trimmed) {
        localStorage.setItem(GEMINI_STORAGE_KEY, trimmed)
      } else {
        localStorage.removeItem(GEMINI_STORAGE_KEY)
      }
    }
  }

  function clearKey(provider: Provider) {
    setKey(provider, '')
  }

  return { geminiKey, openRouterKey, hasGeminiKey, hasOpenRouterKey, hasKeyFor, getKey, setKey, clearKey }
})
