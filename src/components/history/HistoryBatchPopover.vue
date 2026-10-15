<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, shallowRef, useTemplateRef, watch } from 'vue'
import { Dialog, DialogPanel } from '@headlessui/vue'
import type { HistoryEntry, HistoryGroup } from '../../types'
import HistoryBatchContent from './HistoryBatchContent.vue'

const props = defineProps<{ group: HistoryGroup; anchor: HTMLButtonElement; id: string }>()
const emit = defineEmits<{ close: [restoreFocus: boolean]; select: [entry: HistoryEntry] }>()
const panel = useTemplateRef<HTMLElement>('panel')
const isMobile = window.matchMedia('(max-width: 639px)').matches
const position = shallowRef({ top: '0px', left: '0px', width: '0px' })
let observer: ResizeObserver | null = null
let frame = 0

function updatePosition() {
  if (!props.anchor.isConnected) { emit('close', false); return }
  const rect = props.anchor.getBoundingClientRect()
  const scrollRect = props.anchor.closest('[data-history-scroll]')?.getBoundingClientRect()
  if (scrollRect && (rect.bottom <= scrollRect.top || rect.top >= scrollRect.bottom)) {
    emit('close', false)
    return
  }
  if (isMobile) return
  const margin = 12
  const gap = 12
  const viewportWidth = document.documentElement.clientWidth
  const viewportHeight = window.innerHeight
  const desiredWidth = Math.min(548, viewportWidth - margin * 2)
  const leftSpace = rect.left - margin - gap
  const rightSpace = viewportWidth - rect.right - margin - gap
  const availableSpace = Math.max(leftSpace, rightSpace)
  const width = availableSpace >= Math.min(360, desiredWidth) ? Math.min(desiredWidth, availableSpace) : desiredWidth
  const left = availableSpace >= Math.min(360, desiredWidth)
    ? leftSpace > rightSpace ? rect.left - gap - width : rect.right + gap
    : rect.left + (rect.width - width) / 2
  const height = panel.value?.getBoundingClientRect().height ?? 300
  position.value = {
    top: `${Math.max(margin, Math.min(rect.top, viewportHeight - height - margin))}px`,
    left: `${Math.max(margin, Math.min(left, viewportWidth - width - margin))}px`,
    width: `${width}px`,
  }
}
function schedulePosition(event?: Event) {
  // Scrolling the image grid should not move its containing popover.
  if (event?.target instanceof Node && panel.value?.contains(event.target)) return
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(updatePosition)
}
function onPointerDown(event: PointerEvent) {
  if (isMobile || !(event.target instanceof Node)) return
  if (!panel.value?.contains(event.target) && !props.anchor.contains(event.target)) emit('close', false)
}
function onFocusIn(event: FocusEvent) {
  if (isMobile || !(event.target instanceof Node)) return
  if (!panel.value?.contains(event.target) && !props.anchor.contains(event.target)) emit('close', false)
}
function onKeydown(event: KeyboardEvent) {
  if (isMobile || event.key !== 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  emit('close', true)
}
async function onResize() {
  // A breakpoint change can remount waterfall cards and invalidate the anchor.
  if (isMobile !== window.matchMedia('(max-width: 639px)').matches) {
    emit('close', false)
    return
  }
  await nextTick()
  updatePosition()
}
onMounted(async () => {
  updatePosition()
  observer = new ResizeObserver(() => schedulePosition())
  observer.observe(props.anchor)
  if (panel.value) observer.observe(panel.value)
  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('focusin', onFocusIn)
  document.addEventListener('keydown', onKeydown, true)
  window.addEventListener('resize', onResize)
  window.addEventListener('scroll', schedulePosition, true)
  await nextTick()
  if (!isMobile) panel.value?.focus({ preventScroll: true })
})
watch(() => props.group.entries.length, () => schedulePosition())
onUnmounted(() => {
  observer?.disconnect()
  cancelAnimationFrame(frame)
  document.removeEventListener('pointerdown', onPointerDown, true)
  document.removeEventListener('focusin', onFocusIn)
  document.removeEventListener('keydown', onKeydown, true)
  window.removeEventListener('resize', onResize)
  window.removeEventListener('scroll', schedulePosition, true)
})
</script>

<template>
  <Dialog v-if="isMobile" :open="true" class="fixed inset-0 z-[80]" @close="emit('close', true)">
    <div class="fixed inset-0 bg-black/40 backdrop-blur-[2px]" aria-hidden="true" />
    <div class="fixed inset-0 flex items-end">
      <DialogPanel :id="id" class="batch-sheet w-full max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl pb-[env(safe-area-inset-bottom)]">
        <div class="mx-auto mt-2 h-1 w-8 rounded-full bg-gray-300 dark:bg-gray-600" aria-hidden="true" />
        <HistoryBatchContent :group="group" :id="id" modal @close="emit('close', true)" @select="emit('select', $event)" />
      </DialogPanel>
    </div>
  </Dialog>
  <Teleport v-else to="body">
    <section :id="id" ref="panel" role="dialog" :aria-labelledby="`${id}-title`" tabindex="-1" :style="position" class="batch-popover fixed z-[80] max-h-[calc(100dvh-24px)] overflow-y-auto rounded-xl border border-violet-200 dark:border-violet-900 bg-white dark:bg-gray-900 shadow-2xl shadow-black/20 focus:outline-none">
      <HistoryBatchContent :group="group" :id="id" @close="emit('close', true)" @select="emit('select', $event)" />
    </section>
  </Teleport>
</template>

<style scoped>
.batch-popover { animation: batch-appear 140ms ease-out; }
.batch-sheet { animation: batch-slide 180ms ease-out; }
@keyframes batch-appear { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
@keyframes batch-slide { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .batch-popover, .batch-sheet { animation: none; }
}
</style>
