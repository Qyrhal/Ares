import React, { useCallback, useEffect, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import { Loader2, Save } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileEditorProps {
  path: string
  onDirtyChange?: (isDirty: boolean) => void
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

function detectLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return LANG_MAP[ext] ?? 'plaintext'
}

const el = window.electron

export function FileEditor({ path, onDirtyChange }: FileEditorProps): React.ReactElement {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load file content
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

    // Auto-save after 800ms idle
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(value), 800)
  }, [save])

  // Cmd+S to save immediately
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
      {/* File path breadcrumb */}
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border bg-card/50 px-4">
        <span className="text-xs text-muted-foreground truncate flex-1">{path}</span>
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
