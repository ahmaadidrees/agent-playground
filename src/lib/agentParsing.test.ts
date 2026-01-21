import { describe, expect, it } from 'vitest'
import { extractFeaturePlanFromText } from './agentParsing'

describe('extractFeaturePlanFromText', () => {
  it('parses a JSON feature plan', () => {
    const input = JSON.stringify({
      featureTitle: 'Feature Alpha',
      subtasks: [{ title: 'First step' }, { title: 'Second step', status: 'doing' }],
    })
    expect(extractFeaturePlanFromText(input)).toEqual({
      featureTitle: 'Feature Alpha',
      subtasks: [{ title: 'First step', status: undefined }, { title: 'Second step', status: 'doing' }],
    })
  })

  it('extracts JSON from surrounding text', () => {
    const input = 'Plan:\n{\"featureTitle\":\"Ship it\",\"subtasks\":[{\"title\":\"Build\"},{\"title\":\"Review\",\"status\":\"done\"}]}\nThanks!'
    expect(extractFeaturePlanFromText(input)).toEqual({
      featureTitle: 'Ship it',
      subtasks: [{ title: 'Build', status: undefined }, { title: 'Review', status: 'done' }],
    })
  })

  it('filters invalid entries', () => {
    const input = JSON.stringify({ featureTitle: 'Plan', subtasks: [{ nope: true }, { title: '' }, { title: 'Valid' }] })
    expect(extractFeaturePlanFromText(input)).toEqual({ featureTitle: 'Plan', subtasks: [{ title: 'Valid', status: undefined }] })
  })

  it('returns null when no JSON object is found', () => {
    expect(extractFeaturePlanFromText('no plan here')).toBeNull()
  })
})
