import { describe, expect, it } from 'vitest'
import { extractTasksFromText } from './agentParsing'

describe('extractTasksFromText', () => {
  it('parses a plain JSON array', () => {
    const input = JSON.stringify([{ title: 'First task' }, { title: 'Second task' }])
    expect(extractTasksFromText(input)).toEqual([
      { title: 'First task' },
      { title: 'Second task' },
    ])
  })

  it('extracts JSON from surrounding text', () => {
    const input = 'Here is the list:\n[{\"title\":\"Ship it\"},{\"title\":\"Review\"}]\nThanks!'
    expect(extractTasksFromText(input)).toEqual([{ title: 'Ship it' }, { title: 'Review' }])
  })

  it('filters invalid entries', () => {
    const input = JSON.stringify([{ nope: true }, { title: '' }, { title: 'Valid' }])
    expect(extractTasksFromText(input)).toEqual([{ title: 'Valid' }])
  })

  it('returns empty array when no JSON array is found', () => {
    expect(extractTasksFromText('no tasks here')).toEqual([])
  })
})
