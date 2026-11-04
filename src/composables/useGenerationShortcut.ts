import { onMounted, onBeforeUnmount } from 'vue'

export function useGenerationShortcut(canGenerate: () => boolean, generate: () => void | Promise<void>) {
  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Enter' || !event.ctrlKey || event.isComposing) return

    event.preventDefault()
    event.stopPropagation()
    if (!event.repeat && canGenerate()) void generate()
  }

  // Capture also handles focus inside teleported editors and controls that stop bubbling.
  onMounted(() => document.addEventListener('keydown', onKeydown, true))
  onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown, true))
}
