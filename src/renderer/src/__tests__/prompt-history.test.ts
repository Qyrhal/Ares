import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '@/store/useAppStore'

describe('Prompt History', () => {
  beforeEach(() => {
    useAppStore.setState({
      promptHistory: [],
      promptHistoryIdx: -1,
    })
  })

  it('adds prompt to history when sent', () => {
    const { addPromptToHistory } = useAppStore.getState()
    addPromptToHistory('hello world')
    const { promptHistory } = useAppStore.getState()
    expect(promptHistory).toEqual(['hello world'])
  })

  it('does not add empty prompts', () => {
    const { addPromptToHistory } = useAppStore.getState()
    addPromptToHistory('')
    addPromptToHistory('   ')
    expect(useAppStore.getState().promptHistory).toEqual([])
  })

  it('does not duplicate consecutive identical prompts', () => {
    const { addPromptToHistory } = useAppStore.getState()
    addPromptToHistory('same')
    addPromptToHistory('same')
    expect(useAppStore.getState().promptHistory).toEqual(['same'])
  })

  it('navigates up through history', () => {
    const { addPromptToHistory, navigatePromptHistory } = useAppStore.getState()
    addPromptToHistory('first')
    addPromptToHistory('second')
    addPromptToHistory('third')

    let recalled: string | null = null
    recalled = navigatePromptHistory('up')
    expect(recalled).toBe('third')
    recalled = navigatePromptHistory('up')
    expect(recalled).toBe('second')
    recalled = navigatePromptHistory('up')
    expect(recalled).toBe('first')
  })

  it('navigates down back to empty', () => {
    const { addPromptToHistory, navigatePromptHistory } = useAppStore.getState()
    addPromptToHistory('first')
    addPromptToHistory('second')

    navigatePromptHistory('up') // → 'second' (idx 0)
    navigatePromptHistory('up') // → 'first'  (idx 1)
    navigatePromptHistory('down') // → 'second' (idx 0)
    const recalled = navigatePromptHistory('down') // → '' (idx -1)
    expect(recalled).toBe('')
  })

  it('returns null when history is empty', () => {
    const { navigatePromptHistory } = useAppStore.getState()
    const recalled = navigatePromptHistory('up')
    expect(recalled).toBeNull()
  })

  it('caps history at 100 entries', () => {
    const { addPromptToHistory } = useAppStore.getState()
    for (let i = 0; i < 110; i++) {
      addPromptToHistory(`prompt-${i}`)
    }
    expect(useAppStore.getState().promptHistory.length).toBe(100)
    expect(useAppStore.getState().promptHistory[0]).toBe('prompt-109')
  })

  it('resetPromptHistoryIdx resets index to -1', () => {
    const { addPromptToHistory, navigatePromptHistory, resetPromptHistoryIdx } = useAppStore.getState()
    addPromptToHistory('test')
    navigatePromptHistory('up')
    expect(useAppStore.getState().promptHistoryIdx).toBe(0)
    resetPromptHistoryIdx()
    expect(useAppStore.getState().promptHistoryIdx).toBe(-1)
  })
})
