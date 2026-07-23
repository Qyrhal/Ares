import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { ProjectPicker } from '../components/ProjectPicker'

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function renderPicker(
  props: Partial<{
    workspacePath: string | null
    recentProjects: string[]
    onSelectPath: (path: string) => void
    onOpenFinder: () => void
  }> = {},
) {
  return render(
    <ProjectPicker
      workspacePath={null}
      recentProjects={[]}
      onSelectPath={vi.fn()}
      onOpenFinder={vi.fn()}
      {...props}
    />,
  )
}

/**
 * The main toggle button is always the FIRST button in the container.
 * After the dropdown opens, "Open folder…" becomes a second button.
 * We use getAllByRole to avoid ambiguity.
 */
function getToggleButton(): HTMLElement {
  return screen.getAllByRole('button')[0]
}

function toggleDropdown() {
  fireEvent.click(getToggleButton())
}

/* ------------------------------------------------------------------ */
/*  1. Renders 'Select project' when workspacePath is null            */
/* ------------------------------------------------------------------ */
describe('ProjectPicker — no workspace', () => {
  it('shows "Select project" when workspacePath is null', () => {
    renderPicker({ workspacePath: null })
    expect(screen.getByText('Select project')).toBeInTheDocument()
  })

  it('dropdown is closed by default', () => {
    renderPicker()
    expect(screen.queryByText('Current')).not.toBeInTheDocument()
    expect(screen.queryByText('Recent')).not.toBeInTheDocument()
    expect(screen.queryByText('Open folder…')).not.toBeInTheDocument()
  })
})

/* ------------------------------------------------------------------ */
/*  2 & 3. Renders current folder name / short path (last 2 segments) */
/* ------------------------------------------------------------------ */
describe('ProjectPicker — workspace path display', () => {
  it('shows short path (last 2 segments) for deep path', () => {
    renderPicker({ workspacePath: '/home/user/projects/my-app' })
    expect(screen.getByText('projects/my-app')).toBeInTheDocument()
  })

  it('shows single segment for shallow path', () => {
    renderPicker({ workspacePath: '/root' })
    expect(screen.getByText('root')).toBeInTheDocument()
  })

  it('shows last two segments of a very deep path', () => {
    renderPicker({ workspacePath: '/a/b/c/d/e/my-project' })
    expect(screen.getByText('e/my-project')).toBeInTheDocument()
  })
})

/* ------------------------------------------------------------------ */
/*  4. Click button opens dropdown                                     */
/* ------------------------------------------------------------------ */
describe('ProjectPicker — dropdown open/close', () => {
  it('opens dropdown on click', () => {
    renderPicker({ workspacePath: '/home/user/proj' })
    toggleDropdown()
    expect(screen.getByText('Current')).toBeInTheDocument()
    expect(screen.getByText('Open folder…')).toBeInTheDocument()
  })

  it('toggles dropdown closed on second click', () => {
    renderPicker({ workspacePath: '/home/user/proj' })
    toggleDropdown() // open
    expect(screen.getByText('Current')).toBeInTheDocument()

    toggleDropdown() // close
    expect(screen.queryByText('Current')).not.toBeInTheDocument()
  })

  it('closes when clicking outside the component', () => {
    renderPicker({ workspacePath: '/home/user/proj' })
    toggleDropdown()
    expect(screen.getByText('Current')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('Current')).not.toBeInTheDocument()
  })
})

/* ------------------------------------------------------------------ */
/*  5. Dropdown shows current project                                  */
/* ------------------------------------------------------------------ */
describe('ProjectPicker — current project in dropdown', () => {
  it('shows "Current" heading and short path when workspace is set', () => {
    renderPicker({ workspacePath: '/home/user/projects/my-app' })
    toggleDropdown()

    expect(screen.getByText('Current')).toBeInTheDocument()
    // The short path appears twice (button + Current section) — use getAllByText
    const matches = screen.getAllByText('projects/my-app')
    expect(matches.length).toBe(2)
  })

  it('does not show "Current" section when workspacePath is null', () => {
    renderPicker({ workspacePath: null })
    toggleDropdown()

    expect(screen.queryByText('Current')).not.toBeInTheDocument()
  })
})

