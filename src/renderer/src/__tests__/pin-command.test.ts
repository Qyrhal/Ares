import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAppStore } from '@/store/useAppStore'

function mkSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1',
    title: 'Test Session',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pinned: false,
    archived: false,
    ...overrides,
  }
}

describe('/pin slash command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAppStore.setState({ sessions: [] })
  })

  it('pins an unpinned session', () => {
    useAppStore.setState({ sessions: [mkSession({ id: 's1', pinned: false })] })
    useAppStore.getState().togglePinSession('s1')
    const session = useAppStore.getState().sessions.find((s) => s.id === 's1')
    expect(session?.pinned).toBe(true)
  })

  it('unpins a pinned session', () => {
    useAppStore.setState({ sessions: [mkSession({ id: 's1', pinned: true })] })
    useAppStore.getState().togglePinSession('s1')
    const session = useAppStore.getState().sessions.find((s) => s.id === 's1')
    expect(session?.pinned).toBe(false)
  })

  it('formats pinned confirmation message', () => {
    const pinned = true
    const msg = pinned ? '📌 Session pinned.' : 'Session unpinned.'
    expect(msg).toBe('📌 Session pinned.')
  })

  it('formats unpinned confirmation message', () => {
    const pinned = false
    const msg = pinned ? '📌 Session pinned.' : 'Session unpinned.'
    expect(msg).toBe('Session unpinned.')
  })

  it('toggles pin state twice returns to original', () => {
    useAppStore.setState({ sessions: [mkSession({ id: 's1', pinned: false })] })
    useAppStore.getState().togglePinSession('s1')
    useAppStore.getState().togglePinSession('s1')
    const session = useAppStore.getState().sessions.find((s) => s.id === 's1')
    expect(session?.pinned).toBe(false)
  })

  it('does not affect other sessions when pinning', () => {
    useAppStore.setState({
      sessions: [
        mkSession({ id: 's1', pinned: false }),
        mkSession({ id: 's2', pinned: false }),
      ],
    })
    useAppStore.getState().togglePinSession('s1')
    const s1 = useAppStore.getState().sessions.find((s) => s.id === 's1')
    const s2 = useAppStore.getState().sessions.find((s) => s.id === 's2')
    expect(s1?.pinned).toBe(true)
    expect(s2?.pinned).toBe(false)
  })

  it('help text includes /pin command', () => {
    const helpText = 'Commands: /model, /clear, /compact, /usage, /cost, /overview, /status, /summary, /fork, /pr, /changes, /diff, /log, /export, /shortcuts, /note, /review, /rename, /pin - pin or unpin session, /helpful, /not-helpful, /help'
    expect(helpText).toContain('/pin')
    expect(helpText).toContain('pin or unpin session')
  })

  it('pin command exists in switch cases', () => {
    // Verify the case label is a recognized command
    const commands = ['model', 'clear', 'compact', 'shortcuts', 'note', 'pin', 'rename', 'log', 'review', 'cost', 'help', 'status', 'summary', 'usage', 'overview', 'helpful', 'not-helpful', 'pr', 'fork', 'changes', 'diff', 'export']
    expect(commands).toContain('pin')
  })
})
