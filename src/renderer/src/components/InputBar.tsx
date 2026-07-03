import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react'
import { File, FileText, Image, FileCode, Search } from 'lucide-react'
import { PaperclipIcon, SendIcon, XIcon, FolderOpenIcon, TerminalIcon } from '@animateicons/react/lucide'
import { cn, formatBytes } from '@/lib/utils'
import { FileAttachment, FileNode } from '@/types'
import {
  Attachment, AttachmentMedia, AttachmentContent, AttachmentTitle,
  AttachmentDescription, AttachmentActions, AttachmentAction, AttachmentGroup
} from '@/components/ui/attachment'
import { v4 as uuidv4 } from 'uuid'

const SLASH_COMMANDS = [
  { name: 'model', description: 'Change the model for this session' },
  { name: 'folder', description: 'Open or switch workspace folder' },
  { name: 'clear', description: 'Clear all messages in the current session' },
  { name: 'help', description: 'Show available slash commands' },
]

interface InputBarProps {
  onSend: (text: string, attachments: FileAttachment[]) => void
  onCommand?: (command: string, args: string) => void
  onRevealInExplorer?: () => void
  disabled?: boolean
  placeholder?: string
  workspacePath?: string | null
  fileNodes?: FileNode[]
  apiBaseUrl?: string
  apiKey?: string
}

function fileIcon(type: string): React.ReactElement {
  if (type.startsWith('image/')) return <Image className="size-4" />
  if (type === 'application/pdf') return <FileText className="size-4" />
  return <File className="size-4" />
}

function flattenNodes(nodes: FileNode[], basePath = ''): { name: string; relPath: string; isDirectory: boolean }[] {
  const result: { name: string; relPath: string; isDirectory: boolean }[] = []
  for (const n of nodes) {
    const rel = basePath ? `${basePath}/${n.name}` : n.name
    result.push({ name: n.name, relPath: rel, isDirectory: n.type === 'folder' })
    if (n.children) result.push(...flattenNodes(n.children, rel))
  }
  return result
}

interface ModelOption {
  value: string
  label: string
}

