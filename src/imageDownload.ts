import type { GenerationConfig, HistoryEntry, ImageIdentity } from './types'
import { groupHistoryEntries } from './historyGroups'

/** Freeze the local generation time in the name; milliseconds distinguish separate batches. */
export function getImageDownloadName(config: GenerationConfig, timestamp: number, sequence = 1): string {
  const model = config.model.split('/').pop()!.replace(/-image$/, '').replace(/[^a-zA-Z0-9._-]/g, '-')
  const date = new Date(timestamp)
  const pad = (value: number, length = 2) => String(value).padStart(length, '0')
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}${pad(date.getMilliseconds(), 3)}`
  return `banacanvas-${model}-${config.imageSize ?? 'auto'}-${day}-${time}-${sequence}`
}

/** Older entries have no saved name and fall back to their original config and timestamp. */
export function getHistoryImageIdentity(entry: HistoryEntry): ImageIdentity {
  return {
    id: entry.id,
    timestamp: entry.timestamp,
    downloadName: entry.downloadName ?? getImageDownloadName(entry.config, entry.batch?.timestamp ?? entry.timestamp, entry.batch?.sequence),
    ...(entry.batch ? { batch: { ...entry.batch } } : {}),
  }
}

/** Old histories have no batch metadata. Use the same grouping heuristic as the history panel once. */
export function backfillHistoryDownloadNames(entries: readonly HistoryEntry[]): HistoryEntry[] {
  if (entries.every((entry) => entry.downloadName || entry.batch)) return [...entries]
  const updates = new Map<string, HistoryEntry>()
  const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp || b.id.localeCompare(a.id))
  for (const group of groupHistoryEntries(sorted, true)) {
    if (group.entries.length < 2 || group.entries.some((entry) => entry.downloadName || entry.batch)) continue
    const first = group.ordered[0]!
    group.ordered.forEach((entry, index) => {
      updates.set(entry.id, {
        ...entry,
        batch: { id: `legacy:${first.id}`, timestamp: first.timestamp, sequence: index + 1 },
        downloadName: getImageDownloadName(entry.config, first.timestamp, index + 1),
      })
    })
  }
  return entries.map((entry) => updates.get(entry.id) ?? entry)
}
