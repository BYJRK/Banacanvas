import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test, afterEach } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const cache = new Map()
function load(path) {
  if (cache.has(path)) return cache.get(path)
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  const localRequire = (name) => {
    if (name.endsWith('stores/apiKey')) return { useApiKeyStore: () => ({ getKey: () => 'test-key' }) }
    if (name.endsWith('useI18n')) return { useI18n: () => ({ t: (key) => key }) }
    if (name.endsWith('config/models')) return load('./src/config/models.ts')
    if (name.endsWith('maiImages')) return load('./src/maiImages.ts')
    return require(name)
  }
  vm.runInThisContext(`(function(require, module, exports) { ${code}\n})`)(localRequire, module, module.exports)
  cache.set(path, module.exports)
  return module.exports
}
const models = load('./src/config/models.ts')
const { useOpenRouter } = load('./src/composables/useOpenRouter.ts')
const { useVercelAI } = load('./src/composables/useVercelAI.ts')
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS1sAAAAASUVORK5CYII='
const image = { id: 'reference', mimeType: 'image/png', base64: png }
const config = (provider, model = models.MAI_IMAGE_2_6_MODEL, extra = {}) => ({ provider, model, aspectRatio: '16:9', imageSize: '1.5K', ...extra })
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const originalFetch = globalThis.fetch
const originalBitmap = globalThis.createImageBitmap
const originalDocument = globalThis.document
afterEach(() => {
  globalThis.fetch = originalFetch
  globalThis.createImageBitmap = originalBitmap
  globalThis.document = originalDocument
})

test('both providers list both MAI models; all size presets meet Azure pixel constraints', () => {
  for (const provider of ['openrouter', 'vercel']) {
    assert.equal(models.getModelsForProvider(provider).filter((model) => models.isMaiImageModel(model.id)).length, 2)
  }
  for (const size of ['1K', '1.5K']) {
    for (const ratio of models.getAspectRatios(models.MAI_IMAGE_2_6_MODEL).filter((ratio) => ratio !== 'auto')) {
      const [width, height] = models.getMaiImageSize(ratio, size).split('x').map(Number)
      assert.ok(width >= 768 && height >= 768 && width * height <= 1536 ** 2)
    }
  }
  assert.equal(models.getMaiImageSize('auto', '1.5K'), undefined)
  assert.equal(models.supportsImageSizeConfiguration(models.MAI_IMAGE_2_6_MODEL, 'openrouter'), false)
  assert.equal(models.getResolution('1:1', '1K', models.MAI_IMAGE_2_6_MODEL, 'openrouter'), undefined)
  assert.equal(models.getMaxInputImages(models.MAI_IMAGE_2_6_MODEL), 5)
  for (const size of ['1K', '1.5K']) {
    for (const provider of ['openrouter', 'vercel']) {
      const multiplier = provider === 'vercel' && size === '1.5K' ? 2 : 1
      for (const batchSize of [1, 3]) {
        assert.equal(models.estimateImageOutputCost(models.MAI_IMAGE_2_6_MODEL, size, batchSize, 'medium', provider), 0.04 * multiplier * batchSize)
        assert.equal(models.estimateImageOutputCost(models.MAI_IMAGE_2_6_FLASH_MODEL, size, batchSize, 'medium', provider), 0.02 * multiplier * batchSize)
      }
    }
  }
  assert.equal(models.getImageSizes('google/gemini-3.1-flash-image').length, 4)
})

test('OpenRouter uses Image API, omits unsupported controls, and preserves exact billed cost', async () => {
  for (const model of [models.MAI_IMAGE_2_6_MODEL, models.MAI_IMAGE_2_6_FLASH_MODEL]) {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://openrouter.ai/api/v1/images')
      const body = JSON.parse(options.body)
      assert.equal(body.model, model)
      assert.equal(body.aspect_ratio, '16:9')
      assert.equal(body.n, 1)
      for (const key of ['resolution', 'size', 'quality', 'seed', 'modalities', 'messages']) assert.equal(key in body, false)
      assert.equal(body.provider.options.azure.web_grounding, true)
      assert.equal(body.input_references.length, 1)
      return json({ data: [{ b64_json: png }], usage: { prompt_tokens: 100, completion_tokens: 1024, cost: 0.047 } })
    }
    const result = await useOpenRouter().editImage([image], 'edit', config('openrouter', model, { webGrounding: true, seed: 5 }))
    assert.equal(result.imageBase64, png)
    assert.equal(result.usage.estimatedCost, 0.047)
    assert.equal(result.usage.costIsExact, true)
  }
})

