import { getHistoryInputImages } from './historyImages'
import type { HistoryEntry, HistoryGroup } from './types'

/** Entries generated within this window with identical inputs are treated as one batch. */
export const BATCH_WINDOW_MS = 60_000

/** Whether two history entries look like members of the same batch run. */
export function canGroup(a: HistoryEntry, b: HistoryEntry): boolean {
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
 * Group newest-first history entries into batches. Each entry is compared with the
 * last entry of the current group, so a long run can span more than one window.
 */
export function groupHistoryEntries(entries: readonly HistoryEntry[], groupBatches: boolean): HistoryGroup[] {
  const groups: HistoryGroup[] = []
  for (const entry of entries) {
    const last = groups[groups.length - 1]
    if (groupBatches && last && canGroup(last.entries[last.entries.length - 1], entry)) {
      last.entries.push(entry)
    } else {
      groups.push({ key: entry.id, entries: [entry], ordered: [], representative: entry })
    }
  }
  for (const group of groups) {
    group.ordered = [...group.entries].sort((a, b) => a.timestamp - b.timestamp)
  }
  return groups
}
