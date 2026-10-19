import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, nextTick, ref } from 'vue'
import { useReferenceImageResize } from '../../src/composables/useReferenceImageResize'
import type { InputImage } from '../../src/types'
import { en } from '../helpers'

/** Decoded size per base64 payload; payloads not listed fail to decode. */
const imageSizes = new Map<string, [number, number]>()

class FakeImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  naturalWidth = 0
  naturalHeight = 0
  #src = ''

  get src() { return this.#src }
  set src(value: string) {
    this.#src = value
    if (!value) return
    const data = value.slice(value.indexOf(',') + 1)
    setTimeout(() => {
      const size = imageSizes.get(data)
      if (!size) return this.onerror?.()
      ;[this.naturalWidth, this.naturalHeight] = size
      this.onload?.()
    }, 0)
  }
}

const RESIZED = 'resized-bytes'
const drawImage = vi.fn()
const toBlob = vi.fn()

function image(id: string, width: number, height: number, mimeType = 'image/jpeg'): InputImage {
  const base64 = btoa(`${id}-${width}x${height}`)
  imageSizes.set(base64, [width, height])
  return { id, base64, mimeType }
}

function setup(initial: InputImage[] = []) {
  const images = ref<InputImage[]>(initial)
  const onError = vi.fn()
  let api!: ReturnType<typeof useReferenceImageResize>
  const app = createApp(defineComponent({
    setup() {
      api = useReferenceImageResize(images, onError)
      return () => null
    },
  }))
  app.mount(document.createElement('div'))
  const add = (...added: InputImage[]) => { images.value = [...images.value, ...added] }
  const idle = () => vi.waitFor(() => expect(api.busy.value).toBe(false))
  const awaitRequest = (id: string) => vi.waitFor(() => expect(api.request.value?.id).toBe(id))
  return { images, onError, api, add, idle, awaitRequest, unmount: () => app.unmount() }
}

beforeEach(() => {
  imageSizes.clear()
  localStorage.removeItem('banacanvas-resize-as-png')
  vi.stubGlobal('Image', FakeImage)
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0))
  drawImage.mockReset()
  toBlob.mockReset().mockImplementation((callback: BlobCallback, type?: string) => callback(new Blob([RESIZED], { type })))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(toBlob)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('size check', () => {
  it('leaves images within 2000px untouched without asking', async () => {
    const { api, add, idle, images } = setup()
    const small = image('a', 2000, 1200)

    add(small)
    expect(api.busy.value).toBe(true)
    await idle()

    expect(api.request.value).toBeNull()
    expect(images.value).toEqual([small])
  })

  it('asks before resizing a large image, with the scaled target size', async () => {
    const { api, add, awaitRequest } = setup()

    add(image('a', 4000, 3000))
    await awaitRequest('a')

    expect(api.request.value).toEqual({ id: 'a', width: 4000, height: 3000, targetWidth: 2000, targetHeight: 1500 })
    expect(api.busy.value).toBe(true)
  })

  it('scales by the longest side', async () => {
    const { api, add, awaitRequest } = setup()

    add(image('tall', 1000, 5000))
    await awaitRequest('tall')

    expect(api.request.value).toMatchObject({ targetWidth: 400, targetHeight: 2000 })
  })

  it('ignores unsupported formats', async () => {
    const { api, add, images } = setup()
    const gif = image('g', 5000, 5000, 'image/gif')

    add(gif)
    await nextTick()

    expect(api.busy.value).toBe(false)
    expect(api.request.value).toBeNull()
    expect(images.value).toEqual([gif])
  })

  it('does not re-check images that were already present', async () => {
    const big = image('a', 4000, 4000)
    const { api, add, idle } = setup([big])

    add(image('b', 100, 100))
    await idle()

    expect(api.request.value).toBeNull()
  })
})

