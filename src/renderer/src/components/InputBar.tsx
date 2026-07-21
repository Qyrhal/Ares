import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react'
import { File, FileText, Image, FileCode, Search, Shield, Zap, ChevronDown, Sparkles, Plug, Square, Reply, Sun, Moon } from 'lucide-react'
import { PaperclipIcon, SendIcon, XIcon, TerminalIcon } from '@animateicons/react/lucide'
import { cn, formatBytes } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'
import { FileAttachment, FileNode, Message, PermissionMode, PiSkill, SlashCommand, AgentMode } from '@/types'
import { ProjectPicker } from '@/components/ProjectPicker'
import {
  Attachment, AttachmentMedia, AttachmentContent, AttachmentTitle,
  AttachmentDescription, AttachmentActions, AttachmentAction, AttachmentGroup
} from '@/components/ui/attachment'
import { v4 as uuidv4 } from 'uuid'
import { contextWindow, estimateTokens } from '@/lib/context'
import { effectiveProviders, makeModelRef, displayModel } from '@/lib/providers'
import type { ProviderConfig } from '@/types'

type PickerKind = 'builtin' | 'skill' | 'command'
interface PickerItem {
  kind: PickerKind
  name: string
  description: string
  hint?: string          // argument-hint for commands, line count for skills
  content?: string       // skill content or command prompt template
}

export const BUILTIN_COMMANDS: PickerItem[] = [
  { kind: 'builtin', name: 'model',        description: 'Change the model for this session' },
  { kind: 'builtin', name: 'folder',       description: 'Open or switch workspace folder' },
  { kind: 'builtin', name: 'overview',     description: 'Get an AI-generated summary of the current project' },
  { kind: 'builtin', name: 'clear',        description: 'Clear all messages in the current session' },
  { kind: 'builtin', name: 'pr',           description: 'Generate a pull request from the current session context' },
  { kind: 'builtin', name: 'fork',         description: 'Clone this session as a new working session' },
  { kind: 'builtin', name: 'helpful',      description: 'Mark the last assistant response as helpful' },
  { kind: 'builtin', name: 'not-helpful',  description: 'Mark the last assistant response as not helpful' },
  { kind: 'builtin', name: 'compact',      description: 'Manually compact the conversation context window' },
  { kind: 'builtin', name: 'usage',        description: 'Show session token usage and estimated cost' },
  { kind: 'builtin', name: 'changes',      description: 'Show workspace git status (branch, staged, unstaged files)' },
  { kind: 'builtin', name: 'export',       description: 'Export current session as a Markdown file' },
  { kind: 'builtin', name: 'shortcuts',   description: 'Show all keyboard shortcuts' },
  { kind: 'builtin', name: 'review',       description: 'AI-powered review of session code and patterns' },
  { kind: 'builtin', name: 'rename',       description: 'Rename the current session' },
  { kind: 'builtin', name: 'pin',           description: 'Pin or unpin the current session' },
  { kind: 'builtin', name: 'branches',      description: 'List, create, or switch git branches' },
  { kind: 'builtin', name: 'stage',         description: 'Stage or unstage files for commit' },
  { kind: 'builtin', name: 'commit',        description: 'Commit staged changes with a message' },
  { kind: 'builtin', name: 'debug',         description: 'Show diagnostic and debug information' },
  { kind: 'builtin', name: 'doctor',        description: 'Run environment diagnostics and health checks' },
  { kind: 'builtin', name: 'history',       description: 'Show recent prompt history' },
  { kind: 'builtin', name: 'log',          description: 'Show recent git commits' },
  { kind: 'builtin', name: 'help',         description: 'Show available slash commands' },
]

function expandTemplate(prompt: string, args: string): string {
  return prompt.replace(/\{\{args\}\}/gi, args).replace(/\$ARGUMENTS/g, args)
}

const KIND_LABELS: Record<PickerKind, string> = {
  builtin: 'Built-in',
  skill:   'Skills',
  command: 'Plugin commands',
}

