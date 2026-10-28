import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { IDBFactory, IDBObjectStore, IDBIndex } from 'fake-indexeddb'
import JSZip from 'jszip'
import { useHistoryStore } from '../../src/stores/history'
import type { HistoryEntry } from '../../src/types'

const b64 = (text: string) => btoa(text)

function newEntry(n: number, extra: Partial<HistoryEntry> = {}): Omit<HistoryEntry, 'id' | 'timestamp'> {
  return {
    prompt: `prompt ${n}`,
    config: { provider: 'gemini', model: 'gemini-3.1-flash-image', aspectRatio: '1:1' },
    imageBase64: b64(`image ${n}`),
    imageMimeType: 'image/png',
    ...extra,
  }
}

/** A store backed by the current (per-test) IndexedDB, as after a page reload. */
async function freshStore() {
  setActivePinia(createPinia())
  const store = useHistoryStore()
  await store.init()
  return store
}

let now = 1_000
beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory())
  // No canvas in tests: WebP re-encoding falls back to the original image.
  vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('unsupported')))
  vi.spyOn(Date, 'now').mockImplementation(() => (now += 1_000))
  localStorage.removeItem('banacanvas-history')
})

describe('persistence', () => {
  it('adds entries newest first and keeps them across reloads', async () => {
    const store = await freshStore()

    const first = await store.addEntry(newEntry(1))
    const second = await store.addEntry(newEntry(2))

    expect(first.id).toEqual(expect.any(String))
    expect(second.timestamp).toBeGreaterThan(first.timestamp)
    expect(store.entries.map((e) => e.prompt)).toEqual(['prompt 2', 'prompt 1'])

    const reloaded = await freshStore()
    expect(reloaded.entries).toEqual(store.entries)
  })

  it('keeps the original image when WebP re-encoding is unavailable', async () => {
    const store = await freshStore()

    const entry = await store.addEntry(newEntry(1))

    expect(entry.imageBase64).toBe(b64('image 1'))
    expect(entry.imageMimeType).toBe('image/png')
  })

  it('stores reference images and upgrades the legacy single-image fields', async () => {
    const store = await freshStore()

    const entry = await store.addEntry(newEntry(1, { inputImageBase64: b64('ref'), inputImageMimeType: 'image/jpeg' }))

    expect(entry.inputImages).toEqual([{ base64: b64('ref'), mimeType: 'image/jpeg' }])
    expect(entry).not.toHaveProperty('inputImageBase64')
    expect(entry).not.toHaveProperty('inputImageMimeType')
  })

  it('migrates legacy localStorage history once', async () => {
    const legacy: HistoryEntry[] = [
      { ...newEntry(1), id: 'old-1', timestamp: 10 },
      { ...newEntry(2), id: 'old-2', timestamp: 20 },
    ]
    localStorage.setItem('banacanvas-history', JSON.stringify(legacy))

    const store = await freshStore()

    expect(store.entries.map((e) => e.id)).toEqual(['old-2', 'old-1'])
    expect(localStorage.getItem('banacanvas-history')).toBeNull()
    expect((await freshStore()).entries).toHaveLength(2)
  })
})

describe('removal', () => {
  it('removes selected entries from memory and storage', async () => {
    const store = await freshStore()
    const a = await store.addEntry(newEntry(1))
    const b = await store.addEntry(newEntry(2))
    const c = await store.addEntry(newEntry(3))

    await store.removeEntries([a.id, c.id])

    expect(store.entries.map((e) => e.id)).toEqual([b.id])
    expect((await freshStore()).entries.map((e) => e.id)).toEqual([b.id])
  })

  it('removes a single entry', async () => {
    const store = await freshStore()
    const a = await store.addEntry(newEntry(1))

    await store.removeEntry(a.id)

    expect(store.entries).toEqual([])
  })

  it('clears everything', async () => {
    const store = await freshStore()
    await store.addEntry(newEntry(1))
    await store.addEntry(newEntry(2))

    await store.clearAll()

    expect(store.entries).toEqual([])
    expect((await freshStore()).entries).toEqual([])
  })
})

