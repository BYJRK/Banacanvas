import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Provider } from '../types'

const GEMINI_STORAGE_KEY = 'banacanvas-api-key'
const OPENROUTER_STORAGE_KEY = 'banacanvas-openrouter-key'
const VERCEL_STORAGE_KEY = 'banacanvas-vercel-key'

export const useApiKeyStore = defineStore('apiKey', () => {
  const geminiKey = ref(localStorage.getItem(GEMINI_STORAGE_KEY) ?? '')
  const openRouterKey = ref(localStorage.getItem(OPENROUTER_STORAGE_KEY) ?? '')
  const vercelKey = ref(localStorage.getItem(VERCEL_STORAGE_KEY) ?? '')

  const hasGeminiKey = computed(() => geminiKey.value.length > 0)
  const hasOpenRouterKey = computed(() => openRouterKey.value.length > 0)
  const hasVercelKey = computed(() => vercelKey.value.length > 0)

  function hasKeyFor(provider: Provider): boolean {
    if (provider === 'openrouter') return hasOpenRouterKey.value
    if (provider === 'vercel') return hasVercelKey.value
    return hasGeminiKey.value
  }

  function getKey(provider: Provider): string {
    if (provider === 'openrouter') return openRouterKey.value
    if (provider === 'vercel') return vercelKey.value
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
    } else if (provider === 'vercel') {
      vercelKey.value = trimmed
      if (trimmed) {
        localStorage.setItem(VERCEL_STORAGE_KEY, trimmed)
      } else {
        localStorage.removeItem(VERCEL_STORAGE_KEY)
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

  return { geminiKey, openRouterKey, vercelKey, hasGeminiKey, hasOpenRouterKey, hasVercelKey, hasKeyFor, getKey, setKey, clearKey }
})