interface InputBarProps {
  onSend: (text: string, attachments: FileAttachment[], replyTo?: { id: string; content: string; role: string }) => void
  onCommand?: (command: string, args: string) => void
  onRevealInExplorer?: () => void
  disabled?: boolean
  onCancel?: () => void
  placeholder?: string
  workspacePath?: string | null
  fileNodes?: FileNode[]
  apiBaseUrl?: string
  apiKey?: string
  providers?: ProviderConfig[]
  recentProjects?: string[]
  onSelectProject?: (path: string) => void
  onOpenFinder?: () => void
  pluginSkills?: PiSkill[]
  pluginCommands?: SlashCommand[]
  // bottom toolbar
  currentModel?: string
  messages?: Message[]
  effort?: string
  onEffortChange?: (effort: string) => void
  permissionMode?: PermissionMode
  onPermissionModeChange?: (mode: PermissionMode) => void
  agentMode?: AgentMode
  onAgentModeChange?: (mode: AgentMode) => void
  // color mode
  colorMode?: 'dark' | 'light'
  onToggleColorMode?: () => void
  // reply
  replyTo?: { id: string; content: string; role: string } | null
  onCancelReply?: () => void
}

const PERM_MODES: PermissionMode[] = ['ask', 'auto', 'yolo']
const PERM_LABELS: Record<PermissionMode, string> = { ask: 'Ask', auto: 'Auto', yolo: 'Yolo' }
const EFFORT_LEVELS = ['low', 'medium', 'high'] as const
const EFFORT_LABELS: Record<string, string> = { low: 'Low', medium: 'Med', high: 'High' }

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10}M`
  if (n >= 1_000) return `${Math.round(n / 100) / 10}k`
  return String(n)
}

function ContextDonut({ used, total }: { used: number; total: number }): React.ReactElement {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  const pct = total > 0 ? Math.min(used / total, 1) : 0
  const r = 7
  const circ = 2 * Math.PI * r
  const dash = circ * pct
  const colorClass = pct > 0.8 ? 'text-destructive' : pct > 0.5 ? 'text-amber-400' : 'text-muted-foreground'

  React.useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn('flex items-center justify-center rounded-md p-0.5 transition-colors hover:bg-accent', colorClass)}
      >
        <svg width="18" height="18" viewBox="0 0 18 18">
          <circle cx="9" cy="9" r={r} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
          <circle
            cx="9" cy="9" r={r} fill="none"
            stroke="currentColor" strokeWidth="2.5"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeLinecap="round"
            transform="rotate(-90 9 9)"
          />
        </svg>
      </button>
      {open && (
        <div className="absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1.5 shadow-lg z-50">
          <p className="text-[11px] font-medium text-foreground">{fmtTokens(used)} / {fmtTokens(total)}</p>
          <p className="text-[10px] text-muted-foreground">{Math.round(pct * 100)}% of context used</p>
        </div>
      )}
    </div>
  )
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
  provider?: string
}

export function InputBar({ onSend, onCommand, onRevealInExplorer, disabled, onCancel, placeholder, fileNodes = [], apiBaseUrl, apiKey, providers = [], workspacePath, recentProjects = [], onSelectProject, onOpenFinder, pluginSkills = [], pluginCommands = [], currentModel = '', messages = [], effort = 'medium', onEffortChange, permissionMode = 'ask', onPermissionModeChange, agentMode = 'agent', onAgentModeChange, colorMode = 'dark', onToggleColorMode, replyTo, onCancelReply }: InputBarProps): React.ReactElement {
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<FileAttachment[]>([])
  const [skillAttachments, setSkillAttachments] = useState<{ id: string; name: string; content: string }[]>([])

  const addPromptToHistory = useAppStore((s) => s.addPromptToHistory)
  const navigatePromptHistory = useAppStore((s) => s.navigatePromptHistory)
  const resetPromptHistoryIdx = useAppStore((s) => s.resetPromptHistoryIdx)
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

  // model picker state (for /model command and bottom bar)
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([])
  const [modelSearch, setModelSearch] = useState('')
  const [modelLoading, setModelLoading] = useState(false)
  const [modelError, setModelError] = useState('')
  const [modelHighlight, setModelHighlight] = useState(0)

  // effort dropdown state
  const [showEffortPicker, setShowEffortPicker] = useState(false)
  const effortRef = useRef<HTMLDivElement>(null)

  const usedTokens = useMemo(() => estimateTokens(messages), [messages])
  const ctxWindow = useMemo(() => contextWindow(currentModel), [currentModel])

  const flatFiles = useMemo(() => flattenNodes(fileNodes), [fileNodes])
  const filtered = useMemo(() => {
    if (!mentionQuery) return flatFiles.filter((f) => !f.isDirectory)
    const q = mentionQuery.toLowerCase()
    return flatFiles.filter((f) => !f.isDirectory && (f.relPath.toLowerCase().includes(q) || f.name.toLowerCase().includes(q)))
  }, [flatFiles, mentionQuery])

  const allPickerItems = useMemo((): PickerItem[] => [
    ...BUILTIN_COMMANDS,
    ...pluginSkills.map((s): PickerItem => ({
      kind: 'skill',
      name: s.name,
      description: s.description || 'No description',
      hint: s.content ? `${s.content.split('\n').length} lines` : undefined,
      content: s.content,
    })),
    ...pluginCommands.map((c): PickerItem => ({
      kind: 'command',
      name: c.name,
      description: c.description,
      hint: c.argumentHint,
      content: c.prompt,
    })),
  ], [pluginSkills, pluginCommands])

  const filteredCommands = useMemo((): PickerItem[] => {
    const q = cmdQuery.toLowerCase()
    if (!q) return allPickerItems
    return allPickerItems.filter((c) => c.name.toLowerCase().startsWith(q) || c.description.toLowerCase().includes(q))
  }, [cmdQuery, allPickerItems])

  const filteredModels = useMemo(() => {
    if (!modelSearch) return modelOptions
    const q = modelSearch.toLowerCase()
    return modelOptions.filter((m) =>
      m.label.toLowerCase().includes(q) || (m.provider ?? '').toLowerCase().includes(q))
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

  // Fetch models from every configured provider, grouped for the picker
  const fetchModels = useCallback(async () => {
    setModelLoading(true)
    setModelError('')
    try {
      const provs = effectiveProviders({ providers, apiBaseUrl: apiBaseUrl || '', apiKey: apiKey || '' })
      if (provs.length === 0) { setModelError('No API endpoint configured'); setModelLoading(false); return }
      const multi = provs.length > 1
      const results = await Promise.allSettled(provs.map(async (p) => {
        const json = await window.electron.ext.fetchModels(p.baseUrl.replace(/\/$/, ''), p.apiKey)
        return ((json.data ?? []) as { id: string }[])
          .map((m): ModelOption => ({
            value: multi ? makeModelRef(p.id, m.id) : m.id,
            label: m.id,
            provider: p.label,
          }))
          .sort((a, b) => a.label.localeCompare(b.label))
      }))
      const models = results.flatMap((r) => r.status === 'fulfilled' ? r.value : [])
      setModelOptions(models)
      if (models.length === 0) {
        const firstErr = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
        setModelError(firstErr ? (firstErr.reason as Error).message : 'No models available')
      }
    } catch (err) {
      setModelError((err as Error).message)
    } finally {
      setModelLoading(false)
    }
  }, [apiBaseUrl, apiKey, providers])

  // Insert /commandname into textarea (for Tab-completion of command name)
  const insertCommand = useCallback((cmdName: string) => {
    const ta = textareaRef.current
    if (!ta || cmdIndex < 0) return
    const before = text.slice(0, cmdIndex)
    const after = text.slice(ta.selectionStart)
    const newText = `${before}/${cmdName} ${after}`
    setText(newText)
    closeCommands()
    requestAnimationFrame(() => {
      const pos = before.length + cmdName.length + 2
      ta.setSelectionRange(pos, pos)
      ta.focus()
    })
  }, [text, cmdIndex, closeCommands])

  const setTextAndResize = useCallback((val: string) => {
    setText(val)
    requestAnimationFrame(() => {
      const ta = textareaRef.current
      if (ta) { ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 240)}px`; ta.focus() }
    })
  }, [])

  // Execute a slash command — built-ins open secondary UI, skills/commands expand template
  const executeCommand = useCallback((item: PickerItem) => {
    closeCommands()

    if (item.kind === 'builtin') {
      switch (item.name) {
        case 'model':
          setText(''); if (textareaRef.current) textareaRef.current.style.height = 'auto'
          fetchModels(); setShowModelPicker(true); setModelSearch(''); setModelHighlight(0)
          requestAnimationFrame(() => modelSearchRef.current?.focus())
          return
        case 'folder':
          setText(''); if (textareaRef.current) textareaRef.current.style.height = 'auto'
          onRevealInExplorer?.()
          return
        case 'clear':
          setText(''); if (textareaRef.current) textareaRef.current.style.height = 'auto'
          onCommand?.('clear', '')
          return
        case 'help':
          setText(''); if (textareaRef.current) textareaRef.current.style.height = 'auto'
          onCommand?.('help', '')
          return
        case 'commit':
        case 'helpful':
        case 'not-helpful':
        case 'pr':
        case 'fork':
          setText(''); if (textareaRef.current) textareaRef.current.style.height = 'auto'
          onCommand?.(item.name, '')
          return
      }
    }

    if (item.kind === 'skill') {
      // Skills show as attachment chips instead of pasting raw content
      const existing = skillAttachments.find((s) => s.name === item.name)
      if (existing) return // already attached
      setSkillAttachments((prev) => [...prev, { id: uuidv4(), name: item.name, content: item.content ?? '' }])
      return
    }

    if (item.kind === 'command') {
      if (item.hint) {
        // Has argument-hint — put /name  so user types args
        insertCommand(item.name)
      } else if (item.content) {
        setTextAndResize(expandTemplate(item.content, ''))
      }
    }
  }, [onCommand, onRevealInExplorer, fetchModels, closeCommands, insertCommand, setTextAndResize])

  const handleModelSelect = useCallback((modelId: string) => {
    setShowModelPicker(false)
    onCommand?.('model', modelId)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }, [onCommand])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setText(val)
    resetPromptHistoryIdx()
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
  }, [openMentions, openCommands, closeAll, closeMentions, closeCommands, resetPromptHistoryIdx])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    // ── Prompt history navigation (when input is empty and no pickers open) ──
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !showMentions && !showCommands && !showModelPicker) {
      const ta = textareaRef.current
      if (ta && ta.selectionStart === 0 && ta.selectionEnd === 0 && !text.trim()) {
        e.preventDefault()
        const recalled = navigatePromptHistory(e.key === 'ArrowUp' ? 'up' : 'down')
        if (recalled !== null) {
          setText(recalled)
          requestAnimationFrame(() => {
            if (textareaRef.current) {
              textareaRef.current.style.height = 'auto'
              textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
            }
          })
        }
        return
      }
    }

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
      if (e.key === 'Enter' && filteredCommands[cmdHighlight]) { e.preventDefault(); executeCommand(filteredCommands[cmdHighlight]); return }
      if (e.key === 'Tab' && filteredCommands[cmdHighlight]) { e.preventDefault(); executeCommand(filteredCommands[cmdHighlight]); return }
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
    if (!trimmed && attachments.length === 0 && skillAttachments.length === 0) return

    // Prepend skill content as context
    let finalText = trimmed
    if (skillAttachments.length > 0) {
      const skillContext = skillAttachments.map((s) => `[Skill: ${s.name}]\n${s.content}`).join('\n\n')
      finalText = finalText ? `${skillContext}\n\n${finalText}` : skillContext
    }

    const reset = () => {
      setText(''); setAttachments([]); setSkillAttachments([]); closeAll(); setShowModelPicker(false)
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    }

    addPromptToHistory(text)

    if (trimmed.startsWith('/')) {
      const spaceIdx = trimmed.indexOf(' ')
      const cmdName = (spaceIdx === -1 ? trimmed.slice(1) : trimmed.slice(1, spaceIdx)).toLowerCase()
      const args = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1).trim()

      // Skill or plugin command — expand template and send as regular message
      const pickerItem = allPickerItems.find((c) => c.name === cmdName && c.kind !== 'builtin')
      if (pickerItem?.content) {
        const expanded = expandTemplate(pickerItem.content, args)
        reset()
        onSend(expanded, attachments, replyTo ?? undefined)
        return
      }

      // Built-in command
      if (onCommand) {
        reset()
        onCommand(cmdName, args)
        return
      }
    }

    onSend(finalText, attachments, replyTo ?? undefined)
    reset()
  }, [text, attachments, skillAttachments, onSend, onCommand, closeAll, allPickerItems, replyTo, addPromptToHistory])

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

  useEffect(() => {
    if (!showEffortPicker) return
    const handler = (e: MouseEvent) => {
      if (effortRef.current && !effortRef.current.contains(e.target as Node)) setShowEffortPicker(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showEffortPicker])

  const canSend = (text.trim().length > 0 || attachments.length > 0) && !disabled

  return (
    <div
      className="relative shrink-0 border-t border-border bg-card/80 backdrop-blur-sm px-3 py-2 shadow-[var(--shadow-highlight)]"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {attachments.length > 0 && (
        <AttachmentGroup className="mb-1.5">
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

      {skillAttachments.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {skillAttachments.map((sk) => (
            <div key={sk.id} className="inline-flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-xs text-violet-300">
              <Sparkles className="size-3 shrink-0" />
              <span className="font-medium">{sk.name}</span>
              <span className="text-[10px] text-violet-400/60">skill</span>
              <button
                onClick={() => setSkillAttachments((prev) => prev.filter((s) => s.id !== sk.id))}
                className="ml-0.5 rounded p-0.5 text-violet-400/50 hover:text-violet-300 hover:bg-violet-500/20"
                aria-label={`Remove ${sk.name}`}
              >
                <XIcon className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Reply-to chip */}
      {replyTo && (
        <div className="mb-1.5 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1">
          <Reply className="size-3 shrink-0 text-primary" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[10px] font-medium text-primary uppercase tracking-wider">Replying to {replyTo.role === 'user' ? 'You' : 'Assistant'}</span>
            <span className="truncate text-[11px] text-muted-foreground">{replyTo.content}</span>
          </div>
          <button
            onClick={onCancelReply}
            className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label="Cancel reply"
          >
            <XIcon className="size-3" />
          </button>
        </div>
      )}

      <div className={cn(
        'flex items-end gap-1.5 rounded-lg border border-border bg-input px-2.5 py-1.5 transition-all shadow-[var(--shadow-inset-sm)]',
        'focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 focus-within:shadow-sm'
      )}>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mb-0.5 flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Attach file"
        >
          <PaperclipIcon className="size-3.5" />
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
            className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 min-h-[24px] max-h-60 leading-6 py-0.5"
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
            <div ref={dropdownRef} className="absolute bottom-full left-0 mb-1 max-h-72 w-80 overflow-y-auto rounded-xl border border-border bg-popover shadow-xl z-50">
              {(() => {
                const sections: PickerKind[] = ['builtin', 'skill', 'command']
                const nodes: React.ReactNode[] = []
                let flatIdx = 0
                for (const kind of sections) {
                  const items = filteredCommands.filter((c) => c.kind === kind)
                  if (items.length === 0) continue
                  nodes.push(
                    <div key={`hdr-${kind}`} className="flex items-center gap-2 px-3 pt-2.5 pb-1">
                      {kind === 'builtin' && <TerminalIcon className="size-3 text-muted-foreground" />}
                      {kind === 'skill'   && <Sparkles className="size-3 text-violet-400" />}
                      {kind === 'command' && <Plug className="size-3 text-primary" />}
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{KIND_LABELS[kind]}</span>
                    </div>
                  )
                  for (const cmd of items) {
                    const idx = flatIdx++
                    nodes.push(
                      <button
                        key={`${kind}-${cmd.name}`}
                        type="button"
                        className={cn('flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left transition-colors mx-0.5',
                          idx === cmdHighlight ? 'bg-accent text-accent-foreground' : 'text-popover-foreground hover:bg-accent/60'
                        )}
                        onMouseDown={(e) => { e.preventDefault(); executeCommand(cmd) }}
                        onMouseEnter={() => setCmdHighlight(idx)}
                      >
                        <div className="mt-0.5 shrink-0">
                          {cmd.kind === 'skill'   && <Sparkles className="size-3.5 text-violet-400" />}
                          {cmd.kind === 'command' && <Plug className="size-3.5 text-primary" />}
                          {cmd.kind === 'builtin' && <TerminalIcon className="size-3.5 text-muted-foreground" />}
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-xs">/{cmd.name}</span>
                            {cmd.hint && (
                              <span className="rounded bg-muted px-1 py-px text-[9px] font-mono text-muted-foreground">{cmd.hint}</span>
                            )}
                          </div>
                          <span className="truncate text-[11px] text-muted-foreground leading-snug">{cmd.description}</span>
                        </div>
                      </button>
                    )
                  }
                  nodes.push(<div key={`div-${kind}`} className="mx-3 my-1 border-t border-border/50 last:hidden" />)
                }
                return nodes
              })()}
              <div className="h-1" />
            </div>
          )}

          {/* model picker is rendered outside this div — see below */}
        </div>

        {disabled ? (
          <button
            type="button"
            onClick={onCancel}
            className="mb-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20"
            aria-label="Stop generation (Ctrl+C)"
            title="Stop generation (Ctrl+C)"
          >
            <Square className="size-3 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className={cn('press-effect mb-0.5 flex size-6 shrink-0 items-center justify-center rounded-md transition-all', canSend ? 'bg-primary text-primary-foreground shadow-sm hover:shadow-md hover:bg-primary/90' : 'text-muted-foreground opacity-40 cursor-not-allowed')}
            aria-label="Send message"
          >
            <SendIcon className="size-3.5" />
          </button>
        )}

      </div>

      {/* Model picker — outside textarea div so it positions relative to outer container */}
      {showModelPicker && (
        <div ref={dropdownRef} className="absolute bottom-full left-0 right-0 mb-1 mx-4 w-80 overflow-hidden rounded-lg border border-border bg-popover shadow-lg z-50">
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
            {filteredModels.map((m, i) => {
              const firstOfProvider = i === 0 || filteredModels[i - 1].provider !== m.provider
              return (
                <React.Fragment key={m.value}>
                  {m.provider && firstOfProvider && (
                    <p className="px-2 pt-2 pb-0.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {m.provider}
                    </p>
                  )}
                  <button
                    type="button"
                    className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors', i === modelHighlight ? 'bg-accent text-accent-foreground' : 'text-popover-foreground hover:bg-accent/50')}
                    onMouseDown={(e) => { e.preventDefault(); handleModelSelect(m.value) }}
                    onMouseEnter={() => setModelHighlight(i)}
                  >
                    <span className="truncate">{m.label}</span>
                  </button>
                </React.Fragment>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Bottom toolbar ─────────────────────────────────────────── */}
      <div className="mt-1.5 flex items-center justify-between">

        {/* Left: project + mode toggle + permission mode */}
        <div className="flex items-center gap-1">
          {onOpenFinder && (
            <ProjectPicker
              workspacePath={workspacePath ?? null}
              recentProjects={recentProjects}
              onSelectPath={onSelectProject ?? (() => {})}
              onOpenFinder={onOpenFinder}
            />
          )}

          {/* Chat/Plan/Agent mode toggle */}
          <div className="flex items-center overflow-hidden rounded-md border border-border">
            <button
              type="button"
              onClick={() => onAgentModeChange?.('chat')}
              className={cn(
                'px-1.5 py-0.5 text-[10px] transition-colors',
                agentMode === 'chat'
                  ? 'bg-teal-500/15 text-teal-400 font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
              title="Chat mode — no tool execution, just Q&A"
            >
              Chat
            </button>
            <button
              type="button"
              onClick={() => onAgentModeChange?.('plan')}
              className={cn(
                'px-1.5 py-0.5 text-[10px] transition-colors',
                agentMode === 'plan'
                  ? 'bg-amber-500/15 text-amber-400 font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
              title="Plan mode — describe approach without executing tools"
            >
              Plan
            </button>
            <button
              type="button"
              onClick={() => onAgentModeChange?.('agent')}
              className={cn(
                'px-1.5 py-0.5 text-[10px] transition-colors',
                agentMode === 'agent' || agentMode === undefined
                  ? 'bg-primary/15 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
              title="Agent mode — full autonomous execution with tools"
            >
              Agent
            </button>
          </div>

          {/* Permission mode */}
          <button
            type="button"
            onClick={() => {
              const idx = PERM_MODES.indexOf(permissionMode)
              const next = PERM_MODES[(idx + 1) % PERM_MODES.length]
              onPermissionModeChange?.(next)
            }}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Click to cycle permission mode"
          >
            <Shield className="size-2.5 shrink-0" />
            <span>{PERM_LABELS[permissionMode]}</span>
          </button>
        </div>

        {/* Right: model · effort · context */}
        <div className="flex items-center gap-0.5">
          {/* Model chip — opens existing model picker */}
          <button
            type="button"
            onClick={() => { fetchModels(); setShowModelPicker(true); setModelSearch(''); setModelHighlight(0); requestAnimationFrame(() => modelSearchRef.current?.focus()) }}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground max-w-[140px]"
            title="Change model"
          >
            <span className="truncate">{displayModel(currentModel) || 'No model'}</span>
          </button>

          {/* Separator */}
          <span className="h-3 w-px shrink-0 bg-border" />

          {/* Effort picker */}
          <div ref={effortRef} className="relative">
            <button
              type="button"
              onClick={() => setShowEffortPicker((v) => !v)}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Effort level"
            >
              <Zap className="size-2.5 shrink-0" />
              <span>{EFFORT_LABELS[effort] ?? 'Med'}</span>
              <ChevronDown className={cn('size-2.5 shrink-0 transition-transform', showEffortPicker && 'rotate-180')} />
            </button>
            {showEffortPicker && (
              <div className="surface-overlay absolute bottom-full right-0 mb-1 w-28 overflow-hidden rounded-lg border border-border z-50 p-1">
                {EFFORT_LEVELS.map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); onEffortChange?.(lvl); setShowEffortPicker(false) }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
                      effort === lvl ? 'bg-accent text-accent-foreground' : 'text-popover-foreground hover:bg-accent/50'
                    )}
                  >
                    <Zap className="size-3 shrink-0" />
                    <span className="capitalize">{lvl}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Separator */}
          <span className="h-3 w-px shrink-0 bg-border" />

          {/* Context donut */}
          <ContextDonut used={usedTokens} total={ctxWindow} />

          {onToggleColorMode && (
            <>
              <span className="h-3 w-px shrink-0 bg-border" />
              <button
                type="button"
                onClick={onToggleColorMode}
                className="flex items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label={colorMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                title={colorMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {colorMode === 'dark' ? <Sun className="size-3" /> : <Moon className="size-3" />}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
