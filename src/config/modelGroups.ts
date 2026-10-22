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
}

/** Group gateway models by author namespace, preserving catalogue order. */
export function groupModelsByAuthor(models: readonly ModelOption[]): ModelGroup[] {
  const groups = new Map<string, ModelGroup>()
  for (const model of models) {
    const author = model.id.includes('/') ? model.id.split('/')[0] : model.id
    let group = groups.get(author)
    if (!group) {
      group = { id: author, name: AUTHOR_NAMES[author] ?? author, models: [] }
      groups.set(author, group)
    }
    group.models.push(model)
  }
  return [...groups.values()]
}
