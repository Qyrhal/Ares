import { describe, it, expect } from 'vitest'
import {
  buildAutoAnswerMessages,
  parseAutoAnswerResponse,
  findRootSessionId,
  formatTeamNotes,
  briefWithTeamNotes,
} from '../../../main/orchestration'

describe('buildAutoAnswerMessages', () => {
  it('includes the parent task, child title, and formatted questions with options', () => {
    const { system, user } = buildAutoAnswerMessages(
      'Build a landing page',
      'Agent 1',
      [{ question: 'Which framework?', header: 'Framework', options: ['React', 'Vue'] }]
    )
    expect(system).toContain('Build a landing page')
    expect(system).toContain('Agent 1')
    expect(user).toContain('[Framework] Which framework? (options: React, Vue)')
  })

  it('omits the options suffix when a question has no options', () => {
    const { user } = buildAutoAnswerMessages('Task', 'Agent 1', [
      { question: 'What color scheme?', header: 'Color' },
    ])
    expect(user).toBe('1. [Color] What color scheme?')
  })
})

describe('parseAutoAnswerResponse', () => {
  const questions = [{ header: 'Framework' }, { header: 'Color' }]

  it('parses a plain JSON object', () => {
    const raw = '{"Framework": "React", "Color": "blue"}'
    expect(parseAutoAnswerResponse(raw, questions)).toEqual({ Framework: 'React', Color: 'blue' })
  })

  it('parses JSON wrapped in a markdown code fence', () => {
    const raw = 'Here you go:\n```json\n{"Framework": "Vue", "Color": "red"}\n```'
    expect(parseAutoAnswerResponse(raw, questions)).toEqual({ Framework: 'Vue', Color: 'red' })
  })

  it('falls back to a truncated raw slice per question when JSON is malformed', () => {
    const raw = 'I think React would work well here, not sure about color.'
    const result = parseAutoAnswerResponse(raw, questions)
    expect(result.Framework).toBe(raw)
    expect(result.Color).toBe(raw)
  })

  it('falls back for a specific question when its header is missing from otherwise-valid JSON', () => {
    const raw = '{"Framework": "React"}'
    const result = parseAutoAnswerResponse(raw, questions)
    expect(result.Framework).toBe('React')
    expect(result.Color).toBe(raw)
  })
})

describe('findRootSessionId', () => {
  const sessions = [
    { id: 'root', parent_id: null },
    { id: 'child', parent_id: 'root' },
    { id: 'grandchild', parent_id: 'child' },
  ]

  it('returns the session itself when it has no parent', () => {
    expect(findRootSessionId(sessions, 'root')).toBe('root')
  })

  it('walks up multiple levels to find the ultimate ancestor', () => {
    expect(findRootSessionId(sessions, 'grandchild')).toBe('root')
  })

  it('returns the session id unchanged if it is not found in the list', () => {
    expect(findRootSessionId(sessions, 'unknown')).toBe('unknown')
  })

  it('does not infinite-loop on a cyclic parent chain', () => {
    const cyclic = [
      { id: 'a', parent_id: 'b' },
      { id: 'b', parent_id: 'a' },
    ]
    expect(() => findRootSessionId(cyclic, 'a')).not.toThrow()
  })
})

describe('formatTeamNotes / briefWithTeamNotes', () => {
  it('formats notes with their author', () => {
    const text = formatTeamNotes([{ from_title: 'Agent 1', note: 'Using Postgres' }])
    expect(text).toBe('[Agent 1] Using Postgres')
  })

  it('returns an empty string for no notes', () => {
    expect(formatTeamNotes([])).toBe('')
  })

  it('leaves the task unchanged when there are no team notes', () => {
    expect(briefWithTeamNotes('Do the thing', [])).toBe('Do the thing')
  })

  it('prepends formatted notes to the task when notes exist', () => {
    const result = briefWithTeamNotes('Do the thing', [{ from_title: 'Agent 1', note: 'Using Postgres' }])
    expect(result).toBe('Team notes so far:\n[Agent 1] Using Postgres\n\n---\n\nDo the thing')
  })
})
