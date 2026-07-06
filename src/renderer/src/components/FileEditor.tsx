import React, { useCallback, useEffect, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import { Loader2, Save, Copy, FileDown, ExternalLink, Trash2, AlertTriangle } from 'lucide-react'
import { cn, formatBytes } from '@/lib/utils'

interface FileEditorProps {
  path: string
  onDirtyChange?: (isDirty: boolean) => void
  onClose?: (path: string) => void
}

const LANG_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript',
  js: 'javascript', jsx: 'javascript',
  py: 'python', go: 'go', rs: 'rust',
  cpp: 'cpp', c: 'c', cs: 'csharp',
  json: 'json', jsonc: 'json',
  md: 'markdown', html: 'html',
  css: 'css', scss: 'scss', less: 'less',
  yaml: 'yaml', yml: 'yaml',
  sh: 'shell', bash: 'shell',
  sql: 'sql', xml: 'xml',
  toml: 'ini', env: 'ini',
}

function detectLanguage(p: string): string {
  const ext = p.split('.').pop()?.toLowerCase() ?? ''
  return LANG_MAP[ext] ?? 'plaintext'
}

const el = window.electron

const LARGE_FILE_LIMIT = 1 * 1024 * 1024 // 1MB

export function FileEditor({ path, onDirtyChange, onClose }: FileEditorProps): React.ReactElement {
  const [content, setContent] = useState<string | null>(null)
  const [zoomLevel, setZoomLevel] = useState(14)
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setLoading(true)
    setIsDirty(false)
    el.fs.readFile(path).then((c) => {
      setContent(c)
      setLoading(false)
    }).catch(() => {
      setContent('// Error reading file')
      setLoading(false)
    })
  }, [path])

  const save = useCallback(async (value: string) => {
    setSaving(true)
    await el.fs.writeFile(path, value)
    setSaving(false)
    setIsDirty(false)
    onDirtyChange?.(false)
  }, [path, onDirtyChange])

  const handleChange = useCallback((value: string | undefined) => {
    if (value === undefined) return
    setContent(value)
    setIsDirty(true)
    onDirtyChange?.(true)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(value), 800)
  }, [save])

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (content !== null) {
          if (saveTimer.current) clearTimeout(saveTimer.current)
          save(content)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [content, save])

  const handleDuplicate = useCallback(async () => {
    const dot = path.lastIndexOf('.')
    const newPath = dot !== -1
      ? path.slice(0, dot) + '-copy' + path.slice(dot)
      : path + '-copy'
    if (content !== null) {
      await el.fs.writeFile(newPath, content)
      el.fs.readDir(newPath.substring(0, newPath.lastIndexOf('/'))).then(() => {})
    }
  }, [path, content])

  const handleCopyPath = useCallback(() => {
    navigator.clipboard.writeText(path)
  }, [path])

  const handleDelete = useCallback(async () => {
    if (window.confirm(`Delete "${path.split('/').pop()}"?`)) {
      await el.fs.delete(path)
      onClose?.(path)
    }
  }, [path, onClose])

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const filename = path.split('/').pop() ?? path

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* File header with actions */}
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border bg-card/50 px-3 relative">
        <span className="text-xs text-muted-foreground truncate flex-1 font-mono">{path}</span>

        <div className="flex items-center gap-1">
          {/* Quick actions */}
          <button
            title="Copy path"
            onClick={handleCopyPath}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <Copy className="size-3" />
          </button>
          <button
            title="Duplicate"
            onClick={handleDuplicate}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <FileDown className="size-3" />
          </button>
          <button
            title="Delete file"
            onClick={handleDelete}
            className="rounded p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-3" />
          </button>

          {saving && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
          {isDirty && !saving && (
            <button
              onClick={() => content !== null && save(content)}
              className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300"
            >
              <Save className="size-3" /> Unsaved
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          language={detectLanguage(path)}
          value={content ?? ''}
          onChange={handleChange}
          theme="vs-dark"
          options={{
            fontSize: 13,
            fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
            fontLigatures: true,
            lineHeight: 1.6,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            renderLineHighlight: 'gutter',
            bracketPairColorization: { enabled: true },
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            padding: { top: 12, bottom: 12 },
            tabSize: 2,
            wordWrap: 'off',
          }}
        />
      </div>
    </div>
  )
}
