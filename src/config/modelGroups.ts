import type { ModelGroup, ModelOption } from '../types'

const AUTHOR_NAMES: Record<string, string> = {
  google: 'Google',
  'x-ai': 'xAI',
  'bytedance-seed': 'ByteDance',
  sourceful: 'Sourceful',
  meta: 'Meta',
  qwen: 'Qwen',
  microsoft: 'Microsoft',
  openai: 'OpenAI',
  minimax: 'MiniMax',
}

export function getModelAuthor(modelId: string): { id: string; name: string } {
  const id = modelId.includes('/') ? modelId.split('/')[0] : modelId.startsWith('gemini-') ? 'google' : modelId
  return { id, name: AUTHOR_NAMES[id] ?? id }
}

/** Group gateway models by author namespace, preserving catalogue order. */
export function groupModelsByAuthor(models: readonly ModelOption[]): ModelGroup[] {
  const groups = new Map<string, ModelGroup>()
  for (const model of models) {
    const { id: author, name } = getModelAuthor(model.id)
    let group = groups.get(author)
    if (!group) {
      group = { id: author, name, models: [] }
      groups.set(author, group)
    }
    group.models.push(model)
  }
  return [...groups.values()]
}
