<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  message: string
  type: 'success' | 'error' | 'info'
}>()

defineEmits<{ (e: 'close'): void }>()

const visible = ref(true)

const colors = computed(() => {
  switch (props.type) {
    case 'success':
      return 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 ring-green-200 dark:ring-green-800'
    case 'error':
      return 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 ring-red-200 dark:ring-red-800'
    default:
      return 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 ring-blue-200 dark:ring-blue-800'
  }
})
</script>

<template>
  <Transition
    enter-active-class="transition ease-out duration-200"
    enter-from-class="opacity-0 translate-y-2"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition ease-in duration-150"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 translate-y-2"
  >
    <div
      v-if="visible"
      :class="['rounded-lg px-4 py-3 text-sm ring-1 flex items-center justify-between', colors]"
    >
      <span>{{ message }}</span>
      <button
        @click="visible = false; $emit('close')"
        class="ml-3 opacity-60 hover:opacity-100 cursor-pointer"
      >
        ✕
      </button>
    </div>
  </Transition>
</template>
