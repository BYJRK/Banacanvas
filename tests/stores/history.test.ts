import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { IDBFactory } from 'fake-indexeddb'
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
