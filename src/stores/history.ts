import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { HistoryEntry } from '../types'

const STORAGE_KEY = 'banacanvas-history'
const MAX_ENTRIES = 50
const WEBP_QUALITY = 0.85

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

async function toWebP(base64: string, mimeType: string): Promise<{ base64: string; mimeType: string }> {
  try {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const blob = new Blob([bytes], { type: mimeType })
    const bitmap = await createImageBitmap(blob)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
    bitmap.close()
    return new Promise((resolve) => {
      canvas.toBlob(
        (webpBlob) => {
          if (!webpBlob) {
            resolve({ base64, mimeType })
            return
          }
          const reader = new FileReader()
          reader.onload = () => {
            const dataUrl = reader.result as string
            const b64 = dataUrl.split(',')[1]
            resolve({ base64: b64, mimeType: 'image/webp' })
          }
          reader.readAsDataURL(webpBlob)
        },
        'image/webp',
        WEBP_QUALITY,
      )
    })
  } catch {
    return { base64, mimeType }
  }
}

export const useHistoryStore = defineStore('history', () => {
  const entries = ref<HistoryEntry[]>(loadHistory())

  async function addEntry(entry: Omit<HistoryEntry, 'id' | 'timestamp'>) {
    const [main, input] = await Promise.all([
      toWebP(entry.imageBase64, entry.imageMimeType),
      entry.inputImageBase64 && entry.inputImageMimeType
        ? toWebP(entry.inputImageBase64, entry.inputImageMimeType)
        : Promise.resolve(undefined),
    ])

    const newEntry: HistoryEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      imageBase64: main.base64,
      imageMimeType: main.mimeType,
      ...(input ? { inputImageBase64: input.base64, inputImageMimeType: input.mimeType } : {}),
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

