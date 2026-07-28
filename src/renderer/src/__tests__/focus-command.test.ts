import { describe, it, expect } from 'vitest'

// ── helpers extracted from App.tsx /focus command handler logic ──────

interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

function findFileNode(nodes: FileNode[], path: string): FileNode | null {
  for (const n of nodes) {
    if (n.path === path) return n
    if (n.children) {
      const found = findFileNode(n.children, path)
      if (found) return found
    }
  }
  return null
}

function collectFiles(nodes: FileNode[]): FileNode[] {
  const result: FileNode[] = []
  for (const n of nodes) {
    if (n.type === 'file') result.push(n)
    if (n.children) result.push(...collectFiles(n.children))
  }
  return result
}

/**
 * Simulates the /focus command dispatch logic from App.tsx.
 * Pure function — no React, no DOM.
 */
async function handleFocus(
  workspacePath: string | null,
  fileNodes: FileNode[],
  args: string,
  openFileTabFn: (node: FileNode) => void,
): Promise<{ kind: 'msg'; content: string }[]> {
  const results: { kind: 'msg'; content: string }[] = []
  const pushMsg = (content: string) => results.push({ kind: 'msg', content })

  if (!workspacePath) {
    pushMsg('No workspace open. Use /folder to open a project first.')
    return results
  }
  const filePath = args.trim()
  if (!filePath) {
    pushMsg('Usage: `/focus <file-path>` — navigate to and open a file in the editor')
    return results
  }
  const fullPath = filePath.startsWith('/') ? filePath : `${workspacePath}/${filePath}`
  const node = findFileNode(fileNodes, fullPath)
  if (node) {
    openFileTabFn(node)
    pushMsg(`**Opened:** \`${filePath}\``)
  } else {
    const matches = fileNodes.length > 0
      ? collectFiles(fileNodes).filter(f => f.path.includes(filePath))
      : []
    if (matches.length === 1) {
      openFileTabFn(matches[0])
      pushMsg(`**Opened:** \`${matches[0].path.replace(workspacePath + '/', '')}\``)
    } else if (matches.length > 1) {
      const list = matches.slice(0, 10).map(m => `  \`${m.path.replace(workspacePath + '/', '')}\``).join('\n')
      const overflow = matches.length > 10 ? `\n  ... and ${matches.length - 10} more` : ''
      pushMsg(`**${matches.length} files match** \`${filePath}\`:\n${list}${overflow}\n\nBe more specific.`)
    } else {
      pushMsg(`**File not found:** \`${filePath}\``)
    }
  }
  return results
}

// ── test data ───────────────────────────────────────────────────────

const sampleTree: FileNode[] = [
  {
    name: 'src', path: '/workspace/src', type: 'directory',
    children: [
      { name: 'index.ts', path: '/workspace/src/index.ts', type: 'file' },
      { name: 'App.tsx', path: '/workspace/src/App.tsx', type: 'file' },
      {
        name: 'components', path: '/workspace/src/components', type: 'directory',
        children: [
          { name: 'Button.tsx', path: '/workspace/src/components/Button.tsx', type: 'file' },
          { name: 'Input.tsx', path: '/workspace/src/components/Input.tsx', type: 'file' },
        ],
      },
    ],
  },
  { name: 'README.md', path: '/workspace/README.md', type: 'file' },
  { name: 'package.json', path: '/workspace/package.json', type: 'file' },
]

// ── tests ───────────────────────────────────────────────────────────

describe('/focus command logic', () => {
  it('shows no workspace message when workspace is null', async () => {
    const results = await handleFocus(null, [], '', () => {})
    expect(results).toHaveLength(1)
    expect(results[0].content).toContain('No workspace open')
  })

  it('shows usage when no file specified', async () => {
    const results = await handleFocus('/workspace', sampleTree, '', () => {})
    expect(results).toHaveLength(1)
    expect(results[0].content).toContain('/focus')
  })

  it('opens an exact file match by relative path', async () => {
    const opened: FileNode[] = []
    const results = await handleFocus('/workspace', sampleTree, 'src/index.ts', (n) => opened.push(n))
    expect(results).toHaveLength(1)
    expect(results[0].content).toContain('Opened')
    expect(results[0].content).toContain('src/index.ts')
    expect(opened).toHaveLength(1)
    expect(opened[0].path).toBe('/workspace/src/index.ts')
  })

  it('opens an exact file match by absolute path', async () => {
    const opened: FileNode[] = []
    const results = await handleFocus('/workspace', sampleTree, '/workspace/src/App.tsx', (n) => opened.push(n))
    expect(results).toHaveLength(1)
    expect(opened).toHaveLength(1)
    expect(opened[0].path).toBe('/workspace/src/App.tsx')
  })

  it('opens file by partial name match when unique', async () => {
    const opened: FileNode[] = []
    const results = await handleFocus('/workspace', sampleTree, 'Button', (n) => opened.push(n))
    expect(results).toHaveLength(1)
    expect(results[0].content).toContain('Opened')
    expect(opened).toHaveLength(1)
    expect(opened[0].name).toBe('Button.tsx')
  })

  it('shows multiple matches when partial match is ambiguous', async () => {
    const opened: FileNode[] = []
    const results = await handleFocus('/workspace', sampleTree, '.tsx', (n) => opened.push(n))
    expect(results).toHaveLength(1)
    expect(results[0].content).toContain('files match')
    expect(results[0].content).toContain('Be more specific')
    expect(opened).toHaveLength(0)
  })

  it('shows file not found for non-existent file', async () => {
    const opened: FileNode[] = []
    const results = await handleFocus('/workspace', sampleTree, 'nonexistent.txt', (n) => opened.push(n))
    expect(results).toHaveLength(1)
    expect(results[0].content).toContain('File not found')
    expect(opened).toHaveLength(0)
  })

  it('finds files in nested directories', async () => {
    const opened: FileNode[] = []
    const results = await handleFocus('/workspace', sampleTree, 'components/Button.tsx', (n) => opened.push(n))
    expect(results).toHaveLength(1)
    expect(opened).toHaveLength(1)
    expect(opened[0].name).toBe('Button.tsx')
  })

  it('collectFiles flattens tree correctly', () => {
    const files = collectFiles(sampleTree)
    expect(files).toHaveLength(6) // index.ts, App.tsx, Button.tsx, Input.tsx, README.md, package.json
    expect(files.every(f => f.type === 'file')).toBe(true)
  })

  it('findFileNode returns null for non-existent path', () => {
    const result = findFileNode(sampleTree, '/workspace/nope.ts')
    expect(result).toBeNull()
  })
})
