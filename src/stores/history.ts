import { defineStore } from 'pinia'
import { ref } from 'vue'
import JSZip from 'jszip'
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

  async function exportZip(): Promise<Blob> {
    const zip = new JSZip()
    const imgFolder = zip.folder('images')!
    const metadata: Array<Omit<HistoryEntry, 'imageBase64' | 'imageMimeType' | 'inputImageBase64' | 'inputImageMimeType'> & {
      imageFile: string
      inputImageFile?: string
    }> = []

    for (const entry of entries.value) {
      const ext = entry.imageMimeType.split('/')[1] || 'webp'
      const imageFile = `${entry.id}.${ext}`
      imgFolder.file(imageFile, entry.imageBase64, { base64: true })

      let inputImageFile: string | undefined
      if (entry.inputImageBase64 && entry.inputImageMimeType) {
        const inputExt = entry.inputImageMimeType.split('/')[1] || 'webp'
        inputImageFile = `${entry.id}_input.${inputExt}`
        imgFolder.file(inputImageFile, entry.inputImageBase64, { base64: true })
      }

      const { imageBase64: _, imageMimeType: _m, inputImageBase64: _ib, inputImageMimeType: _im, ...rest } = entry
      metadata.push({ ...rest, imageFile, ...(inputImageFile ? { inputImageFile } : {}) })
    }

    zip.file('metadata.json', JSON.stringify(metadata, null, 2))
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  }

  async function importZip(file: File, mode: 'merge' | 'overwrite'): Promise<number> {
    const zip = await JSZip.loadAsync(file)
    const metaFile = zip.file('metadata.json')
    if (!metaFile) throw new Error('Invalid archive: metadata.json not found')
    const raw = await metaFile.async('string')
    const metadata: Array<Record<string, unknown>> = JSON.parse(raw)
    if (!Array.isArray(metadata)) throw new Error('Invalid metadata format')

    if (mode === 'overwrite') {
      entries.value = []
      if (db) await idbClear(db)
    }

    const existingIds = new Set(entries.value.map((e) => e.id))
    let importedCount = 0

    for (const item of metadata) {
      const id = item.id as string
      if (mode === 'merge' && existingIds.has(id)) continue

      const imageFileName = item.imageFile as string
      const imgFile = zip.file(`images/${imageFileName}`)
      if (!imgFile) continue

      const imageBase64 = await imgFile.async('base64')
      const ext = imageFileName.split('.').pop() || 'webp'
      const imageMimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`

      let inputImageBase64: string | undefined
      let inputImageMimeType: string | undefined
      if (item.inputImageFile) {
        const inputFile = zip.file(`images/${item.inputImageFile as string}`)
        if (inputFile) {
          inputImageBase64 = await inputFile.async('base64')
          const inputExt = (item.inputImageFile as string).split('.').pop() || 'webp'
          inputImageMimeType = `image/${inputExt === 'jpg' ? 'jpeg' : inputExt}`
        }
      }

      const { imageFile: _if, inputImageFile: _iif, ...rest } = item
      const entry: HistoryEntry = {
        ...rest,
        imageBase64,
        imageMimeType,
        ...(inputImageBase64 ? { inputImageBase64, inputImageMimeType } : {}),
      } as HistoryEntry

      entries.value.push(entry)
      if (db) await idbPut(db, entry)
      importedCount++
    }

    entries.value.sort((a, b) => b.timestamp - a.timestamp)
    return importedCount
  }

  return { entries, init, addEntry, removeEntry, clearAll, exportZip, importZip }
})