export function InputBar({ onSend, onCommand, onRevealInExplorer, disabled, placeholder, fileNodes = [], apiBaseUrl, apiKey }: InputBarProps): React.ReactElement {
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<FileAttachment[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const modelSearchRef = useRef<HTMLInputElement>(null)

  // @mention state
  const [showMentions, setShowMentions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionIndex, setMentionIndex] = useState(-1)
  const [mentionCursor, setMentionCursor] = useState(0)
  const [highlightIdx, setHighlightIdx] = useState(0)

  // slash command state
  const [showCommands, setShowCommands] = useState(false)
  const [cmdQuery, setCmdQuery] = useState('')
  const [cmdIndex, setCmdIndex] = useState(-1)
  const [cmdCursor, setCmdCursor] = useState(0)
  const [cmdHighlight, setCmdHighlight] = useState(0)

  // model picker state (for /model command)
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([])
  const [modelSearch, setModelSearch] = useState('')
  const [modelLoading, setModelLoading] = useState(false)
  const [modelError, setModelError] = useState('')
  const [modelHighlight, setModelHighlight] = useState(0)

  const flatFiles = useMemo(() => flattenNodes(fileNodes), [fileNodes])
  const filtered = useMemo(() => {
    if (!mentionQuery) return flatFiles.filter((f) => !f.isDirectory)
    const q = mentionQuery.toLowerCase()
    return flatFiles.filter((f) => !f.isDirectory && (f.relPath.toLowerCase().includes(q) || f.name.toLowerCase().includes(q)))
  }, [flatFiles, mentionQuery])

  const filteredCommands = useMemo(() => {
    if (!cmdQuery) return SLASH_COMMANDS
    const q = cmdQuery.toLowerCase()
    return SLASH_COMMANDS.filter((c) => c.name.startsWith(q))
  }, [cmdQuery])

  const filteredModels = useMemo(() => {
    if (!modelSearch) return modelOptions
    const q = modelSearch.toLowerCase()
    return modelOptions.filter((m) => m.value.toLowerCase().includes(q))
  }, [modelOptions, modelSearch])

  const openMentions = useCallback((cursor: number, query: string) => {
    setShowMentions(true)
    setMentionQuery(query)
    setMentionCursor(cursor)
    setHighlightIdx(0)
  }, [])

  const closeMentions = useCallback(() => {
    setShowMentions(false)
    setMentionQuery('')
    setMentionIndex(-1)
    setMentionCursor(0)
  }, [])

  const openCommands = useCallback((cursor: number, query: string) => {
    setShowCommands(true)
    setCmdQuery(query)
    setCmdIndex(cursor)
    setCmdCursor(cursor)
    setCmdHighlight(0)
  }, [])

  const closeCommands = useCallback(() => {
    setShowCommands(false)
    setCmdQuery('')
    setCmdIndex(-1)
    setCmdCursor(0)
  }, [])

  const closeAll = useCallback(() => {
    closeMentions()
    closeCommands()
  }, [closeMentions, closeCommands])

  const insertMention = useCallback((relPath: string) => {
    if (mentionCursor < 0 || mentionIndex < 0) return
    const before = text.slice(0, mentionIndex)
    const after = text.slice(mentionCursor)
    const newText = before + relPath + after
    setText(newText)
    closeMentions()
    requestAnimationFrame(() => {
      const ta = textareaRef.current
      if (ta) {
        const pos = before.length + relPath.length
        ta.setSelectionRange(pos, pos)
        ta.focus()
        ta.style.height = 'auto'
        ta.style.height = `${Math.min(ta.scrollHeight, 240)}px`
      }
    })
  }, [text, mentionIndex, mentionCursor, closeMentions])

  // Fetch models for the model picker
  const fetchModels = useCallback(async () => {
    const baseUrl = (apiBaseUrl || '').replace(/\/$/, '')
    if (!baseUrl) { setModelError('No API endpoint configured'); return }
    setModelLoading(true)
    setModelError('')
    try {
      const json = await window.electron.ext.fetchModels(baseUrl, apiKey || '')
      const models: ModelOption[] = (json.data ?? [])
        .map((m: { id: string }) => ({ value: m.id, label: m.id }))
        .sort((a: ModelOption, b: ModelOption) => a.value.localeCompare(b.value))
      setModelOptions(models)
      if (models.length === 0) setModelError('No models available')
    } catch (err) {
      setModelError((err as Error).message)
    } finally {
      setModelLoading(false)
    }
  }, [apiBaseUrl, apiKey])

  // Execute a slash command — some open secondary UI, some fire immediately
  const executeCommand = useCallback((cmdName: string) => {
    setText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    switch (cmdName) {
      case 'model':
        fetchModels()
        setShowModelPicker(true)
        setModelSearch('')
        setModelHighlight(0)
        closeCommands()
        requestAnimationFrame(() => modelSearchRef.current?.focus())
        return
      case 'folder':
        closeCommands()
        onRevealInExplorer?.()
        return
      case 'clear':
        closeCommands()
        onCommand?.('clear', '')
        return
      case 'help':
        closeCommands()
        onCommand?.('help', '')
        return
    }
  }, [onCommand, onRevealInExplorer, fetchModels, closeCommands])

  const handleModelSelect = useCallback((modelId: string) => {
    setShowModelPicker(false)
    onCommand?.('model', modelId)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }, [onCommand])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setText(val)
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 240)}px`

    const cursor = ta.selectionStart
    const textBefore = val.slice(0, cursor)

    // Check for @ mention
    const atIdx = textBefore.lastIndexOf('@')
    if (atIdx !== -1) {
      const afterAt = textBefore.slice(atIdx + 1)
      if (!afterAt.includes(' ') && !afterAt.includes('\n') && afterAt.length <= 100) {
        setMentionIndex(atIdx)
        setShowModelPicker(false)
        closeCommands()
        openMentions(cursor, afterAt)
        return
      }
    }

    // Check for / command (must be at start of line)
    const lineStart = textBefore.lastIndexOf('\n') + 1
    if (textBefore[lineStart] === '/') {
      const afterSlash = textBefore.slice(lineStart + 1)
      if (!afterSlash.includes(' ') && !afterSlash.includes('\n') && afterSlash.length <= 50) {
        setCmdIndex(lineStart)
        setShowModelPicker(false)
        closeMentions()
        openCommands(cursor, afterSlash)
        return
      }
    }

    closeAll()
    setShowModelPicker(false)
  }, [openMentions, openCommands, closeAll, closeMentions, closeCommands])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (showMentions) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx((prev) => Math.min(prev + 1, filtered.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx((prev) => Math.max(prev - 1, 0)); return }
      if (e.key === 'Enter' && filtered[highlightIdx]) { e.preventDefault(); insertMention(filtered[highlightIdx].relPath); return }
      if (e.key === 'Tab' && filtered[highlightIdx]) { e.preventDefault(); insertMention(filtered[highlightIdx].relPath); return }
      if (e.key === 'Escape') { e.preventDefault(); closeMentions(); return }
    }

    if (showCommands) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setCmdHighlight((prev) => Math.min(prev + 1, filteredCommands.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setCmdHighlight((prev) => Math.max(prev - 1, 0)); return }
      if (e.key === 'Enter' && filteredCommands[cmdHighlight]) { e.preventDefault(); executeCommand(filteredCommands[cmdHighlight].name); return }
      if (e.key === 'Tab' && filteredCommands[cmdHighlight]) { e.preventDefault(); insertCommand(filteredCommands[cmdHighlight].name); return }
      if (e.key === 'Escape') { e.preventDefault(); closeCommands(); return }
    }

    if (showModelPicker) {
      if (e.key === 'Escape') { e.preventDefault(); setShowModelPicker(false); return }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSend = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed && attachments.length === 0) return
    if (trimmed.startsWith('/') && onCommand) {
      const spaceIdx = trimmed.indexOf(' ')
      const cmd = spaceIdx === -1 ? trimmed.slice(1) : trimmed.slice(1, spaceIdx)
      const args = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1).trim()
      setText(''); setAttachments([]); closeAll(); setShowModelPicker(false)
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      onCommand(cmd, args)
      return
    }
    onSend(trimmed, attachments)
    setText(''); setAttachments([]); closeAll(); setShowModelPicker(false)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }, [text, attachments, onSend, onCommand, closeAll])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(e.target.files ?? [])
    const newAttachments: FileAttachment[] = files.map((f) => ({
      id: uuidv4(), name: f.name, size: f.size, type: f.type, path: (f as File & { path?: string }).path ?? f.name
    }))
    setAttachments((prev) => [...prev, ...newAttachments])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeAttachment = (id: string): void => setAttachments((prev) => prev.filter((a) => a.id !== id))

  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    const newAttachments: FileAttachment[] = files.map((f) => ({
      id: uuidv4(), name: f.name, size: f.size, type: f.type, path: (f as File & { path?: string }).path ?? f.name
    }))
    setAttachments((prev) => [...prev, ...newAttachments])
  }

  const anyDropdownOpen = showMentions || showCommands || showModelPicker
  useEffect(() => {
    if (!anyDropdownOpen) return
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          textareaRef.current && !textareaRef.current.contains(e.target as Node)) {
        closeAll()
        setShowModelPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [anyDropdownOpen, closeAll])

  const canSend = (text.trim().length > 0 || attachments.length > 0) && !disabled

  return (
    <div
      className="relative border-t border-border bg-card/80 backdrop-blur-sm px-4 pt-3 pb-4"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {attachments.length > 0 && (
        <AttachmentGroup className="mb-2">
          {attachments.map((att) => (
            <Attachment key={att.id} size="sm" className="max-w-48">
              <AttachmentMedia>{fileIcon(att.type)}</AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>{att.name}</AttachmentTitle>
                <AttachmentDescription>{formatBytes(att.size)}</AttachmentDescription>
              </AttachmentContent>
              <AttachmentActions>
                <AttachmentAction aria-label={`Remove ${att.name}`} onClick={() => removeAttachment(att.id)} className="opacity-100">
                  <XIcon />
                </AttachmentAction>
              </AttachmentActions>
            </Attachment>
          ))}
        </AttachmentGroup>
      )}

      <div className={cn(
        'flex items-end gap-2 rounded-xl border border-border bg-input px-3 py-2 transition-colors',
        'focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20'
      )}>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mb-0.5 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Attach file"
        >
          <PaperclipIcon className="size-4" />
        </button>

        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={placeholder ?? 'Ask anything… (@ to mention files, / for commands)'}
            rows={1}
            className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 min-h-[28px] max-h-60 leading-6 py-0.5"
          />

          {/* @mention dropdown */}
          {showMentions && filtered.length > 0 && (
            <div ref={dropdownRef} className="absolute bottom-full left-0 mb-1 max-h-48 w-72 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg z-50">
              {filtered.slice(0, 50).map((f, i) => (
                <button
                  key={f.relPath}
                  type="button"
                  className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors', i === highlightIdx ? 'bg-accent text-accent-foreground' : 'text-popover-foreground hover:bg-accent/50')}
                  onMouseDown={(e) => { e.preventDefault(); insertMention(f.relPath) }}
                  onMouseEnter={() => setHighlightIdx(i)}
                >
                  <FileCode className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{f.relPath}</span>
                </button>
              ))}
            </div>
          )}

          {/* Slash command dropdown */}
          {showCommands && filteredCommands.length > 0 && (
            <div ref={dropdownRef} className="absolute bottom-full left-0 mb-1 max-h-40 w-64 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg z-50">
              {filteredCommands.map((cmd, i) => (
                <button
                  key={cmd.name}
                  type="button"
                  className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors', i === cmdHighlight ? 'bg-accent text-accent-foreground' : 'text-popover-foreground hover:bg-accent/50')}
                  onMouseDown={(e) => { e.preventDefault(); executeCommand(cmd.name) }}
                  onMouseEnter={() => setCmdHighlight(i)}
                >
                  <TerminalIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="font-medium text-xs">/{cmd.name}</span>
                    <span className="text-[10px] text-muted-foreground">{cmd.description}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Model picker (for /model command) */}
          {showModelPicker && (
            <div ref={dropdownRef} className="absolute bottom-full left-0 mb-1 w-80 overflow-hidden rounded-lg border border-border bg-popover shadow-lg z-50">
              <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <Search className="size-3.5 text-muted-foreground shrink-0" />
                <input
                  ref={modelSearchRef}
                  type="text"
                  value={modelSearch}
                  onChange={(e) => { setModelSearch(e.target.value); setModelHighlight(0) }}
                  placeholder="Search models…"
                  className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') { e.preventDefault(); setShowModelPicker(false); textareaRef.current?.focus(); return }
                    if (e.key === 'ArrowDown') { e.preventDefault(); setModelHighlight((p) => Math.min(p + 1, filteredModels.length - 1)); return }
                    if (e.key === 'ArrowUp') { e.preventDefault(); setModelHighlight((p) => Math.max(p - 1, 0)); return }
                    if (e.key === 'Enter' && filteredModels[modelHighlight]) { e.preventDefault(); handleModelSelect(filteredModels[modelHighlight].value); return }
                  }}
                />
                {modelLoading && <span className="inline-block size-3 rounded-full border-2 border-muted-foreground/30 border-t-primary/80 animate-spin" />}
              </div>
              <div className="max-h-48 overflow-y-auto p-1">
                {modelError && !modelLoading && (
                  <p className="px-2 py-3 text-[11px] text-destructive text-center">{modelError}</p>
                )}
                {modelLoading && !modelError && (
                  <p className="px-2 py-3 text-[11px] text-muted-foreground text-center">Loading models…</p>
                )}
                {!modelLoading && !modelError && filteredModels.length === 0 && (
                  <p className="px-2 py-3 text-[11px] text-muted-foreground text-center">No models found</p>
                )}
                {filteredModels.map((m, i) => (
                  <button
                    key={m.value}
                    type="button"
                    className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors', i === modelHighlight ? 'bg-accent text-accent-foreground' : 'text-popover-foreground hover:bg-accent/50')}
                    onMouseDown={(e) => { e.preventDefault(); handleModelSelect(m.value) }}
                    onMouseEnter={() => setModelHighlight(i)}
                  >
                    <span className="truncate">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className={cn('mb-0.5 flex size-7 shrink-0 items-center justify-center rounded-md transition-colors', canSend ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'text-muted-foreground opacity-40 cursor-not-allowed')}
          aria-label="Send message"
        >
          <SendIcon className="size-3.5" />
        </button>

        <button
          type="button"
          onClick={onRevealInExplorer}
          className="mb-0.5 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Reveal in sidebar"
          title="Reveal in sidebar"
        >
          <FolderOpenIcon className="size-3.5" />
        </button>
      </div>

      <p className="mt-1.5 text-center text-[10px] text-muted-foreground/40">
        Ares can make mistakes. Verify important information.
      </p>
    </div>
  )
}
