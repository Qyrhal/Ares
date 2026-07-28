import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import App from '../App'
import { useAppStore } from '../store/useAppStore'

// ─── Store-level keyboard shortcut tests ─────────────────────────────────────
// These test the store actions directly without rendering App

describe('Store — terminal toggle', () => {
  it('toggleTerminal toggles terminalOpen', () => {
    useAppStore.setState({ terminalOpen: false })
    useAppStore.getState().toggleTerminal()
    expect(useAppStore.getState().terminalOpen).toBe(true)
    useAppStore.getState().toggleTerminal()
    expect(useAppStore.getState().terminalOpen).toBe(false)
  })
})

describe('Store — zen mode toggle', () => {
  it('toggleZenMode toggles zenMode', () => {
    useAppStore.setState({ zenMode: false })
    useAppStore.getState().toggleZenMode()
    expect(useAppStore.getState().zenMode).toBe(true)
    useAppStore.getState().toggleZenMode()
    expect(useAppStore.getState().zenMode).toBe(false)
  })
})

describe('Store — selectTab', () => {
  it('selectTab sets activeTabId', () => {
    const tabs = [
      { type: 'session' as const, id: 's1', title: 'Tab 1' },
      { type: 'session' as const, id: 's2', title: 'Tab 2' },
    ]
    useAppStore.setState({ tabs, activeTabId: 's1' })
    useAppStore.getState().selectTab('s2')
    expect(useAppStore.getState().activeTabId).toBe('s2')
  })

  it('selectTab cycles correctly with wrap-around', () => {
    const tabs = [
      { type: 'session' as const, id: 's1', title: 'Tab 1' },
      { type: 'session' as const, id: 's2', title: 'Tab 2' },
      { type: 'session' as const, id: 's3', title: 'Tab 3' },
    ]
    useAppStore.setState({ tabs, activeTabId: 's1' })
    // Simulate ] key logic: next = tabs[0+1] = s2
    const idx = tabs.findIndex((t) => t.id === 's1')
    const next = tabs[idx >= tabs.length - 1 ? 0 : idx + 1]
    useAppStore.getState().selectTab(next.id)
    expect(useAppStore.getState().activeTabId).toBe('s2')
    // Simulate ] again: next = tabs[1+1] = s3
    const idx2 = tabs.findIndex((t) => t.id === 's2')
    const next2 = tabs[idx2 >= tabs.length - 1 ? 0 : idx2 + 1]
    useAppStore.getState().selectTab(next2.id)
    expect(useAppStore.getState().activeTabId).toBe('s3')
    // Simulate ] again: wraps to s1
    const idx3 = tabs.findIndex((t) => t.id === 's3')
    const next3 = tabs[idx3 >= tabs.length - 1 ? 0 : idx3 + 1]
    useAppStore.getState().selectTab(next3.id)
    expect(useAppStore.getState().activeTabId).toBe('s1')
  })
})

describe('Store — closeTab', () => {
  it('closeTab removes tab and falls back', () => {
    const tabs = [
      { type: 'session' as const, id: 's1', title: 'Tab 1' },
      { type: 'session' as const, id: 's2', title: 'Tab 2' },
    ]
    useAppStore.setState({ tabs, activeTabId: 's1' })
    useAppStore.getState().closeTab('s1')
    const state = useAppStore.getState()
    expect(state.tabs.find((t) => t.type === 'session' && t.id === 's1')).toBeUndefined()
    expect(state.activeTabId).toBe('s2')
  })

  it('closeTab with last tab removes all tabs', () => {
    const tabs = [{ type: 'session' as const, id: 's1', title: 'Tab 1' }]
    useAppStore.setState({ tabs, activeTabId: 's1' })
    useAppStore.getState().closeTab('s1')
    expect(useAppStore.getState().tabs).toHaveLength(0)
    expect(useAppStore.getState().activeTabId).toBeNull()
  })

  it('closeTab with non-existent id is no-op', () => {
    const tabs = [{ type: 'session' as const, id: 's1', title: 'Tab 1' }]
    useAppStore.setState({ tabs, activeTabId: 's1' })
    useAppStore.getState().closeTab('nonexistent')
    expect(useAppStore.getState().tabs).toHaveLength(1)
  })
})

describe('Store — setLoading', () => {
  it('setLoading sets isLoading', () => {
    useAppStore.setState({ isLoading: false })
    useAppStore.getState().setLoading(true)
    expect(useAppStore.getState().isLoading).toBe(true)
    useAppStore.getState().setLoading(false)
    expect(useAppStore.getState().isLoading).toBe(false)
  })
})

describe('Store — setActiveView', () => {
  it('setActiveView changes active view', () => {
    useAppStore.setState({ activeView: 'chat' })
    useAppStore.getState().setActiveView('settings')
    expect(useAppStore.getState().activeView).toBe('settings')
    useAppStore.getState().setActiveView('git')
    expect(useAppStore.getState().activeView).toBe('git')
  })
})

// ─── Keyboard handler logic (pure function tests) ───────────────────────────

