import { shallowRef, watch } from 'vue'
import type { HistoryViewMode } from '../types'

export function useHistoryPreferences() {
  let savedMode: string | null = null
  let savedGrouping: string | null = null
  try {
    savedMode = localStorage.getItem('historyViewMode')
    savedGrouping = localStorage.getItem('historyGroupBatches')
  } catch { /* storage may be unavailable */ }

  const viewMode = shallowRef<HistoryViewMode>(
    savedMode === 'waterfall' || savedMode === 'list' ? savedMode : 'grid',
  )
  const groupBatches = shallowRef(savedGrouping !== 'false')

  watch(viewMode, (value) => {
    try { localStorage.setItem('historyViewMode', value) } catch { /* ignore */ }
  })
  watch(groupBatches, (value) => {
    try { localStorage.setItem('historyGroupBatches', String(value)) } catch { /* ignore */ }
  })

  return { viewMode, groupBatches }
}
