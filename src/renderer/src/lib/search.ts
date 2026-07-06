import { FileNode } from '@/types'

export function searchFileNodes(nodes: FileNode[], query: string): FileNode[] {
  if (!query.trim()) return []
  const q = query.toLowerCase()
  const results: FileNode[] = []
  function walk(list: FileNode[]) {
    for (const node of list) {
      if (node.type === 'file' && node.name.toLowerCase().includes(q)) {
        results.push(node)
      }
      if (node.children) walk(node.children)
    }
  }
  walk(nodes)
  return results.slice(0, 30)
}

export function fuzzyMatch(query: string, text: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  let qi = 0
  for (const c of t) {
    if (c === q[qi]) qi++
    if (qi >= q.length) return true
  }
  return false
}
