import { describe, expect, it } from 'vitest'
import { BATCH_WINDOW_MS, canGroup, groupHistoryEntries } from '../src/historyGroups'
import type { HistoryEntry } from '../src/types'

let seq = 0
function entry(timestamp: number, overrides: Partial<HistoryEntry> = {}, config: Partial<HistoryEntry['config']> = {}): HistoryEntry {
  return {
    id: `e${++seq}`,
    timestamp,
    prompt: 'a cat',
    imageBase64: 'img',
    imageMimeType: 'image/webp',
    inputImages: [],
    ...overrides,
    config: { provider: 'gemini', model: 'gemini-3.1-flash-image', aspectRatio: '1:1', imageSize: '1K', ...config },
  }
}

const ids = (groups: ReturnType<typeof groupHistoryEntries>) => groups.map((g) => g.entries.map((e) => e.id))

describe('canGroup', () => {
  it('groups identical requests within the batch window', () => {
    expect(canGroup(entry(0), entry(BATCH_WINDOW_MS))).toBe(true)
    expect(canGroup(entry(BATCH_WINDOW_MS), entry(0))).toBe(true)
  })

  it('does not group requests further apart than the window', () => {
    expect(canGroup(entry(0), entry(BATCH_WINDOW_MS + 1))).toBe(false)
  })

  it.each([
    ['prompt', { prompt: 'a dog' }, {}],
    ['model', {}, { model: 'gemini-3-pro-image' }],
    ['provider', {}, { provider: 'vercel' as const }],
    ['aspect ratio', {}, { aspectRatio: '16:9' }],
    ['image size', {}, { imageSize: '2K' as const }],
    ['image quality', {}, { imageQuality: 'high' as const }],
    ['seed', {}, { seed: 1 }],
  ])('keeps entries with a different %s apart', (_name, overrides, config) => {
    expect(canGroup(entry(0), entry(1, overrides, config))).toBe(false)
  })

  it('ignores settings that do not affect batching', () => {
    expect(canGroup(entry(0), entry(1, {}, { thinkingLevel: 'HIGH', batchSize: 4 }))).toBe(true)
  })

  it('treats a missing provider as Gemini', () => {
    expect(canGroup(entry(0), entry(1, {}, { provider: undefined }))).toBe(true)
  })

  it('compares reference images by count, content and type', () => {
    const ref = { base64: 'ref', mimeType: 'image/png' }
    expect(canGroup(entry(0, { inputImages: [ref] }), entry(1, { inputImages: [{ ...ref }] }))).toBe(true)
    expect(canGroup(entry(0, { inputImages: [ref] }), entry(1, { inputImages: [] }))).toBe(false)
    expect(canGroup(entry(0, { inputImages: [ref] }), entry(1, { inputImages: [{ ...ref, base64: 'other' }] }))).toBe(false)
    expect(canGroup(entry(0, { inputImages: [ref] }), entry(1, { inputImages: [{ ...ref, mimeType: 'image/jpeg' }] }))).toBe(false)
  })

  it('matches legacy single-reference entries with the new format', () => {
    const legacy = entry(0, { inputImages: undefined, inputImageBase64: 'ref', inputImageMimeType: 'image/png' })
    expect(canGroup(legacy, entry(1, { inputImages: [{ base64: 'ref', mimeType: 'image/png' }] }))).toBe(true)
  })
})

describe('groupHistoryEntries', () => {
  it('groups consecutive matching entries and keeps others separate', () => {
    const entries = [entry(5_000), entry(4_000), entry(3_000, { prompt: 'other' }), entry(2_000), entry(1_000)]

    expect(ids(groupHistoryEntries(entries, true))).toEqual([
      [entries[0].id, entries[1].id],
      [entries[2].id],
      [entries[3].id, entries[4].id],
    ])
  })

  it('does not merge matching entries separated by a different one', () => {
    const entries = [entry(3_000), entry(2_000, { prompt: 'other' }), entry(1_000)]

    expect(groupHistoryEntries(entries, true)).toHaveLength(3)
  })

  it('chains entries so a long run can exceed one window', () => {
    const step = BATCH_WINDOW_MS - 1
    const entries = [entry(step * 2), entry(step), entry(0)]

    expect(ids(groupHistoryEntries(entries, true))).toEqual([entries.map((e) => e.id)])
  })

  it('leaves every entry on its own when grouping is off', () => {
    const entries = [entry(2_000), entry(1_000)]

    expect(ids(groupHistoryEntries(entries, false))).toEqual([[entries[0].id], [entries[1].id]])
  })

  it('uses the newest entry as key/representative and orders members oldest first', () => {
    const entries = [entry(3_000), entry(2_000), entry(1_000)]

    const [group] = groupHistoryEntries(entries, true)

    expect(group.key).toBe(entries[0].id)
    expect(group.representative).toBe(entries[0])
    expect(group.entries).toEqual(entries)
    expect(group.ordered.map((e) => e.timestamp)).toEqual([1_000, 2_000, 3_000])
  })

  it('does not mutate the input array', () => {
    const entries = [entry(2_000), entry(1_000)]
    const copy = [...entries]

    groupHistoryEntries(entries, true)

    expect(entries).toEqual(copy)
  })

  it('returns no groups for an empty history', () => {
    expect(groupHistoryEntries([], true)).toEqual([])
  })
})
