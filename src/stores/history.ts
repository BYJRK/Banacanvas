import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { HistoryEntry } from '../types'

const DB_NAME = 'banacanvas'
const DB_VERSION = 1
const STORE_NAME = 'history'
const WEBP_QUALITY = 0.85

// IndexedDB helpers

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('timestamp', 'timestamp')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function idbGetAll(db: IDBDatabase): Promise<HistoryEntry[]> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).index('timestamp').getAll()
    req.onsuccess = () => resolve((req.result as HistoryEntry[]).sort((a, b) => b.timestamp - a.timestamp))
    req.onerror = () => reject(req.error)
  })
}

function idbPut(db: IDBDatabase, entry: HistoryEntry): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(entry)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

function idbDelete(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

function idbClear(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// Migrate existing localStorage history into IndexedDB then remove it
async function migrateFromLocalStorage(db: IDBDatabase): Promise<void> {
  const raw = localStorage.getItem('banacanvas-history')
  if (!raw) return
  try {
    const entries: HistoryEntry[] = JSON.parse(raw)
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    for (const entry of entries) store.put(entry)
    await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error) })
    localStorage.removeItem('banacanvas-history')
  } catch { /* ignore */ }
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
          if (!webpBlob) { resolve({ base64, mimeType }); return }
          const reader = new FileReader()
          reader.onload = () => {
            const b64 = (reader.result as string).split(',')[1]
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
  const entries = ref<HistoryEntry[]>([])
  let db: IDBDatabase | null = null

  async function init() {
    db = await openDB()
    await migrateFromLocalStorage(db)
    entries.value = await idbGetAll(db)
  }

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

    if (db) {
      await idbPut(db, newEntry)
    }

    return newEntry
  }

  async function removeEntry(id: string) {
    entries.value = entries.value.filter((e) => e.id !== id)
    if (db) await idbDelete(db, id)
  }

  async function clearAll() {
    entries.value = []
    if (db) await idbClear(db)
  }

  return { entries, init, addEntry, removeEntry, clearAll }
})

