import { getHistoryInputImages } from './historyImages'
import type { HistoryEntry, HistoryGroup } from './types'

/** Legacy entries without batch metadata use this time window and identical inputs. */
export const BATCH_WINDOW_MS = 60_000

/** Whether two history entries look like members of the same batch run. */
export function canGroup(a: HistoryEntry, b: HistoryEntry): boolean {
  if (a.batch || b.batch) return !!a.batch && !!b.batch && a.batch.id === b.batch.id
  if (a.prompt !== b.prompt || a.config.model !== b.config.model) return false
  if ((a.config.provider ?? 'gemini') !== (b.config.provider ?? 'gemini')) return false
  if ((a.config.aspectRatio ?? '') !== (b.config.aspectRatio ?? '')) return false
  if ((a.config.imageSize ?? '') !== (b.config.imageSize ?? '')) return false
  if ((a.config.imageQuality ?? '') !== (b.config.imageQuality ?? '')) return false
  if ((a.config.seed ?? null) !== (b.config.seed ?? null)) return false
  const aInputs = getHistoryInputImages(a)
  const bInputs = getHistoryInputImages(b)
  if (aInputs.length !== bInputs.length) return false
  if (aInputs.some((image, index) => image.base64 !== bInputs[index].base64 || image.mimeType !== bInputs[index].mimeType)) return false
  return Math.abs(a.timestamp - b.timestamp) <= BATCH_WINDOW_MS
}

/**
 * Group newest-first history entries by saved batch ID. Legacy entries are compared
 * with the last entry of the current group, so a long run can span multiple windows.
 */
export function groupHistoryEntries(entries: readonly HistoryEntry[], groupBatches: boolean): HistoryGroup[] {
  const groups: HistoryGroup[] = []
  const knownBatches = new Map<string, HistoryGroup>()
  for (const entry of entries) {
    const knownBatch = groupBatches && entry.batch ? knownBatches.get(entry.batch.id) : undefined
    if (knownBatch) {
      knownBatch.entries.push(entry)
      continue
    }
    const last = groups[groups.length - 1]
    if (groupBatches && last && canGroup(last.entries[last.entries.length - 1], entry)) {
      last.entries.push(entry)
    } else {
      const group = { key: entry.id, entries: [entry], ordered: [], representative: entry }
      groups.push(group)
      if (groupBatches && entry.batch) knownBatches.set(entry.batch.id, group)
    }
  }
  for (const group of groups) {
    group.ordered = [...group.entries].sort((a, b) => a.batch && b.batch
      ? a.batch.sequence - b.batch.sequence : a.timestamp - b.timestamp)
  }
  return groups
}