describe('export and import', () => {
  async function exportedArchive() {
    const store = await freshStore()
    await store.addEntry(newEntry(1, { textResponse: 'hello' }))
    await store.addEntry(newEntry(2, {
      inputImages: [
        { base64: b64('ref a'), mimeType: 'image/png' },
        { base64: b64('ref b'), mimeType: 'image/jpeg' },
      ],
    }))
    const snapshot: HistoryEntry[] = JSON.parse(JSON.stringify(store.entries))
    const file = new File([await store.exportZip()], 'history.zip')
    return { file, snapshot }
  }

  it('round-trips entries, images and references', async () => {
    const { file, snapshot } = await exportedArchive()
    vi.stubGlobal('indexedDB', new IDBFactory())
    const target = await freshStore()

    const count = await target.importZip(file, 'overwrite')

    expect(count).toBe(2)
    expect(target.entries).toEqual(snapshot)
    expect((await freshStore()).entries).toEqual(snapshot)
  })

  it('writes metadata.json and an images folder', async () => {
    const { file, snapshot } = await exportedArchive()

    const zip = await JSZip.loadAsync(file)
    const metadata = JSON.parse(await zip.file('metadata.json')!.async('string'))

    const withRefs = snapshot.find((e) => e.inputImages?.length)!
    const meta = metadata.find((m: { id: string }) => m.id === withRefs.id)
    expect(meta).not.toHaveProperty('imageBase64')
    expect(meta.imageFile).toBe(`${withRefs.id}.png`)
    expect(meta.inputImageFiles).toEqual([`${withRefs.id}_input_0.png`, `${withRefs.id}_input_1.jpeg`])
    expect(zip.file(`images/${withRefs.id}_input_1.jpeg`)).not.toBeNull()
  })

  it('merges without duplicating existing entries', async () => {
    const { file, snapshot } = await exportedArchive()
    const store = await freshStore()
    const extra = await store.addEntry(newEntry(3))

    const count = await store.importZip(file, 'merge')

    expect(count).toBe(0)
    expect(store.entries.map((e) => e.id)).toEqual([extra.id, ...snapshot.map((e) => e.id)])
  })

  it('overwrite replaces existing entries', async () => {
    const { file, snapshot } = await exportedArchive()
    vi.stubGlobal('indexedDB', new IDBFactory())
    const store = await freshStore()
    await store.addEntry(newEntry(9))

    await store.importZip(file, 'overwrite')

    expect(store.entries.map((e) => e.id)).toEqual(snapshot.map((e) => e.id))
    expect((await freshStore()).entries).toHaveLength(2)
  })

  it('imports legacy archives with a single inputImageFile and .jpg names', async () => {
    const zip = new JSZip()
    zip.file('metadata.json', JSON.stringify([{
      id: 'legacy',
      timestamp: 5,
      prompt: 'old',
      config: { model: 'gemini-3.1-flash-image' },
      imageFile: 'legacy.jpg',
      inputImageFile: 'legacy_input.webp',
    }]))
    zip.file('images/legacy.jpg', b64('main'), { base64: true })
    zip.file('images/legacy_input.webp', b64('ref'), { base64: true })
    const store = await freshStore()

    await store.importZip(new File([await zip.generateAsync({ type: 'blob' })], 'old.zip'), 'merge')

    expect(store.entries).toEqual([{
      id: 'legacy',
      timestamp: 5,
      prompt: 'old',
      config: { model: 'gemini-3.1-flash-image' },
      imageBase64: b64('main'),
      imageMimeType: 'image/jpeg',
      inputImages: [{ base64: b64('ref'), mimeType: 'image/webp' }],
    }])
  })

  it('rejects archives without metadata.json', async () => {
    const zip = new JSZip()
    zip.file('readme.txt', 'nope')
    const store = await freshStore()

    await expect(store.importZip(new File([await zip.generateAsync({ type: 'blob' })], 'bad.zip'), 'merge'))
      .rejects.toThrow('metadata.json not found')
  })

  it('rejects archives with missing images and leaves history untouched', async () => {
    const zip = new JSZip()
    zip.file('metadata.json', JSON.stringify([{ id: 'x', timestamp: 1, prompt: 'p', config: {}, imageFile: 'x.png' }]))
    const store = await freshStore()
    const kept = await store.addEntry(newEntry(1))

    await expect(store.importZip(new File([await zip.generateAsync({ type: 'blob' })], 'bad.zip'), 'overwrite'))
      .rejects.toThrow('image x.png not found')
    expect(store.entries.map((e) => e.id)).toEqual([kept.id])
    expect((await freshStore()).entries.map((e) => e.id)).toEqual([kept.id])
  })
})