/* ------------------------------------------------------------------ */
/*  6. Dropdown shows recent projects                                  */
/* ------------------------------------------------------------------ */
describe('ProjectPicker — recent projects', () => {
  it('shows "Recent" heading and recent project names', () => {
    renderPicker({
      workspacePath: '/home/user/proj',
      recentProjects: ['/home/user/proj', '/home/user/alpha', '/home/user/beta'],
    })
    toggleDropdown()

    expect(screen.getByText('Recent')).toBeInTheDocument()
    expect(screen.getByText('user/alpha')).toBeInTheDocument()
    expect(screen.getByText('user/beta')).toBeInTheDocument()
  })

  it('hides "Recent" section when no recent projects', () => {
    renderPicker({ workspacePath: '/home/user/proj', recentProjects: [] })
    toggleDropdown()

    expect(screen.queryByText('Recent')).not.toBeInTheDocument()
  })
})

/* ------------------------------------------------------------------ */
/*  7. Filters out current path from recent list                       */
/* ------------------------------------------------------------------ */
describe('ProjectPicker — filtering current from recent', () => {
  it('does not show workspace itself as a recent button', () => {
    renderPicker({
      workspacePath: '/home/user/proj',
      recentProjects: ['/home/user/proj', '/home/user/other'],
    })
    toggleDropdown()

    // "Current" section shows the workspace
    expect(screen.getByText('Current')).toBeInTheDocument()
    // The other project appears in Recent
    expect(screen.getByText('user/other')).toBeInTheDocument()
    // The workspace path (user/proj) appears in button + Current section,
    // but NOT as a clickable recent button.
    // Count occurrences: button label + Current section = 2
    const projMatches = screen.getAllByText('user/proj')
    expect(projMatches.length).toBe(2)
  })

  it('shows no recent section when all recents match current', () => {
    renderPicker({
      workspacePath: '/home/user/proj',
      recentProjects: ['/home/user/proj'],
    })
    toggleDropdown()

    expect(screen.queryByText('Recent')).not.toBeInTheDocument()
    expect(screen.getByText('Current')).toBeInTheDocument()
  })
})

/* ------------------------------------------------------------------ */
/*  8. Click on recent project calls onSelectPath                      */
/* ------------------------------------------------------------------ */
describe('ProjectPicker — onSelectPath callback', () => {
  it('calls onSelectPath with the full path of the clicked recent project', () => {
    const onSelectPath = vi.fn()
    renderPicker({
      workspacePath: '/home/user/proj',
      recentProjects: ['/home/user/proj', '/home/user/other'],
      onSelectPath,
    })
    toggleDropdown()
    fireEvent.click(screen.getByText('user/other'))

    expect(onSelectPath).toHaveBeenCalledTimes(1)
    expect(onSelectPath).toHaveBeenCalledWith('/home/user/other')
  })

  it('closes dropdown after selecting a recent project', () => {
    renderPicker({
      workspacePath: '/home/user/proj',
      recentProjects: ['/home/user/proj', '/home/user/other'],
    })
    toggleDropdown()
    fireEvent.click(screen.getByText('user/other'))

    expect(screen.queryByText('Recent')).not.toBeInTheDocument()
  })
})

/* ------------------------------------------------------------------ */
/*  9. Click on 'Open folder…' calls onOpenFinder                      */
/* ------------------------------------------------------------------ */
describe('ProjectPicker — onOpenFinder callback', () => {
  it('calls onOpenFinder when "Open folder…" is clicked', () => {
    const onOpenFinder = vi.fn()
    renderPicker({ workspacePath: '/home/user/proj', onOpenFinder })
    toggleDropdown()

    fireEvent.click(screen.getByText('Open folder…'))
    expect(onOpenFinder).toHaveBeenCalledTimes(1)
  })

  it('closes dropdown after opening folder', () => {
    renderPicker({ workspacePath: '/home/user/proj' })
    toggleDropdown()
    fireEvent.click(screen.getByText('Open folder…'))

    expect(screen.queryByText('Current')).not.toBeInTheDocument()
  })
})

