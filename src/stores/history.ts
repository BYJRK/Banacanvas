import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { HistoryEntry } from '../types'

const STORAGE_KEY = 'banacanvas-history'
const MAX_ENTRIES = 50

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveHistory(entries: HistoryEntry[]) {
  let toSave = entries
  while (toSave.length > 0) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
      return
    } catch {
      // localStorage full — drop oldest entry and retry
      toSave = toSave.slice(0, toSave.length - 1)
    }
  }
  localStorage.removeItem(STORAGE_KEY)
}

export const useHistoryStore = defineStore('history', () => {
  const entries = ref<HistoryEntry[]>(loadHistory())

  function addEntry(entry: Omit<HistoryEntry, 'id' | 'timestamp'>) {
    const newEntry: HistoryEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    }
    entries.value.unshift(newEntry)
    if (entries.value.length > MAX_ENTRIES) {
      entries.value = entries.value.slice(0, MAX_ENTRIES)
    }
    saveHistory(entries.value)
    return newEntry
  }

  function removeEntry(id: string) {
    entries.value = entries.value.filter((e) => e.id !== id)
    saveHistory(entries.value)
  }

  function clearAll() {
    entries.value = []
    localStorage.removeItem(STORAGE_KEY)
  }

  return { entries, addEntry, removeEntry, clearAll }
})
