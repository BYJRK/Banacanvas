import { describe, expect, it } from 'vitest'
import { backfillHistoryDownloadNames, getHistoryImageIdentity, getImageDownloadName } from '../src/imageDownload'
import type { GenerationConfig, HistoryEntry } from '../src/types'

const config: GenerationConfig = { provider: 'openrouter', model: 'google/gemini-3.1-flash-image', imageSize: '2K' }
const timestamp = new Date(2026, 10, 16, 17, 35, 30, 123).getTime()

describe('image download names', () => {
  it('includes a short model name, size tier, fixed local time and sequence', () => {
    expect(getImageDownloadName(config, timestamp, 9))
      .toBe('banacanvas-gemini-3.1-flash-2K-20261116-173530123-9')
  })

  it.each(['512', '1K', '1.5K', '2K', '4K'] as const)('preserves the %s size tier', (imageSize) => {
    expect(getImageDownloadName({ ...config, imageSize }, timestamp)).toContain(`-${imageSize}-`)
  })

  it('preserves model variants and removes unsafe filename characters', () => {
    expect(getImageDownloadName({ ...config, model: 'openai/gpt-image-2.6-flare' }, timestamp)).toContain('-gpt-image-2.6-flare-')
    expect(getImageDownloadName({ ...config, model: 'custom/model:variant?' }, timestamp)).toContain('-model-variant--')
  })

  it('uses auto when no size tier was specified', () => {
    expect(getImageDownloadName({ ...config, imageSize: undefined }, timestamp)).toContain('-auto-')
  })

  it('distinguishes separate batches started within the same second', () => {
    expect(getImageDownloadName(config, timestamp)).not.toBe(getImageDownloadName(config, timestamp + 1))
  })

  it('keeps saved names and derives legacy names from the original history config', () => {
    const entry: HistoryEntry = { id: 'old', timestamp, config, prompt: '', imageBase64: '', imageMimeType: 'image/webp' }
    expect(getHistoryImageIdentity(entry).downloadName).toBe(getImageDownloadName(config, timestamp))
    expect(getHistoryImageIdentity({ ...entry, downloadName: 'saved-name' }).downloadName).toBe('saved-name')
  })

  it('uses saved batch time and sequence when a filename is missing', () => {
    const entry: HistoryEntry = {
      id: 'image', timestamp: timestamp + 120_000, config, prompt: '', imageBase64: '', imageMimeType: 'image/webp',
      batch: { id: 'batch', timestamp, sequence: 3 },
    }
    expect(getHistoryImageIdentity(entry).downloadName).toBe(getImageDownloadName(config, timestamp, 3))
  })

  it('backfills old batches completed seconds apart with a shared time and stable sequences', () => {
    const entries: HistoryEntry[] = [3, 1, 2].map((n) => ({
      id: `old-${n}`, timestamp: timestamp + n * 10_000, config, prompt: 'same', imageBase64: '', imageMimeType: 'image/webp',
    }))
    const restored = backfillHistoryDownloadNames(entries)
    expect(restored.map((entry) => entry.batch?.sequence)).toEqual([3, 1, 2])
    expect(restored.map((entry) => entry.downloadName)).toEqual([3, 1, 2].map((n) => getImageDownloadName(config, timestamp + 10_000, n)))
    expect(backfillHistoryDownloadNames(restored)).toEqual(restored)
    expect(backfillHistoryDownloadNames([...entries].reverse()).map((entry) => entry.downloadName)).toEqual(restored.map((entry) => entry.downloadName).reverse())
    expect(backfillHistoryDownloadNames(restored.slice(0, 1))[0]!.downloadName).toBe(restored[0]!.downloadName)
    expect(entries.every((entry) => !entry.batch && !entry.downloadName)).toBe(true)
  })

  it('preserves saved names and keeps old groups with different prompts separate', () => {
    const entries: HistoryEntry[] = [1, 2].map((n) => ({
      id: `${n}`, timestamp: timestamp + n * 10_000, config, prompt: `${n}`, imageBase64: '', imageMimeType: 'image/webp',
    }))
    expect(backfillHistoryDownloadNames(entries)).toEqual(entries)
    const saved = entries.map((entry) => ({ ...entry, prompt: 'same', downloadName: `saved-${entry.id}` }))
    expect(backfillHistoryDownloadNames(saved)).toEqual(saved)
  })
})
