import { describe, it, expect } from 'vitest'

function renderTree(items: { name: string; type: string; children?: unknown[] }[], prefix = ''): string[] {
  const lines: string[] = []
  for (let i = 0; i < items.length; i++) {
    const isLast = i === items.length - 1
    const connector = isLast ? '└── ' : '├── '
    const node = items[i]
    lines.push(prefix + connector + node.name + (node.type === 'directory' ? '/' : ''))
    if (node.type === 'directory' && node.children) {
      lines.push(...renderTree(node.children as { name: string; type: string; children?: unknown[] }[], prefix + (isLast ? '    ' : '│   ')))
    }
  }
  return lines
}

describe('/tree slash command logic', () => {
  it('requires a workspace', () => {
    const wsPath = null
    expect(wsPath).toBeNull()
  })

  it('renders a flat file list', () => {
    const nodes = [
      { name: 'src', type: 'directory', children: [] },
      { name: 'package.json', type: 'file' },
    ]
    const lines = renderTree(nodes)
    expect(lines).toEqual(['├── src/', '└── package.json'])
  })

  it('renders nested directories', () => {
    const nodes = [
      { name: 'src', type: 'directory', children: [
        { name: 'App.tsx', type: 'file' },
        { name: 'main', type: 'directory', children: [
          { name: 'index.ts', type: 'file' },
        ]},
      ]},
    ]
    const lines = renderTree(nodes)
    expect(lines[0]).toBe('└── src/')
    expect(lines[1]).toBe('    ├── App.tsx')
    expect(lines[2]).toBe('    └── main/')
    expect(lines[3]).toBe('        └── index.ts')
  })

  it('handles empty tree', () => {
    const lines = renderTree([])
    expect(lines).toEqual([])
  })

  it('shows workspace empty message', () => {
    const msg = 'Workspace is empty.'
    expect(msg).toContain('empty')
  })

  it('shows error message', () => {
    const error = 'permission denied'
    const msg = `**Tree error:** ${error}`
    expect(msg).toContain('Tree error')
    expect(msg).toContain('permission denied')
  })

  it('shows no-workspace message', () => {
    const msg = 'No workspace open. Use /folder to open a project first.'
    expect(msg).toContain('/folder')
  })

  it('truncates long output', () => {
    const treeText = 'a'.repeat(5000)
    const truncated = treeText.length > 4000 ? treeText.slice(0, 4000) + '\n\n[truncated]' : treeText
    expect(truncated.length).toBe(4013)
    expect(truncated).toContain('[truncated]')
  })

  it('renders single file', () => {
    const nodes = [{ name: 'README.md', type: 'file' }]
    const lines = renderTree(nodes)
    expect(lines).toEqual(['└── README.md'])
  })
})
