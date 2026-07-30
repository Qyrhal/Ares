import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '../store/useAppStore'

describe('sidebarVisible store state', () => {
  beforeEach(() => {
    useAppStore.setState({
      sidebarVisible: true,
    })
  })

  it('defaults sidebarVisible to true', () => {
    const state = useAppStore.getState()
    expect(state.sidebarVisible).toBe(true)
  })

  it('toggleSidebar toggles the value from true to false', () => {
    useAppStore.getState().toggleSidebar()
    expect(useAppStore.getState().sidebarVisible).toBe(false)
  })

  it('toggleSidebar toggles the value from false to true', () => {
    useAppStore.setState({ sidebarVisible: false })
    useAppStore.getState().toggleSidebar()
    expect(useAppStore.getState().sidebarVisible).toBe(true)
  })

  it('toggleSidebar toggles back and forth', () => {
    expect(useAppStore.getState().sidebarVisible).toBe(true)
    useAppStore.getState().toggleSidebar()
    expect(useAppStore.getState().sidebarVisible).toBe(false)
    useAppStore.getState().toggleSidebar()
    expect(useAppStore.getState().sidebarVisible).toBe(true)
    useAppStore.getState().toggleSidebar()
    expect(useAppStore.getState().sidebarVisible).toBe(false)
  })
})
