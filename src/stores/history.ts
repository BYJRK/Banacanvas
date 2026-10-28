import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { getHistoryInputImages } from '../historyImages'
import type { HistoryEntry, InputImage } from '../types'

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

function idbWrite(db: IDBDatabase, write: (store: IDBObjectStore) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    let requestError: DOMException | null = null
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error ?? requestError ?? new Error('History transaction aborted'))
    tx.onerror = (event) => { requestError = (event.target as IDBRequest).error }
    try {
      write(tx.objectStore(STORE_NAME))
    } catch (e: unknown) {
      tx.abort()
      reject(e)
    }
  })
}

// Migrate existing localStorage history into IndexedDB then remove it
async function migrateFromLocalStorage(db: IDBDatabase): Promise<void> {
  let raw: string | null
  let entries: HistoryEntry[]
  try {
    raw = localStorage.getItem('banacanvas-history')
    if (!raw) return
    entries = JSON.parse(raw)
    if (!Array.isArray(entries)) return
  } catch { return }
  await idbWrite(db, (store) => {
    for (const entry of entries) store.put(entry)
  })
  try { localStorage.removeItem('banacanvas-history') } catch { /* migration is safe to repeat */ }
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
            resolve({ base64: b64, mimeType: webpBlob.type })
          }
          reader.onerror = reader.onabort = () => resolve({ base64, mimeType })
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
  const initializing = shallowRef(false)
  const ready = shallowRef(false)
  const initError = shallowRef<string | null>(null)
  let db: IDBDatabase | null = null
  let initPromise: Promise<IDBDatabase> | null = null

  function init(): Promise<IDBDatabase> {
    if (db && ready.value) return Promise.resolve(db)
    if (initPromise) return initPromise
    initializing.value = true
    initError.value = null
    initPromise = (async () => {
      let opened: IDBDatabase | null = null
      try {
        opened = await openDB()
        await migrateFromLocalStorage(opened)
        const saved = await idbGetAll(opened)
        db = opened
        entries.value = saved
        ready.value = true
        return opened
      } catch (e: unknown) {
        opened?.close()
        initError.value = e instanceof Error ? e.message : String(e)
        throw e
      } finally {
        initializing.value = false
        initPromise = null
      }
    })()
    return initPromise
  }

  async function addEntry(entry: Omit<HistoryEntry, 'id' | 'timestamp'>) {
    const database = await init()
    const [main, inputs] = await Promise.all([
      toWebP(entry.imageBase64, entry.imageMimeType),
      Promise.all(getHistoryInputImages(entry).map((image) => toWebP(image.base64, image.mimeType))),
    ])
    const { inputImageBase64: _ib, inputImageMimeType: _im, ...rest } = entry

    const newEntry: HistoryEntry = {
      ...rest,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      imageBase64: main.base64,
      imageMimeType: main.mimeType,
      inputImages: inputs,
    }

    await idbWrite(database, (store) => store.put(newEntry))
    entries.value.unshift(newEntry)

    return newEntry
  }

  async function removeEntries(ids: readonly string[]) {
    const idsToRemove = new Set(ids)
    if (idsToRemove.size === 0) return
    const database = await init()
    await idbWrite(database, (store) => {
      for (const id of idsToRemove) store.delete(id)
    })
    entries.value = entries.value.filter((entry) => !idsToRemove.has(entry.id))
  }

  async function removeEntry(id: string) {
    await removeEntries([id])
  }

  async function clearAll() {
    const database = await init()
    await idbWrite(database, (store) => store.clear())
    entries.value = []
  }

  async function exportZip(): Promise<Blob> {
    await init()
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    const imgFolder = zip.folder('images')!
    const metadata: Array<Omit<HistoryEntry, 'imageBase64' | 'imageMimeType' | 'inputImages' | 'inputImageBase64' | 'inputImageMimeType'> & {
      imageFile: string
      inputImageFiles: string[]
    }> = []

    for (const entry of entries.value) {
      const ext = entry.imageMimeType.split('/')[1] || 'webp'
      const imageFile = `${entry.id}.${ext}`
      imgFolder.file(imageFile, entry.imageBase64, { base64: true })

      const inputImageFiles = getHistoryInputImages(entry).map((image, index) => {
        const inputExt = image.mimeType.split('/')[1] || 'webp'
        const inputImageFile = `${entry.id}_input_${index}.${inputExt}`
        imgFolder.file(inputImageFile, image.base64, { base64: true })
        return inputImageFile
      })

      const { imageBase64: _, imageMimeType: _m, inputImages: _inputs, inputImageBase64: _ib, inputImageMimeType: _im, ...rest } = entry
      metadata.push({ ...rest, imageFile, inputImageFiles })
    }

    zip.file('metadata.json', JSON.stringify(metadata, null, 2))
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  }

  async function importZip(file: File, mode: 'merge' | 'overwrite'): Promise<number> {
    const database = await init()
    const { default: JSZip } = await import('jszip')
    const zip = await JSZip.loadAsync(file)
    const metaFile = zip.file('metadata.json')
    if (!metaFile) throw new Error('Invalid archive: metadata.json not found')
    const raw = await metaFile.async('string')
    const metadata: Array<Record<string, unknown>> = JSON.parse(raw)
    if (!Array.isArray(metadata)) throw new Error('Invalid metadata format')

    const existingIds = new Set(mode === 'merge' ? entries.value.map((e) => e.id) : [])
    const importedEntries: HistoryEntry[] = []

    for (const item of metadata) {
      const id = item.id as string
      if (mode === 'merge' && existingIds.has(id)) continue

      const imageFileName = item.imageFile as string
      const imgFile = zip.file(`images/${imageFileName}`)
      if (!imgFile) throw new Error(`Invalid archive: image ${imageFileName} not found`)

      const imageBase64 = await imgFile.async('base64')
      const ext = imageFileName.split('.').pop() || 'webp'
      const imageMimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`

      const inputImages: Omit<InputImage, 'id'>[] = []
      const inputImageFiles = Array.isArray(item.inputImageFiles)
        ? item.inputImageFiles as string[]
        : item.inputImageFile ? [item.inputImageFile as string] : []
      for (const name of inputImageFiles) {
        const inputFile = zip.file(`images/${name}`)
        if (!inputFile) throw new Error(`Invalid archive: reference image ${name} not found`)
        const inputExt = name.split('.').pop() || 'webp'
        inputImages.push({
          base64: await inputFile.async('base64'),
          mimeType: `image/${inputExt === 'jpg' ? 'jpeg' : inputExt}`,
        })
      }

      const { imageFile: _if, inputImageFile: _iif, inputImageFiles: _iifs, ...rest } = item
      const entry: HistoryEntry = {
        ...rest,
        imageBase64,
        imageMimeType,
        inputImages,
      } as HistoryEntry

      importedEntries.push(entry)
    }

    await idbWrite(database, (store) => {
      if (mode === 'overwrite') store.clear()
      for (const entry of importedEntries) store.put(entry)
    })

    entries.value = (mode === 'overwrite' ? importedEntries : [...entries.value, ...importedEntries])
      .sort((a, b) => b.timestamp - a.timestamp)
    return importedEntries.length
  }

  return { entries, initializing, ready, initError, init, addEntry, removeEntry, removeEntries, clearAll, exportZip, importZip }
})

