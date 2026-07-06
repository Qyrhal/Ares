import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { FileCode, FileText, Image, FolderOpen, File } from 'lucide-react'

interface QuickFileOpenProps {
  open: boolean
  onClose: () => void
  workspacePath: string | null
  onOpenFile: (path: string) => void
}

function FileIcon({ name }: { name: string }): React.ReactElement {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'tsx' || ext === 'ts' || ext === 'js' || ext === 'jsx' || ext === 'json')
    return <FileCode className="size-4 text-blue-400" />
  if (ext === 'md' || ext === 'txt') return <FileText className="size-4 text-yellow-400" />
  if (ext === 'png' || ext === 'jpg' || ext === 'svg' || ext === 'gif')
    return <Image className="size-4 text-green-400" />
  if (ext === 'css' || ext === 'scss' || ext === 'less')
    return <FileCode className="size-4 text-purple-400" />
  if (ext === 'py' || ext === 'rb' || ext === 'go' || ext === 'rs')
    return <FileCode className="size-4 text-orange-400" />
  return <File className="size-4 text-muted-foreground" />
}

interface FileEntry {
  path: string
  name: string
  dir: string
}

export function QuickFileOpen({ open, onClose, workspacePath, onOpenFile }: QuickFileOpenProps): React.ReactElement | null {
  const [query, setQuery] = useState('')
  const [files, setFiles] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Load file list when opened
  useEffect(() => {
    if (!open || !workspacePath) return
    setLoading(true)
    window.electron.fs.findFiles(workspacePath).then((results: string[]) => {
      const entries = results.map((p) => {
        const parts = p.split('/')
        return {
          path: p,
          name: parts[parts.length - 1] || '',
          dir: parts.slice(0, -1).join('/') || '/',
        }
      })
      setFiles(entries)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [open, workspacePath])

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.children[selectedIdx] as HTMLElement | undefined
    try { el?.scrollIntoView({ block: 'nearest' }) } catch { /* noop */ }
  }, [selectedIdx])

  const filtered = useMemo(() => {
    if (!query.trim()) return files.slice(0, 50)
    const q = query.toLowerCase()
    // Score: path matches get priority, then name matches
    const scored = files.map((f) => {
      const pathScore = f.path.toLowerCase().includes(q) ? 1 : 0
      const nameScore = f.name.toLowerCase().includes(q) ? 2 : 0
      // Fuzzy: check if all chars in query appear in order in filename
      let fuzzyScore = 0
      let qi = 0
      for (const c of f.name.toLowerCase()) {
        if (c === q[qi]) qi++
        if (qi >= q.length) { fuzzyScore = 3; break }
      }
      return { ...f, score: pathScore + nameScore + fuzzyScore }
    })
    return scored.filter((f) => f.score > 0).sort((a, b) => b.score - a.score).slice(0, 50)
  }, [files, query])

  if (!open) return null

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    switch (e.key) {
      case 'Escape': e.preventDefault(); onClose(); break
      case 'ArrowDown': e.preventDefault(); setSelectedIdx((prev) => Math.min(prev + 1, filtered.length - 1)); break
      case 'ArrowUp': e.preventDefault(); setSelectedIdx((prev) => Math.max(prev - 1, 0)); break
      case 'Enter': e.preventDefault(); if (filtered[selectedIdx]) { onOpenFile(filtered[selectedIdx].path); onClose() }; break
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <svg className="size-4 shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0) }}
            onKeyDown={handleKeyDown}
            placeholder={workspacePath ? 'Search files by name…' : 'No folder open'}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            disabled={!workspacePath}
          />
          {!workspacePath && (
            <span className="text-[10px] text-destructive">No folder open</span>
          )}
          {filtered.length > 0 && workspacePath && (
            <span className="text-[10px] text-muted-foreground">{filtered.length} file{filtered.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        <div ref={listRef} className="max-h-80 overflow-y-auto py-1">
          {!workspacePath ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              <FolderOpen className="mx-auto size-8 mb-2 opacity-50" />
              Open a folder to search files
            </div>
          ) : loading ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Loading files…
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {query ? 'No files found' : 'No files in workspace'}
            </div>
          ) : (
            filtered.map((file, idx) => (
              <button
                key={file.path}
                onClick={() => { onOpenFile(file.path); onClose() }}
                onMouseEnter={() => setSelectedIdx(idx)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                  idx === selectedIdx
                    ? 'bg-accent text-accent-foreground'
                    : 'text-foreground hover:bg-accent/50'
                }`}
              >
                <FileIcon name={file.name} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{file.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{file.dir}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
