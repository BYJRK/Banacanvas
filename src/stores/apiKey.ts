import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const STORAGE_KEY = 'nano-banana-api-key'

export const useApiKeyStore = defineStore('apiKey', () => {
  const apiKey = ref(localStorage.getItem(STORAGE_KEY) ?? '')

  const hasKey = computed(() => apiKey.value.length > 0)

  function setApiKey(key: string) {
    apiKey.value = key.trim()
    if (apiKey.value) {
      localStorage.setItem(STORAGE_KEY, apiKey.value)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  function clearApiKey() {
    apiKey.value = ''
    localStorage.removeItem(STORAGE_KEY)
  }

  return { apiKey, hasKey, setApiKey, clearApiKey }
})