describe('Keyboard shortcut logic', () => {
  function handleShortcut(e: KeyboardEvent, store: ReturnType<typeof useAppStore.getState>): string | null {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return 'guarded'
    if (e.key === 'Escape' && store.isLoading) return 'abort'
    if (e.key === 'Escape' && store.activeTabId) return 'close-tab'
    if (e.ctrlKey && e.key === 'c' && store.isLoading) return 'abort'
    if (!(e.metaKey || e.ctrlKey)) return null
    if (e.shiftKey && e.key === 'P') return 'command-palette'
    if (e.shiftKey && e.key === 'O') return 'tab-switcher'
    if (e.shiftKey && e.key === 'F') return 'session-search'
    if (e.shiftKey && e.key === 'Z') return 'zen-mode'
    if (!e.shiftKey && e.key === 'p') return 'quick-file-open'
    if (e.key === ',') return 'settings'
    if (e.key === 'n' || e.key === 't') return 'new-session'
    if (e.key === 'w') return 'close-tab'
    if (e.key === '`' || e.key === 'j') return 'terminal'
    return null
  }

  it('Cmd+N → new-session', () => {
    const e = new KeyboardEvent('keydown', { key: 'n', metaKey: true, bubbles: true })
    expect(handleShortcut(e, useAppStore.getState())).toBe('new-session')
  })

  it('Ctrl+N → new-session (cross-platform)', () => {
    const e = new KeyboardEvent('keydown', { key: 'n', ctrlKey: true, bubbles: true })
    expect(handleShortcut(e, useAppStore.getState())).toBe('new-session')
  })

  it('Cmd+W → close-tab', () => {
    const e = new KeyboardEvent('keydown', { key: 'w', metaKey: true, bubbles: true })
    expect(handleShortcut(e, { ...useAppStore.getState(), activeTabId: 's1' })).toBe('close-tab')
  })

  it('Cmd+` → terminal', () => {
    const e = new KeyboardEvent('keydown', { key: '`', metaKey: true, bubbles: true })
    expect(handleShortcut(e, useAppStore.getState())).toBe('terminal')
  })

  it('Cmd+J → terminal (alternative key)', () => {
    const e = new KeyboardEvent('keydown', { key: 'j', metaKey: true, bubbles: true })
    expect(handleShortcut(e, useAppStore.getState())).toBe('terminal')
  })

  it('Cmd+, → settings', () => {
    const e = new KeyboardEvent('keydown', { key: ',', metaKey: true, bubbles: true })
    expect(handleShortcut(e, useAppStore.getState())).toBe('settings')
  })

  it('Cmd+Shift+P → command-palette', () => {
    const e = new KeyboardEvent('keydown', { key: 'P', metaKey: true, shiftKey: true, bubbles: true })
    expect(handleShortcut(e, useAppStore.getState())).toBe('command-palette')
  })

  it('Cmd+Shift+O → tab-switcher', () => {
    const e = new KeyboardEvent('keydown', { key: 'O', metaKey: true, shiftKey: true, bubbles: true })
    expect(handleShortcut(e, useAppStore.getState())).toBe('tab-switcher')
  })

  it('Cmd+Shift+F → session-search', () => {
    const e = new KeyboardEvent('keydown', { key: 'F', metaKey: true, shiftKey: true, bubbles: true })
    expect(handleShortcut(e, useAppStore.getState())).toBe('session-search')
  })

  it('Cmd+Shift+Z → zen-mode', () => {
    const e = new KeyboardEvent('keydown', { key: 'Z', metaKey: true, shiftKey: true, bubbles: true })
    expect(handleShortcut(e, useAppStore.getState())).toBe('zen-mode')
  })

  it('Cmd+P → quick-file-open', () => {
    const e = new KeyboardEvent('keydown', { key: 'p', metaKey: true, bubbles: true })
    expect(handleShortcut(e, useAppStore.getState())).toBe('quick-file-open')
  })

  it('Escape when loading → abort', () => {
    const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    expect(handleShortcut(e, { ...useAppStore.getState(), isLoading: true })).toBe('abort')
  })

  it('Escape when active tab → close-tab', () => {
    const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    expect(handleShortcut(e, { ...useAppStore.getState(), activeTabId: 's1' })).toBe('close-tab')
  })

  it('Ctrl+C when loading → abort', () => {
    const e = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true })
    expect(handleShortcut(e, { ...useAppStore.getState(), isLoading: true })).toBe('abort')
  })

  it('input focused → guarded', () => {
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    const e = new KeyboardEvent('keydown', { key: 'n', metaKey: true, bubbles: true })
    Object.defineProperty(e, 'target', { value: textarea })
    expect(handleShortcut(e, useAppStore.getState())).toBe('guarded')
    document.body.removeChild(textarea)
  })

  it('no modifier key → null (no shortcut)', () => {
    const e = new KeyboardEvent('keydown', { key: 'a', bubbles: true })
    expect(handleShortcut(e, useAppStore.getState())).toBeNull()
  })
})

// ─── App renders without crashing ───────────────────────────────────────────

describe('App — renders without crashing', () => {
  it('renders the app', () => {
    const { unmount } = render(<App />)
    expect(document.body).toBeTruthy()
    unmount()
  })
})
