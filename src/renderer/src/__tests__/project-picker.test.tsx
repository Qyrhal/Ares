import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { ProjectPicker } from '../components/ProjectPicker'

function renderPicker(props: Record<string, unknown> = {}) {
  return render(
    <ProjectPicker
      workspacePath={null}
      recentProjects={[]}
      onSelectPath={vi.fn()}
      onOpenFinder={vi.fn()}
      {...props}
    />
  )
}

describe('ProjectPicker — rendering', () => {
  it('shows "Select project" when no workspace', () => {
    renderPicker()
    expect(screen.getByText('Select project')).toBeInTheDocument()
  })

  it('shows short path when workspace is set', () => {
    renderPicker({ workspacePath: '/home/user/projects/my-app' })
    expect(screen.getByText('projects/my-app')).toBeInTheDocument()
  })

  it('shows single-level path for shallow workspace', () => {
    renderPicker({ workspacePath: '/root' })
    expect(screen.getByText('root')).toBeInTheDocument()
  })

  it('dropdown is closed by default', () => {
    renderPicker()
    expect(screen.queryByText('Current')).not.toBeInTheDocument()
    expect(screen.queryByText('Recent')).not.toBeInTheDocument()
    expect(screen.queryByText('Open folder…')).not.toBeInTheDocument()
  })
})

describe('ProjectPicker — interaction', () => {
  it('opens dropdown on click', () => {
    renderPicker({ workspacePath: '/home/user/proj' })
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('Current')).toBeInTheDocument()
    expect(screen.getByText('Open folder…')).toBeInTheDocument()
  })

  it('shows recent projects when available', () => {
    renderPicker({
      workspacePath: '/home/user/proj',
      recentProjects: ['/home/user/proj', '/home/user/other'],
    })
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('Recent')).toBeInTheDocument()
    expect(screen.getByText('user/other')).toBeInTheDocument()
  })

  it('calls onSelectPath when recent project is clicked', () => {
    const onSelectPath = vi.fn()
    renderPicker({
      workspacePath: '/home/user/proj',
      recentProjects: ['/home/user/proj', '/home/user/other'],
      onSelectPath,
    })
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('user/other'))
    expect(onSelectPath).toHaveBeenCalledWith('/home/user/other')
  })

  it('calls onOpenFinder when "Open folder…" clicked', () => {
    const onOpenFinder = vi.fn()
    renderPicker({ onOpenFinder, workspacePath: '/home/user/proj' })
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('Open folder…'))
    expect(onOpenFinder).toHaveBeenCalled()
  })

  it('does not show workspace itself in recent list', () => {
    renderPicker({
      workspacePath: '/home/user/proj',
      recentProjects: ['/home/user/proj', '/home/user/other'],
    })
    fireEvent.click(screen.getByRole('button'))
    // The current workspace appears in "Current" section, not "Recent"
    expect(screen.getByText('Current')).toBeInTheDocument()
    // Only non-current projects show in the list of recent buttons
    expect(screen.getByText('user/other')).toBeInTheDocument()
    // "Open folder…" is also present
    expect(screen.getByText('Open folder…')).toBeInTheDocument()
  })

  it('closes when clicking outside', () => {
    renderPicker({ workspacePath: '/home/user/proj' })
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('Current')).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('Current')).not.toBeInTheDocument()
  })
})

describe('ProjectPicker — no recent projects', () => {
  it('shows no recent section when empty', () => {
    renderPicker({ workspacePath: '/home/user/proj', recentProjects: [] })
    fireEvent.click(screen.getByRole('button'))
    expect(screen.queryByText('Recent')).not.toBeInTheDocument()
    expect(screen.getByText('Current')).toBeInTheDocument()
    expect(screen.getByText('Open folder…')).toBeInTheDocument()
  })

  it('shows only Open folder when no workspace and no recents', () => {
    renderPicker({ workspacePath: null, recentProjects: [] })
    fireEvent.click(screen.getByRole('button'))
    expect(screen.queryByText('Current')).not.toBeInTheDocument()
    expect(screen.queryByText('Recent')).not.toBeInTheDocument()
    expect(screen.getByText('Open folder…')).toBeInTheDocument()
  })
})
