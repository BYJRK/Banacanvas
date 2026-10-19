import { ref, onBeforeUnmount } from 'vue'

const WIDTH_KEY = 'banacanvas-sidebar-width'

/** Drag-to-resize width for a right-anchored sidebar, persisted to localStorage. */
export function useResizableSidebar(minWidth: number, maxWidth: number) {
  const width = ref(Number(localStorage.getItem(WIDTH_KEY)) || minWidth)
  // Active drag cleanup so listeners are removed if the component unmounts mid-drag.
  let cleanup: (() => void) | null = null

  function startDrag<E extends MouseEvent | TouchEvent>(
    startX: number,
    moveEvent: 'mousemove' | 'touchmove',
    endEvent: 'mouseup' | 'touchend',
    getX: (event: E) => number,
  ) {
    cleanup?.()
    const startWidth = width.value
    const onMove = (event: Event) => {
      const delta = startX - getX(event as E) // dragging left = wider
      width.value = Math.min(maxWidth, Math.max(minWidth, startWidth + delta))
    }
    const onEnd = () => {
      cleanup?.()
      localStorage.setItem(WIDTH_KEY, String(width.value))
    }
    cleanup = () => {
      document.removeEventListener(moveEvent, onMove)
      document.removeEventListener(endEvent, onEnd)
      cleanup = null
    }
    document.addEventListener(moveEvent, onMove)
    document.addEventListener(endEvent, onEnd)
  }

  function onMouseDown(event: MouseEvent) {
    startDrag<MouseEvent>(event.clientX, 'mousemove', 'mouseup', (e) => e.clientX)
  }

  function onTouchStart(event: TouchEvent) {
    startDrag<TouchEvent>(event.touches[0].clientX, 'touchmove', 'touchend', (e) => e.touches[0].clientX)
  }

  onBeforeUnmount(() => cleanup?.())

  return { width, onMouseDown, onTouchStart }
}
