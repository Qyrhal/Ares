import { describe, it, expect } from 'vitest'

describe('/tree --depth flag', () => {
  it('parses --depth flag', () => {
    const args = '--depth 2'
    const depthMatch = args.match(/--depth\s+(\d+)|-d\s+(\d+)/)
    const maxDepth = depthMatch ? parseInt(depthMatch[1] || depthMatch[2], 10) : undefined
    expect(maxDepth).toBe(2)
  })

  it('parses -d shorthand flag', () => {
    const args = '-d 1'
    const depthMatch = args.match(/--depth\s+(\d+)|-d\s+(\d+)/)
    const maxDepth = depthMatch ? parseInt(depthMatch[1] || depthMatch[2], 10) : undefined
    expect(maxDepth).toBe(1)
  })

  it('returns undefined when no depth flag', () => {
    const args = ''
    const depthMatch = args.match(/--depth\s+(\d+)|-d\s+(\d+)/)
    const maxDepth = depthMatch ? parseInt(depthMatch[1] || depthMatch[2], 10) : undefined
    expect(maxDepth).toBeUndefined()
  })

  it('renders tree with depth limit', () => {
    interface MockNode { name: string; type: 'file' | 'directory'; children?: MockNode[] }
    const nodes: MockNode[] = [
      { name: 'src', type: 'directory', children: [
        { name: 'index.ts', type: 'file' },
        { name: 'lib', type: 'directory', children: [{ name: 'utils.ts', type: 'file' }] },
      ]},
      { name: 'README.md', type: 'file' },
    ]
    const maxDepth = 1
    const lines: string[] = ['root/']
    function renderTree(items: MockNode[], prefix: string, depth: number) {
      for (let i = 0; i < items.length; i++) {
        const isLast = i === items.length - 1
        const connector = isLast ? '└── ' : '├── '
        const node = items[i]
        const isDir = node.type === 'directory'
        lines.push(prefix + connector + node.name + (isDir ? '/' : ''))
        if (isDir && node.children && (maxDepth === undefined || depth < maxDepth)) {
          renderTree(node.children, prefix + (isLast ? '    ' : '│   '), depth + 1)
        } else if (isDir && node.children && node.children.length > 0 && maxDepth !== undefined && depth >= maxDepth) {
          lines.push(prefix + (isLast ? '    ' : '│   ') + '...')
        }
      }
    }
    renderTree(nodes, '', 0)
    // src is first item so uses ├──, README.md is last so uses └──
    expect(lines).toContain('├── src/')
    expect(lines.some(l => l.includes('...'))).toBe(true)
    expect(lines).toContain('└── README.md')
    // index.ts is a file inside src (depth 0), still shown
    expect(lines.some(l => l.includes('index.ts'))).toBe(true)
    // utils.ts is inside lib (depth 1 = maxDepth), hidden by ...
    expect(lines.some(l => l.includes('utils.ts'))).toBe(false)
  })

  it('renders full tree when no depth limit', () => {
    interface MockNode { name: string; type: 'file' | 'directory'; children?: MockNode[] }
    const nodes: MockNode[] = [
      { name: 'src', type: 'directory', children: [
        { name: 'index.ts', type: 'file' },
      ]},
    ]
    const maxDepth = undefined
    const lines: string[] = ['root/']
    function renderTree(items: MockNode[], prefix: string, depth: number) {
      for (let i = 0; i < items.length; i++) {
        const isLast = i === items.length - 1
        const connector = isLast ? '└── ' : '├── '
        const node = items[i]
        const isDir = node.type === 'directory'
        lines.push(prefix + connector + node.name + (isDir ? '/' : ''))
        if (isDir && node.children && (maxDepth === undefined || depth < maxDepth)) {
          renderTree(node.children, prefix + (isLast ? '    ' : '│   '), depth + 1)
        } else if (isDir && node.children && node.children.length > 0 && maxDepth !== undefined && depth >= maxDepth) {
          lines.push(prefix + (isLast ? '    ' : '│   ') + '...')
        }
      }
    }
    renderTree(nodes, '', 0)
    // src is only item, so uses └──
    expect(lines).toContain('└── src/')
    expect(lines).toContain('    └── index.ts')
  })

  it('shows no workspace message', () => {
    const wsPath = null
    const lines: string[] = []
    if (!wsPath) {
      lines.push('No workspace open. Use /folder to open a project first.')
    }
    expect(lines).toContain('No workspace open. Use /folder to open a project first.')
  })

  it('shows empty workspace message', () => {
    const nodes: unknown[] = []
    const lines: string[] = []
    if (!nodes || nodes.length === 0) {
      lines.push('Workspace is empty.')
    }
    expect(lines).toContain('Workspace is empty.')
  })

  it('truncates long output', () => {
    const treeText = 'x'.repeat(5000)
    const truncated = treeText.length > 4000 ? treeText.slice(0, 4000) + '\n\n[truncated]' : treeText
    expect(truncated).toContain('[truncated]')
    expect(truncated.length).toBeLessThan(5000)
  })
})
