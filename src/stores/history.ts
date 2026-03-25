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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // localStorage full — trim oldest entries and retry
    const trimmed = entries.slice(0, Math.floor(entries.length / 2))
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
    } catch {
      // give up
    }
  }
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
