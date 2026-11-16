import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, type App } from 'vue'
import ImageDisplay from '../../src/components/ImageDisplay.vue'
import type { BatchResultItem, DownloadFormat, ImageIdentity } from '../../src/types'
import { en } from '../helpers'

let app: App | undefined
let host: HTMLDivElement
const identity: ImageIdentity = { id: 'image-one', timestamp: 123, downloadName: 'banacanvas-gemini-3.1-flash-2K-20261116-173530123-1' }

function mount(downloadFormat: DownloadFormat = 'png', batchResults?: BatchResultItem[]) {
  host = document.createElement('div')
  document.body.append(host)
  app = createApp({ setup: () => () => h(ImageDisplay, {
    imageBase64: btoa('image'),
    imageMimeType: 'image/png',
    imageIdentity: identity,
    downloadFormat,
    batchResults,
    canAddReference: true,
    referenceLimit: 14,
  }) })
  app.mount(host)
  return [...host.querySelectorAll<HTMLButtonElement>('button')]
    .filter((button) => button.title === en.download)
}

afterEach(() => {
  app?.unmount()
  host?.remove()
})

describe('download filenames', () => {
  it('uses the same generation identity when downloaded at different times', () => {
    const names: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download)
    })
    const now = vi.spyOn(Date, 'now').mockReturnValue(1000)
    const [download] = mount()

    download!.click()
    now.mockReturnValue(2000)
    download!.click()

    expect(names).toEqual([`${identity.downloadName}.png`, `${identity.downloadName}.png`])
  })

  it.each([
    ['image/webp', 'webp'],
    ['image/png', 'png'],
  ])('keeps identity after conversion and uses the actual %s extension', async (mimeType, extension) => {
    const names: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download)
    })
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 1, height: 1, close: vi.fn() }))
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(new Blob(['converted'], { type: mimeType }))
    })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:download')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const now = vi.spyOn(Date, 'now').mockReturnValue(1000)
    const [download] = mount('webp')

    download!.click()
    await vi.waitFor(() => expect(names).toHaveLength(1))
    now.mockReturnValue(2000)
    download!.click()
    await vi.waitFor(() => expect(names).toHaveLength(2))

    expect(names).toEqual(Array(2).fill(`${identity.downloadName}.${extension}`))
  })

  it('distinguishes batch images completed in the same millisecond', () => {
    const names: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download)
    })
    const downloads = mount('png', ['first', 'second'].map((id, index) => ({
      imageBase64: btoa(id), imageMimeType: 'image/png',
      identity: { id, timestamp: 123, downloadName: identity.downloadName!.replace(/-1$/, `-${index + 1}`) },
    })))

    downloads[0]!.click()
    downloads[1]!.click()
    downloads[0]!.click()

    expect(names).toEqual([
      `${identity.downloadName}.png`,
      `${identity.downloadName!.replace(/-1$/, '-2')}.png`,
      `${identity.downloadName}.png`,
    ])
  })
})