test('OpenRouter missing/null billing does not become zero or a Gemini estimate', async () => {
  for (const cost of [undefined, null, '']) {
    globalThis.fetch = async () => json({ data: [{ b64_json: png }], usage: { cost } })
    const result = await useOpenRouter().generateImage('create', config('openrouter'))
    assert.equal(result.usage.estimatedCost, undefined)
    assert.equal(result.usage.costIsExact, false)
  }
  globalThis.fetch = async () => json({ data: [{ b64_json: png }], usage: { prompt_tokens: 100, completion_tokens: 1000 } })
  const result = await useOpenRouter().generateImage('create', config('openrouter'))
  assert.equal(result.usage.estimatedCost, 0.0385)
})

test('Vercel real AI SDK sends image-model requests and calculates separate text/image pricing', async () => {
  for (const model of [models.MAI_IMAGE_2_6_MODEL, models.MAI_IMAGE_2_6_FLASH_MODEL]) {
    globalThis.fetch = async (url, options) => {
      assert.ok(String(url).endsWith('/image-model'))
      assert.equal(new Headers(options.headers).get('ai-model-id'), model)
      const body = JSON.parse(options.body)
      assert.equal(body.size, models.getMaiImageSize('16:9', '1.5K'))
      assert.equal(body.files.length, 1)
      assert.equal(body.providerOptions.google, undefined)
      assert.equal(body.providerOptions.azure.webGrounding, true)
      return json({ images: [png], usage: { inputTokens: 150, outputTokens: 1000, totalTokens: 1150 }, providerMetadata: { azure: { images: [{ textTokens: 100, imageTokens: 50 }] } } })
    }
    const api = useVercelAI()
    const result = await api.editImage([image], 'edit', config('vercel', model, { webGrounding: true }))
    const pricing = models.MODEL_PRICING[model]
    const expected = (100 * pricing.inputText + 50 * pricing.inputImage + 1000 * pricing.outputImage) / 1e6 + 0.014
    assert.equal(result.usage.estimatedCost, expected)
    assert.equal(result.imageBase64, png)
    assert.equal(api.loading.value, false)
  }
})

test('Vercel auto ratio omits size and tolerates missing usage', async () => {
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body)
    assert.equal(body.size, undefined)
    assert.equal(body.providerOptions.azure.autoAspectRatio, true)
    return json({ images: [png] })
  }
  const result = await useVercelAI().generateImage('create', config('vercel', undefined, { aspectRatio: 'auto' }))
  assert.equal(result.usage.estimatedCost, undefined)
})

test('both providers reject too many references before sending a request', async () => {
  globalThis.fetch = () => assert.fail('must not send')
  for (const [provider, createApi] of [['openrouter', useOpenRouter], ['vercel', useVercelAI]]) {
    const api = createApi()
    await assert.rejects(api.editImage(Array(6).fill(image), 'edit', config(provider)), /referenceImagesLimitReached/)
    assert.equal(api.loading.value, false)
    assert.ok(api.error.value)
  }
})

test('WebP history images are converted to PNG for both providers', async () => {
  let closed = 0
  globalThis.createImageBitmap = async () => ({ width: 1, height: 1, close: () => closed++ })
  globalThis.document = { createElement: () => ({ getContext: () => ({ drawImage() {} }), toDataURL: () => `data:image/png;base64,${png}` }) }
  for (const [provider, createApi] of [['openrouter', useOpenRouter], ['vercel', useVercelAI]]) {
    globalThis.fetch = async (url, options) => {
      const body = JSON.parse(options.body)
      if (provider === 'openrouter') {
        assert.equal(body.input_references[0].image_url.url, `data:image/png;base64,${png}`)
        return json({ data: [{ b64_json: png }] })
      }
      assert.equal(body.files[0].mediaType, 'image/png')
      return json({ images: [png] })
    }
    await createApi().editImage([{ ...image, mimeType: 'image/webp' }], 'edit', config(provider))
  }
  assert.equal(closed, 2)
})

test('cancel and external abort finish cleanly, and the next request still works', async () => {
  for (const [provider, createApi] of [['openrouter', useOpenRouter], ['vercel', useVercelAI]]) {
    for (const external of [false, true]) {
      let started
      const ready = new Promise((resolve) => { started = resolve })
      globalThis.fetch = async (url, options) => new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
        started()
      })
      const api = createApi()
      const controller = new AbortController()
      const pending = api.generateImage('create', config(provider), external ? controller.signal : undefined)
      await ready
      if (external) controller.abort()
      else api.cancel()
      await assert.rejects(pending, /generationCancelled/)
      assert.equal(api.loading.value, false)
      globalThis.fetch = async () => json(provider === 'openrouter' ? { data: [{ b64_json: png }] } : { images: [png] })
      assert.equal((await api.generateImage('next', config(provider))).imageBase64, png)
    }
  }
})
