import { ref, watch } from 'vue'

export type ThemeMode = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'nano-banana-theme'

const mode = ref<ThemeMode>((localStorage.getItem(STORAGE_KEY) as ThemeMode) || 'system')

function applyTheme() {
  const isDark =
    mode.value === 'dark' ||
    (mode.value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  document.documentElement.classList.toggle('dark', isDark)
}

// Listen to system preference changes
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
mediaQuery.addEventListener('change', () => {
  if (mode.value === 'system') applyTheme()
})

// Apply immediately on module load
applyTheme()

export function useTheme() {
  watch(mode, (val) => {
    localStorage.setItem(STORAGE_KEY, val)
    applyTheme()
  })

  function cycle() {
    const order: ThemeMode[] = ['system', 'light', 'dark']
    const idx = order.indexOf(mode.value)
    mode.value = order[(idx + 1) % order.length]
  }

  return { mode, cycle }
}