describe('initialization and transaction failures', () => {
  it('shares initialization, waits before saving and does not reload initialized state', async () => {
    const open = vi.spyOn(indexedDB, 'open')
    setActivePinia(createPinia())
    const store = useHistoryStore()
    const first = store.init()
    const second = store.init()
    expect(store.initializing).toBe(true)
    const saving = store.addEntry(newEntry(1))
    await Promise.all([first, second, saving])
    expect(open).toHaveBeenCalledTimes(1)
    expect(store.ready).toBe(true)
    expect(store.initializing).toBe(false)
    expect(store.initError).toBeNull()
    await store.init()
    expect(open).toHaveBeenCalledTimes(1)
    expect(store.entries).toHaveLength(1)
    expect((await freshStore()).entries).toEqual(store.entries)
  })

  it('exposes initialization errors, rejects writes and allows retry', async () => {
    setActivePinia(createPinia())
    const store = useHistoryStore()
    const open = vi.spyOn(indexedDB, 'open').mockImplementation(() => {
      throw new DOMException('Storage unavailable', 'SecurityError')
    })
    await expect(store.addEntry(newEntry(1))).rejects.toThrow('Storage unavailable')
    expect(store.ready).toBe(false)
    expect(store.initializing).toBe(false)
    expect(store.initError).toBe('Storage unavailable')
    expect(store.entries).toEqual([])
    open.mockRestore()
    await store.addEntry(newEntry(1))
    expect(store.ready).toBe(true)
    expect(store.initError).toBeNull()
    expect((await freshStore()).entries).toHaveLength(1)
  })

  it('closes a connection when reading history fails and retries cleanly', async () => {
    const loaded = await freshStore()
    await loaded.addEntry(newEntry(1))
    const read = vi.spyOn(IDBIndex.prototype, 'getAll').mockImplementationOnce(() => {
      throw new Error('Read failed')
    })
    setActivePinia(createPinia())
    const store = useHistoryStore()
    await expect(store.init()).rejects.toThrow('Read failed')
    expect(store.ready).toBe(false)
    expect(store.entries).toEqual([])
    read.mockRestore()
    await store.init()
    expect(store.entries).toEqual(loaded.entries)
  })

  it('keeps legacy history when migration fails and migrates it on retry', async () => {
    const legacy = [{ ...newEntry(1), id: 'legacy', timestamp: 1 }]
    const raw = JSON.stringify(legacy)
    localStorage.setItem('banacanvas-history', raw)
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
      throw new DOMException('Full', 'QuotaExceededError')
    })
    setActivePinia(createPinia())
    const store = useHistoryStore()
    await expect(store.init()).rejects.toMatchObject({ name: 'QuotaExceededError' })
    expect(localStorage.getItem('banacanvas-history')).toBe(raw)
    expect(store.ready).toBe(false)
    put.mockRestore()
    await store.init()
    expect(store.entries).toEqual(legacy)
    expect(localStorage.getItem('banacanvas-history')).toBeNull()
  })

  it('does not add phantom entries when storage quota is exceeded', async () => {
    const store = await freshStore()
    const kept = await store.addEntry(newEntry(1))
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
      throw new DOMException('Full', 'QuotaExceededError')
    })
    await expect(store.addEntry(newEntry(2))).rejects.toMatchObject({ name: 'QuotaExceededError' })
    expect(store.entries).toEqual([kept])
    put.mockRestore()
    expect((await freshStore()).entries).toEqual([kept])
  })

  it.each(['put', 'clear', 'delete'] as const)('rejects aborted %s transactions without changing memory or storage', async (method) => {
    const store = await freshStore()
    const kept = await store.addEntry(newEntry(1))
    const original = IDBObjectStore.prototype[method]
    const operation = vi.spyOn(IDBObjectStore.prototype, method).mockImplementation(function (this: IDBObjectStore, ...args: unknown[]) {
      const req = (original as (...args: unknown[]) => IDBRequest).apply(this, args)
      this.transaction.abort()
      return req
    })
    const action = method === 'put' ? store.addEntry(newEntry(2))
      : method === 'clear' ? store.clearAll() : store.removeEntry(kept.id)
    await expect(action).rejects.toBeDefined()
    expect(store.entries).toEqual([kept])
    operation.mockRestore()
    expect((await freshStore()).entries).toEqual([kept])
  })

  it('rejects asynchronous request errors with the transaction failure reason', async () => {
    const store = await freshStore()
    const kept = await store.addEntry(newEntry(1))
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(function (this: IDBObjectStore) {
      return this.add({ ...kept })
    })
    await expect(store.addEntry(newEntry(2))).rejects.toMatchObject({ name: 'ConstraintError' })
    expect(store.entries).toEqual([kept])
    put.mockRestore()
    expect((await freshStore()).entries).toEqual([kept])
  })

  it('rolls back overwrite import if writing fails after clearing', async () => {
    const zip = new JSZip()
    zip.file('metadata.json', JSON.stringify([{ id: 'new', timestamp: 1, prompt: 'p', config: {}, imageFile: 'new.png' }]))
    zip.file('images/new.png', b64('new'), { base64: true })
    const file = new File([await zip.generateAsync({ type: 'blob' })], 'history.zip')
    const store = await freshStore()
    const kept = await store.addEntry(newEntry(1))
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
      throw new DOMException('Full', 'QuotaExceededError')
    })
    await expect(store.importZip(file, 'overwrite')).rejects.toMatchObject({ name: 'QuotaExceededError' })
    expect(store.entries).toEqual([kept])
    put.mockRestore()
    expect((await freshStore()).entries).toEqual([kept])
  })

  it('resolves encoding fallback when FileReader fails instead of hanging', async () => {
    const store = await freshStore()
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 1, height: 1, close: vi.fn() }))
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(new Blob(['webp'], { type: 'image/webp' })))
    vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (this: FileReader) {
      this.dispatchEvent(new ProgressEvent('error'))
    })
    const entry = await store.addEntry(newEntry(1))
    expect(entry.imageBase64).toBe(b64('image 1'))
    expect(entry.imageMimeType).toBe('image/png')
  })

  it('exports existing data even when called before initialization', async () => {
    const initial = await freshStore()
    await initial.addEntry(newEntry(1))
    setActivePinia(createPinia())
    const store = useHistoryStore()
    const zip = await JSZip.loadAsync(await store.exportZip())
    expect(JSON.parse(await zip.file('metadata.json')!.async('string'))).toHaveLength(1)
  })
})
