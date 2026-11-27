import { describe, expect, it } from 'vitest'
import { getModelsForProvider } from '../../src/config/models'
import { groupModelsByAuthor } from '../../src/config/modelGroups'
import type { ModelOption } from '../../src/types'

describe('groupModelsByAuthor', () => {
  it('includes every OpenRouter model once, merging singleton authors into Other', () => {
    const models = getModelsForProvider('openrouter')
    const groups = groupModelsByAuthor(models)
    expect(groups.map((group) => group.name)).toEqual(['Google', 'xAI', 'ByteDance', 'Sourceful', 'Qwen', 'Microsoft', 'OpenAI', 'Other'])
    expect(groups.flatMap((group) => group.models).length).toBe(models.length)
    for (const group of groups) {
      if (group.id === 'other') {
        expect(group.models.map((m) => m.id)).toEqual(['meta/muse-image', 'recraft/recraft-v4.1-flash-v2'])
      } else {
        expect(group.models).toEqual(models.filter((model) => model.id.startsWith(`${group.id}/`)))
      }
    }
  })

  it('merges 2+ singleton authors into Other while keeping a lone singleton unmerged', () => {
    const model = (id: string): ModelOption => ({ id, name: id, description: '', provider: 'vercel' })
    const models = [model('alpha/one'), model('beta/one'), model('gamma/one'), model('alpha/two')]
    expect(groupModelsByAuthor(models, '其他')).toEqual([
      { id: 'alpha', name: 'alpha', models: [models[0], models[3]] },
      { id: 'other', name: '其他', models: [models[1], models[2]] },
    ])
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
