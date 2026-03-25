import { ref, computed, watchEffect } from 'vue'
import messages, { type Locale, type MessageKey } from '../i18n/messages'

const STORAGE_KEY = 'nano-banana-locale'

function detectLocale(): Locale {
  const saved = localStorage.getItem(STORAGE_KEY) as Locale | null
  if (saved && saved in messages) return saved
  const nav = navigator.language.toLowerCase()
  return nav.startsWith('zh') ? 'zh' : 'en'
}

const locale = ref<Locale>(detectLocale())

watchEffect(() => {
  document.documentElement.lang = locale.value === 'zh' ? 'zh-CN' : 'en'
})

export function useI18n() {
  function t(key: MessageKey): string {
    return messages[locale.value][key] ?? messages.en[key] ?? key
  }

  function setLocale(l: Locale) {
    locale.value = l
    localStorage.setItem(STORAGE_KEY, l)
  }

  function toggleLocale() {
    setLocale(locale.value === 'en' ? 'zh' : 'en')
  }

  return {
    locale: computed(() => locale.value),
    t,
    setLocale,
    toggleLocale,
  }
}