/* ------------------------------------------------------------------ */
/*  10. Click outside closes dropdown                                  */
/* ------------------------------------------------------------------ */
describe('ProjectPicker — click-outside behavior', () => {
  it('closes on mousedown outside the component', () => {
    renderPicker({ workspacePath: '/home/user/proj' })
    toggleDropdown()
    expect(screen.getByText('Current')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('Current')).not.toBeInTheDocument()
  })

  it('does NOT close when clicking inside the dropdown', () => {
    renderPicker({ workspacePath: '/home/user/proj', recentProjects: [] })
    toggleDropdown()
    expect(screen.getByText('Current')).toBeInTheDocument()

    // Click on the "Current" text — still inside the component
    fireEvent.mouseDown(screen.getByText('Current'))
    expect(screen.getByText('Current')).toBeInTheDocument()
  })
})

/* ------------------------------------------------------------------ */
/*  11. Button shows ChevronDown icon                                  */
/* ------------------------------------------------------------------ */
describe('ProjectPicker — ChevronDown icon', () => {
  it('renders a ChevronDown SVG icon inside the button', () => {
    renderPicker({ workspacePath: '/home/user/proj' })
    const button = getToggleButton()
    const svg = button.querySelector('svg.lucide-chevron-down')
    expect(svg).toBeInTheDocument()
  })

  it('rotates the ChevronDown when dropdown is open', () => {
    renderPicker({ workspacePath: '/home/user/proj' })
    toggleDropdown()

    const button = getToggleButton()
    const svg = button.querySelector('svg.lucide-chevron-down')
    expect(svg).toBeInTheDocument()
    // When open, the icon gets the "rotate-180" class
    expect(svg!.classList.contains('rotate-180')).toBe(true)
  })

  it('removes rotation when dropdown closes', () => {
    renderPicker({ workspacePath: '/home/user/proj' })
    toggleDropdown() // open — should have rotate-180

    toggleDropdown() // close — should NOT have rotate-180

    const button = getToggleButton()
    const svg = button.querySelector('svg.lucide-chevron-down')
    expect(svg).toBeInTheDocument()
    expect(svg!.classList.contains('rotate-180')).toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/*  Edge cases                                                        */
/* ------------------------------------------------------------------ */
describe('ProjectPicker — edge cases', () => {
  it('shows only "Open folder…" when no workspace and no recents', () => {
    renderPicker({ workspacePath: null, recentProjects: [] })
    toggleDropdown()

    expect(screen.queryByText('Current')).not.toBeInTheDocument()
    expect(screen.queryByText('Recent')).not.toBeInTheDocument()
    expect(screen.getByText('Open folder…')).toBeInTheDocument()
  })

  it('handles many recent projects', () => {
    const recents = Array.from({ length: 20 }, (_, i) => `/projects/app-${i}`)
    renderPicker({ workspacePath: '/projects/app-0', recentProjects: recents })
    toggleDropdown()

    // app-0 should not appear in recent buttons — it only appears in
    // the button label and "Current" section (2 occurrences)
    const app0Matches = screen.getAllByText('projects/app-0')
    expect(app0Matches.length).toBe(2)

    // The rest should appear as recent buttons (each appears once in a button)
    expect(screen.getByText('projects/app-1')).toBeInTheDocument()
    expect(screen.getByText('projects/app-19')).toBeInTheDocument()
  })

  it('toggle button is accessible via role', () => {
    renderPicker({ workspacePath: '/home/user/proj' })
    const button = getToggleButton()
    expect(button).toBeEnabled()
    expect(button.tagName).toBe('BUTTON')
  })
})