describe('resizing', () => {
  it('replaces the image with the resized version when accepted', async () => {
    const { api, add, awaitRequest, idle, images } = setup()
    let markedWhileDrawing = false
    drawImage.mockImplementation(() => { markedWhileDrawing = api.resizingIds.value.has('a') })

    add(image('a', 4000, 3000))
    await awaitRequest('a')
    api.decide(true)
    await idle()

    expect(markedWhileDrawing).toBe(true)
    expect(api.request.value).toBeNull()
    expect(drawImage).toHaveBeenCalledWith(expect.any(FakeImage), 0, 0, 2000, 1500)
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.92)
    expect(images.value).toEqual([{ id: 'a', base64: btoa(RESIZED), mimeType: 'image/jpeg' }])
    expect(api.resizingIds.value.size).toBe(0)
  })

  it('outputs PNG when the preference is on', async () => {
    const { api, add, awaitRequest, idle, images } = setup()
    api.resizeAsPng.value = true

    add(image('a', 4000, 3000))
    await awaitRequest('a')
    api.decide(true)
    await idle()

    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png', 0.92)
    expect(images.value[0].mimeType).toBe('image/png')
  })

  it('keeps the original when declined', async () => {
    const { api, add, awaitRequest, idle, images } = setup()
    const big = image('a', 4000, 3000)

    add(big)
    await awaitRequest('a')
    api.decide(false)
    await idle()

    expect(drawImage).not.toHaveBeenCalled()
    expect(images.value).toEqual([big])
  })

  it('asks about queued images one at a time', async () => {
    const { api, add, awaitRequest, idle } = setup()

    add(image('a', 3000, 3000), image('b', 3000, 3000))
    await awaitRequest('a')
    api.decide(false)
    await awaitRequest('b')
    expect(api.busy.value).toBe(true)
    api.decide(false)
    await idle()
  })

  it('only updates the resized image', async () => {
    const small = image('s', 100, 100)
    const { api, add, awaitRequest, idle, images } = setup([small])

    add(image('a', 4000, 3000))
    await awaitRequest('a')
    api.decide(true)
    await idle()

    expect(images.value[0]).toEqual(small)
    expect(images.value[1].base64).toBe(btoa(RESIZED))
  })
})

describe('removal and restore', () => {
  it('cancels the pending question when the image is removed', async () => {
    const { api, add, awaitRequest, idle, images, onError } = setup()

    add(image('a', 4000, 3000))
    await awaitRequest('a')
    images.value = []

    expect(api.request.value).toBeNull()
    await idle()
    expect(drawImage).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it('skips images removed while waiting in the queue', async () => {
    const { api, add, awaitRequest, idle, images } = setup()

    add(image('a', 3000, 3000), image('b', 3000, 3000))
    await awaitRequest('a')
    images.value = images.value.filter((img) => img.id !== 'b')
    api.decide(false)
    await idle()

    expect(api.request.value).toBeNull()
  })

  it('does not process images restored from history and cancels any pending question', async () => {
    const { api, add, awaitRequest, idle, images } = setup()
    add(image('a', 4000, 3000))
    await awaitRequest('a')

    const restored = [image('h1', 5000, 5000), image('h2', 100, 100)]
    api.restoreImages(restored)
    await idle()

    expect(api.request.value).toBeNull()
    expect(images.value).toEqual(restored)
    expect(drawImage).not.toHaveBeenCalled()
  })

  it('still checks images added after a restore', async () => {
    const { api, add, awaitRequest } = setup()
    api.restoreImages([image('h1', 5000, 5000)])

    add(image('new', 4000, 3000))

    await awaitRequest('new')
  })

  it('stops quietly when unmounted mid-question', async () => {
    const { api, add, awaitRequest, idle, images, onError, unmount } = setup()
    const big = image('a', 4000, 3000)
    add(big)
    await awaitRequest('a')

    unmount()

    expect(api.request.value).toBeNull()
    await idle()
    expect(images.value).toEqual([big])
    expect(onError).not.toHaveBeenCalled()
  })
})

describe('errors', () => {
  it('reports images that cannot be decoded', async () => {
    const { add, idle, onError } = setup()

    add({ id: 'broken', base64: btoa('not an image'), mimeType: 'image/png' })
    await idle()

    expect(onError).toHaveBeenCalledWith(en.referenceImageDecodeFailed)
  })

  it('reports a failed encode and keeps the original', async () => {
    toBlob.mockImplementation((callback: BlobCallback) => callback(null))
    const { api, add, awaitRequest, idle, images, onError } = setup()
    const big = image('a', 4000, 3000)

    add(big)
    await awaitRequest('a')
    api.decide(true)
    await idle()

    expect(onError).toHaveBeenCalledWith(en.referenceImageResizeFailed)
    expect(images.value).toEqual([big])
    expect(api.resizingIds.value.size).toBe(0)
  })

  it('reports a missing canvas context', async () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null)
    const { api, add, awaitRequest, idle, onError } = setup()

    add(image('a', 4000, 3000))
    await awaitRequest('a')
    api.decide(true)
    await idle()

    expect(onError).toHaveBeenCalledWith(en.referenceImageResizeFailed)
  })

  it('keeps processing the queue after an error', async () => {
    const { add, awaitRequest, onError } = setup()

    add({ id: 'broken', base64: btoa('nope'), mimeType: 'image/png' }, image('b', 4000, 3000))

    await awaitRequest('b')
    expect(onError).toHaveBeenCalledTimes(1)
  })
})

describe('PNG preference', () => {
  it('loads the stored preference', () => {
    localStorage.setItem('banacanvas-resize-as-png', 'true')

    expect(setup().api.resizeAsPng.value).toBe(true)
  })

  it('saves changes', async () => {
    const { api } = setup()

    api.resizeAsPng.value = true
    await nextTick()

    expect(localStorage.getItem('banacanvas-resize-as-png')).toBe('true')
  })
})
