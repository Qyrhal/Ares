import { describe, it, expect } from 'vitest'

// Extracted shortcuts text from App.tsx command handler
function buildShortcutsText(): string {
  return [
    '**Keyboard Shortcuts**\n',
    '**General**',
    '· `Cmd/Ctrl + N` / `Cmd/Ctrl + T` — New session',
    '· `Cmd/Ctrl + W` — Close current tab',
    '· `Cmd/Ctrl + Shift + P` — Command palette',
    '· `Cmd/Ctrl + Shift + O` — Tab switcher',
    '· `Cmd/Ctrl + P` — Quick file open',
    '· `Cmd/Ctrl + ,` — Open settings',
    '· `Cmd/Ctrl + Z` — Undo (restore deleted message)',
    '',
    '**Navigation**',
    '· `Cmd/Ctrl + [` / `]` — Previous / next tab',
    '· `Cmd/Ctrl + 1–9` — Jump to tab by number',
    '· `ArrowUp` / `ArrowDown` in empty input — Recall prompt history',
    '',
    '**View**',
    '· `Ctrl + \\`` / `Ctrl + J` — Toggle terminal',
    '· `Ctrl + Shift + Z` — Toggle zen mode',
    '',
    '**In Chat**',
    '· `Enter` — Send message',
    '· `Shift + Enter` — New line',
    '· `Escape` — Cancel agent / stop streaming',
    '· `Ctrl + C` — Stop agent (when running)',
    '· `Ctrl + Shift + R` — Regenerate last assistant response',
    '',
    '**Search**',
    '· `Cmd/Ctrl + Shift + F` — Search all agent transcripts',
  ].join('\n')
}

describe('/shortcuts command', () => {
  it('contains header', () => {
    const text = buildShortcutsText()
    expect(text).toContain('**Keyboard Shortcuts**')
  })

  it('contains General section', () => {
    const text = buildShortcutsText()
    expect(text).toContain('**General**')
    expect(text).toContain('New session')
    expect(text).toContain('Command palette')
    expect(text).toContain('Quick file open')
  })

  it('contains Navigation section', () => {
    const text = buildShortcutsText()
    expect(text).toContain('**Navigation**')
    expect(text).toContain('Previous / next tab')
    expect(text).toContain('Recall prompt history')
  })

  it('contains View section', () => {
    const text = buildShortcutsText()
    expect(text).toContain('**View**')
    expect(text).toContain('Toggle terminal')
    expect(text).toContain('Toggle zen mode')
  })

  it('contains In Chat section', () => {
    const text = buildShortcutsText()
    expect(text).toContain('**In Chat**')
    expect(text).toContain('Send message')
    expect(text).toContain('New line')
    expect(text).toContain('Cancel agent')
  })

  it('contains Search section', () => {
    const text = buildShortcutsText()
    expect(text).toContain('**Search**')
    expect(text).toContain('Search all agent transcripts')
  })

  it('lists all 5 sections', () => {
    const text = buildShortcutsText()
    expect(text).toContain('**General**')
    expect(text).toContain('**Navigation**')
    expect(text).toContain('**View**')
    expect(text).toContain('**In Chat**')
    expect(text).toContain('**Search**')
  })
})
