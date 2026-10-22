import { describe, expect, it } from 'vitest'
import { getModelsForProvider } from '../../src/config/models'
import { groupModelsByAuthor } from '../../src/config/modelGroups'
import type { ModelOption } from '../../src/types'

describe('groupModelsByAuthor', () => {
  it('includes every OpenRouter model once, preserving catalogue order within each author', () => {
    const models = getModelsForProvider('openrouter')
    const groups = groupModelsByAuthor(models)
    expect(groups.map((group) => group.name)).toEqual(['Google', 'xAI', 'ByteDance', 'Sourceful', 'Meta', 'Qwen', 'Microsoft', 'OpenAI'])
    expect(groups.flatMap((group) => group.models).length).toBe(models.length)
    for (const group of groups) {
      expect(group.models).toEqual(models.filter((model) => model.id.startsWith(`${group.id}/`)))
    }
  })

  it('automatically groups future namespaces and keeps unprefixed models usable', () => {
    const model = (id: string): ModelOption => ({ id, name: id, description: '', provider: 'openrouter' })
    const models = [model('new-author/first'), model('standalone'), model('new-author/second')]
    expect(groupModelsByAuthor(models)).toEqual([
      { id: 'new-author', name: 'new-author', models: [models[0], models[2]] },
      { id: 'standalone', name: 'standalone', models: [models[1]] },
    ])
    expect(groupModelsByAuthor([])).toEqual([])
  })
})
