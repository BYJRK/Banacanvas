import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import * as vue from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import JSZip from 'jszip'

const require = createRequire(import.meta.url)
const hooks = []
const load = (path) => {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  const localRequire = (name) => {
    if (name === 'vue') return { ...vue, onBeforeUnmount: (hook) => hooks.push(hook) }
    if (name.endsWith('useI18n')) return { useI18n: () => ({ t: (key) => key }) }
    if (name.endsWith('historyImages')) return load('./src/historyImages.ts')
    return require(name)
  }
  vm.runInThisContext(`(function(require, module, exports) { ${code}\n})`)(localRequire, module, module.exports)
  return module.exports
}
const { getHistoryInputImages } = load('./src/historyImages.ts')
const { useReferenceImageResize } = load('./src/composables/useReferenceImageResize.ts')
const { useHistoryStore } = load('./src/stores/history.ts')
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve() }
const image = (id) => ({ id, base64: btoa(id), mimeType: 'image/png' })

globalThis.localStorage = { getItem: () => null, setItem: () => {} }
globalThis.Image = class {
  naturalWidth = 4000
  naturalHeight = 3000
  set src(value) { if (value) queueMicrotask(() => this.onload?.()) }
}

test('restored oversized references are not checked; new references still prompt', async () => {
  const images = vue.ref([])
  const resize = useReferenceImageResize(images, assert.fail)
  resize.restoreImages([image('history-a'), image('history-b')])
  await flush()
  assert.equal(resize.request.value, null)
  assert.equal(resize.busy.value, false)
  images.value = [...images.value, image('upload')]
  await flush()
  assert.equal(resize.request.value.id, 'upload')
  resize.decide(false)
  await flush()
  assert.equal(images.value.length, 3)
  assert.equal(resize.busy.value, false)
})

test('restoring history dismisses the old prompt and skips queued old references', async () => {
  const images = vue.ref([])
  const resize = useReferenceImageResize(images, assert.fail)
  images.value = [image('old-a'), image('old-b')]
  await flush()
  assert.equal(resize.request.value.id, 'old-a')
  resize.restoreImages([image('history')])
  await flush()
  assert.equal(resize.request.value, null)
  assert.equal(resize.busy.value, false)
  assert.deepEqual(images.value.map((item) => item.id), ['history'])
})

test('legacy references normalize, and an explicit empty list wins', () => {
  const legacy = { inputImageBase64: 'YQ==', inputImageMimeType: 'image/png' }
  assert.deepEqual(getHistoryInputImages(legacy), [{ base64: 'YQ==', mimeType: 'image/png' }])
  assert.deepEqual(getHistoryInputImages({ ...legacy, inputImages: [] }), [])
  assert.deepEqual(getHistoryInputImages({}), [])
})

test('all references are converted and survive ZIP round-trip; legacy ZIP imports', async () => {
  globalThis.createImageBitmap = async () => ({ width: 1, height: 1, close() {} })
  globalThis.document = { createElement: () => ({
    getContext: () => ({ drawImage() {} }),
    toBlob: (callback) => callback(new Blob(['webp'], { type: 'image/webp' })),
  }) }
  globalThis.FileReader = class {
    async readAsDataURL(blob) {
      this.result = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`
      this.onload()
    }
  }
  setActivePinia(createPinia())
  const store = useHistoryStore()
  const entry = await store.addEntry({
    prompt: 'test', config: { provider: 'gemini', model: 'test' },
    imageBase64: 'YQ==', imageMimeType: 'image/png',
    inputImages: [image('a'), image('b'), image('c')],
  })
  assert.equal(entry.inputImages.length, 3)
  assert.ok(entry.inputImages.every((item) => item.mimeType === 'image/webp'))
  // Distinct payloads verify order independently of the encoder stub.
  entry.inputImages = ['a', 'b', 'c'].map((value) => ({ base64: btoa(value), mimeType: 'image/webp' }))
  const archive = await store.exportZip()
  const bytes = await archive.arrayBuffer()
  const zip = await JSZip.loadAsync(bytes)
  const metadata = JSON.parse(await zip.file('metadata.json').async('string'))
  assert.equal(metadata[0].inputImages, undefined)
  assert.equal(metadata[0].inputImageFiles.length, 3)
  setActivePinia(createPinia())
  const imported = useHistoryStore()
  assert.equal(await imported.importZip(bytes, 'merge'), 1)
  assert.deepEqual(imported.entries[0].inputImages, entry.inputImages)
  assert.equal(await imported.importZip(bytes, 'merge'), 0)
  const legacyZip = new JSZip()
  legacyZip.file('images/main.png', 'YQ==', { base64: true })
  legacyZip.file('images/input.jpg', 'Yg==', { base64: true })
  legacyZip.file('metadata.json', JSON.stringify([{ id: 'legacy', timestamp: 1, prompt: '', config: {}, imageFile: 'main.png', inputImageFile: 'input.jpg' }]))
  await imported.importZip(await legacyZip.generateAsync({ type: 'uint8array' }), 'merge')
  assert.deepEqual(getHistoryInputImages(imported.entries.find((item) => item.id === 'legacy')), [{ base64: 'Yg==', mimeType: 'image/jpeg' }])
})

test('invalid ZIP imports leave existing history unchanged; valid overwrite replaces it', async () => {
  setActivePinia(createPinia())
  const store = useHistoryStore()
  const original = { id: 'original', timestamp: 1, prompt: '', config: {}, imageBase64: 'YQ==', imageMimeType: 'image/png' }
  store.entries = [original]
  const zip = new JSZip()
  zip.file('images/main.png', 'Yg==', { base64: true })
  const valid = { id: 'replacement', timestamp: 2, prompt: '', config: {}, imageFile: 'main.png', inputImageFiles: [] }
  const invalid = { ...valid, id: 'broken', inputImageFiles: ['missing.png'] }
  zip.file('metadata.json', JSON.stringify([valid, invalid]))
  const brokenBytes = await zip.generateAsync({ type: 'uint8array' })
  for (const mode of ['overwrite', 'merge']) {
    await assert.rejects(store.importZip(brokenBytes, mode), /reference image missing.png not found/)
    assert.deepEqual(store.entries, [original])
  }
  zip.file('metadata.json', JSON.stringify([{ ...valid, imageFile: 'missing.png' }]))
  await assert.rejects(store.importZip(await zip.generateAsync({ type: 'uint8array' }), 'overwrite'), /image missing.png not found/)
  assert.deepEqual(store.entries, [original])
  zip.file('metadata.json', JSON.stringify([valid]))
  assert.equal(await store.importZip(await zip.generateAsync({ type: 'uint8array' }), 'overwrite'), 1)
  assert.deepEqual(store.entries.map((entry) => entry.id), ['replacement'])
})

// Hold deletion transactions open so tests can observe state before commit or abort.
async function historyWithPendingDeletes(t) {
  const previousIndexedDB = globalThis.indexedDB
  const transactions = []
  const db = {
    transaction(_name, mode) {
      if (mode === 'readonly') {
        return { objectStore: () => ({ index: () => ({ getAll() {
          const request = { result: [] }
          queueMicrotask(() => request.onsuccess())
          return request
        } }) }) }
      }
      const tx = {
        error: null,
        deletedIds: [],
        objectStore: () => ({ delete: (id) => tx.deletedIds.push(id) }),
        abort: () => tx.onabort(),
      }
      transactions.push(tx)
      return tx
    },
  }
  globalThis.indexedDB = { open() {
    const request = { result: db }
    queueMicrotask(() => request.onsuccess())
    return request
  } }
  t.after(() => { globalThis.indexedDB = previousIndexedDB })
  setActivePinia(createPinia())
  const store = useHistoryStore()
  await store.init()
  store.entries = ['batch-a', 'batch-b', 'other'].map((id) => ({
    id, timestamp: 1, prompt: '', config: {}, imageBase64: 'YQ==', imageMimeType: 'image/png',
  }))
  return { store, transactions }
}

test('batch deletion updates the list once after commit and preserves concurrent additions', async (t) => {
  const { store, transactions } = await historyWithPendingDeletes(t)
  const deletion = store.removeEntries(['batch-a', 'batch-b', 'batch-a'])
  assert.equal(transactions.length, 1)
  assert.deepEqual(transactions[0].deletedIds, ['batch-a', 'batch-b'])
  assert.deepEqual(store.entries.map((entry) => entry.id), ['batch-a', 'batch-b', 'other'])

  store.entries = [{ ...store.entries[0], id: 'new' }, ...store.entries]
  const updates = []
  const stop = vue.watch(() => store.entries.map((entry) => entry.id), (ids) => updates.push(ids), { flush: 'sync' })
  t.after(stop)
  transactions[0].oncomplete()
  await deletion
  assert.deepEqual(updates, [['new', 'other']])
})

test('aborted batch deletion preserves the full list and single deletion still works', async (t) => {
  const { store, transactions } = await historyWithPendingDeletes(t)
  const before = store.entries
  const deletion = store.removeEntries(['batch-a', 'batch-b'])
  transactions[0].error = new Error('Deletion aborted')
  transactions[0].onabort()
  await assert.rejects(deletion, /Deletion aborted/)
  assert.equal(store.entries, before)

  const singleDeletion = store.removeEntry('other')
  assert.deepEqual(transactions[1].deletedIds, ['other'])
  transactions[1].oncomplete()
  await singleDeletion
  assert.deepEqual(store.entries.map((entry) => entry.id), ['batch-a', 'batch-b'])

  const remaining = store.entries
  await store.removeEntries([])
  assert.equal(transactions.length, 2)
  assert.equal(store.entries, remaining)
})
