import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import {
  ChevronRight, File, FileCode, FileJson, FileText,
  FilePlus, FolderClosed, FolderOpen, FolderPlus, FolderOpen as FolderOpenIcon,
  Pencil, Trash2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { FileNode } from '@/types'
import { ContextMenu, ContextMenuEntry } from './ui/context-menu'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CreateState { type: 'file' | 'folder'; parentPath: string }
interface RenameState { path: string; name: string }

interface OpsCtx {
  creating: CreateState | null
  setCreating: (s: CreateState | null) => void
  renaming: RenameState | null
  setRenaming: (s: RenameState | null) => void
  // Paths that must be forcibly expanded (e.g. when creating inside a collapsed dir)
  forceExpandPaths: ReadonlySet<string>
  forceExpand: (path: string) => void
  showCtxMenu: (e: React.MouseEvent, node: FileNode | null) => void
  doCreateFile: (parentPath: string, name: string) => Promise<void>
  doCreateFolder: (parentPath: string, name: string) => Promise<void>
  doRename: (oldPath: string, newName: string) => Promise<void>
  doDelete: (node: FileNode) => Promise<void>
}

const OpsCtx = createContext<OpsCtx | null>(null)
const useOps = (): OpsCtx => useContext(OpsCtx)!

// ── Icon map ──────────────────────────────────────────────────────────────────

const EXT_ICONS: Record<string, React.FC<{ className?: string }>> = {
  ts: FileCode, tsx: FileCode, js: FileCode, jsx: FileCode,
  py: FileCode, go: FileCode, rs: FileCode, cpp: FileCode, c: FileCode,
  json: FileJson, jsonc: FileJson,
  md: FileText, txt: FileText, csv: FileText,
}

function fileIconFor(name: string): React.FC<{ className?: string }> {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return EXT_ICONS[ext] ?? File
}

// ── InlineInput ───────────────────────────────────────────────────────────────

function InlineInput({
  defaultValue = '',
  placeholder,
  depth,
  icon,
  onConfirm,
  onCancel,
}: {
  defaultValue?: string
  placeholder: string
  depth: number
  icon: React.ReactNode
  onConfirm: (name: string) => void
  onCancel: () => void
}): React.ReactElement {
  const [value, setValue] = useState(defaultValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    if (defaultValue) inputRef.current?.select()
  }, [])

  const confirm = (): void => {
    const trimmed = value.trim()
    if (trimmed) onConfirm(trimmed)
    else onCancel()
  }

  return (
    <div
      className="flex items-center gap-1.5 py-[3px] pr-2"
      style={{ paddingLeft: `${8 + depth * 12}px` }}
    >
      <span className="w-3 shrink-0" />
      {icon}
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); confirm() }
          if (e.key === 'Escape') { e.preventDefault(); onCancel() }
        }}
        onBlur={onCancel}
        placeholder={placeholder}
        className="flex-1 min-w-0 rounded border border-primary bg-input px-1.5 py-0.5 text-xs text-foreground outline-none"
      />
    </div>
  )
}

// ── TreeNode ──────────────────────────────────────────────────────────────────

function TreeNode({
  node,
  depth,
  onOpenFile,
}: {
  node: FileNode
  depth: number
  onOpenFile: (n: FileNode) => void
}): React.ReactElement {
  const [expanded, setExpanded] = useState(depth < 1)
  const {
    creating, setCreating, renaming, setRenaming,
    forceExpandPaths, forceExpand, showCtxMenu,
    doCreateFile, doCreateFolder, doRename, doDelete,
  } = useOps()
  const isDir = node.type === 'directory'
  const Icon = isDir ? (expanded ? FolderOpen : FolderClosed) : fileIconFor(node.name)
  const isRenaming = renaming?.path === node.path
  const isCreatingInside = isDir && creating?.parentPath === node.path

  // Respond to programmatic expand requests (e.g. from context menu)
  useEffect(() => {
    if (isDir && forceExpandPaths.has(node.path)) setExpanded(true)
  }, [forceExpandPaths])

  if (isRenaming) {
    return (
      <div>
        <InlineInput
          defaultValue={node.name}
          placeholder={isDir ? 'folder name' : 'file name'}
          depth={depth}
          icon={<Icon className={cn('size-3.5 shrink-0', isDir ? 'text-amber-400/80' : 'text-blue-400/70')} />}
          onConfirm={(newName) => {
            setRenaming(null)
            if (newName !== node.name) doRename(node.path, newName)
          }}
          onCancel={() => setRenaming(null)}
        />
        {isDir && expanded && node.children?.map((child) => (
          <TreeNode key={child.path} node={child} depth={depth + 1} onOpenFile={onOpenFile} />
        ))}
      </div>
    )
  }

  return (
    <div>
      <div
        className="group relative flex items-center"
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); showCtxMenu(e, node) }}
      >
        <button
          onClick={() => { if (isDir) setExpanded((v) => !v); else onOpenFile(node) }}
          style={{ paddingLeft: `${8 + depth * 12}px` }}
          className={cn(
            'flex flex-1 items-center gap-1.5 py-[3px] pr-1 text-left text-xs transition-colors',
            isDir
              ? 'text-muted-foreground hover:text-foreground'
              : 'text-foreground/80 hover:bg-accent/50 hover:text-foreground rounded-sm'
          )}
        >
          {isDir
            ? <ChevronRight className={cn('size-3 shrink-0 transition-transform', expanded && 'rotate-90')} />
            : <span className="w-3" />
          }
          <Icon className={cn('size-3.5 shrink-0', isDir ? 'text-amber-400/80' : 'text-blue-400/70')} />
          <span className="truncate">{node.name}</span>
        </button>

        {/* Hover actions */}
        <div className="absolute right-1 hidden items-center gap-0 group-hover:flex bg-card rounded">
          {isDir && (
            <>
              <button
                title="New file"
                onClick={(e) => {
                  e.stopPropagation()
                  forceExpand(node.path)
                  setCreating({ type: 'file', parentPath: node.path })
                  setRenaming(null)
                }}
                className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <FilePlus className="size-3" />
              </button>
              <button
                title="New folder"
                onClick={(e) => {
                  e.stopPropagation()
                  forceExpand(node.path)
                  setCreating({ type: 'folder', parentPath: node.path })
                  setRenaming(null)
                }}
                className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <FolderPlus className="size-3" />
              </button>
            </>
          )}
          <button
            title="Rename"
            onClick={(e) => {
              e.stopPropagation()
              setRenaming({ path: node.path, name: node.name })
              setCreating(null)
            }}
            className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Pencil className="size-3" />
          </button>
          <button
            title="Delete"
            onClick={(e) => {
              e.stopPropagation()
              if (window.confirm(`Delete "${node.name}"?`)) doDelete(node)
            }}
            className="rounded p-0.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>

      {isDir && expanded && (
        <div>
          {isCreatingInside && (
            <InlineInput
              placeholder={creating!.type === 'file' ? 'filename.tsx' : 'folder name'}
              depth={depth + 1}
              icon={
                creating!.type === 'file'
                  ? <File className="size-3.5 shrink-0 text-blue-400/70" />
                  : <FolderClosed className="size-3.5 shrink-0 text-amber-400/80" />
              }
              onConfirm={(name) => {
                const t = creating!.type
                setCreating(null)
                if (t === 'file') doCreateFile(node.path, name)
                else doCreateFolder(node.path, name)
              }}
              onCancel={() => setCreating(null)}
            />
          )}
          {node.children?.map((child) => (
            <TreeNode key={child.path} node={child} depth={depth + 1} onOpenFile={onOpenFile} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── FileTree (public) ─────────────────────────────────────────────────────────

export interface FileTreeProps {
  nodes: FileNode[]
  workspacePath: string | null
  onOpenFile: (node: FileNode) => void
  onOpenFolder: () => void
  onCreateFile: (parentPath: string, name: string) => Promise<void>
  onCreateFolder: (parentPath: string, name: string) => Promise<void>
  onRename: (oldPath: string, newName: string) => Promise<void>
  onDelete: (node: FileNode) => Promise<void>
}

export function FileTree({
  nodes, workspacePath, onOpenFile, onOpenFolder,
  onCreateFile, onCreateFolder, onRename, onDelete,
}: FileTreeProps): React.ReactElement {
  const [creating, setCreating] = useState<CreateState | null>(null)
  const [renaming, setRenaming] = useState<RenameState | null>(null)
  const [forceExpandPaths, setForceExpandPaths] = useState<ReadonlySet<string>>(new Set())
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; node: FileNode | null } | null>(null)

  const forceExpand = (path: string): void =>
    setForceExpandPaths((prev) => new Set([...prev, path]))

  const showCtxMenu = (e: React.MouseEvent, node: FileNode | null): void => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY, node })
  }

  // Build context menu entries based on what was right-clicked
  const buildEntries = (node: FileNode | null): ContextMenuEntry[] => {
    const parentPath = node?.path ?? workspacePath ?? '/'

    if (!node) {
      // Right-clicked on blank tree area
      return [
        {
          label: 'New file',
          icon: <FilePlus className="size-3.5" />,
          onClick: () => { setCreating({ type: 'file', parentPath }); setRenaming(null) },
        },
        {
          label: 'New folder',
          icon: <FolderPlus className="size-3.5" />,
          onClick: () => { setCreating({ type: 'folder', parentPath }); setRenaming(null) },
        },
      ]
    }

    if (node.type === 'directory') {
      return [
        {
          label: 'New file',
          icon: <FilePlus className="size-3.5" />,
          onClick: () => { forceExpand(node.path); setCreating({ type: 'file', parentPath: node.path }); setRenaming(null) },
        },
        {
          label: 'New folder',
          icon: <FolderPlus className="size-3.5" />,
          onClick: () => { forceExpand(node.path); setCreating({ type: 'folder', parentPath: node.path }); setRenaming(null) },
        },
        { separator: true as const },
        {
          label: 'Rename',
          icon: <Pencil className="size-3.5" />,
          onClick: () => { setRenaming({ path: node.path, name: node.name }); setCreating(null) },
        },
        { separator: true as const },
        {
          label: 'Delete',
          icon: <Trash2 className="size-3.5" />,
          destructive: true,
          onClick: () => { if (window.confirm(`Delete "${node.name}"?`)) onDelete(node) },
        },
      ]
    }

    // File node
    return [
      {
        label: 'Open',
        icon: <File className="size-3.5" />,
        onClick: () => onOpenFile(node),
      },
      { separator: true as const },
      {
        label: 'Rename',
        icon: <Pencil className="size-3.5" />,
        onClick: () => { setRenaming({ path: node.path, name: node.name }); setCreating(null) },
      },
      { separator: true as const },
      {
        label: 'Delete',
        icon: <Trash2 className="size-3.5" />,
        destructive: true,
        onClick: () => { if (window.confirm(`Delete "${node.name}"?`)) onDelete(node) },
      },
    ]
  }

  const ctx: OpsCtx = {
    creating, setCreating,
    renaming, setRenaming,
    forceExpandPaths, forceExpand,
    showCtxMenu,
    doCreateFile: onCreateFile,
    doCreateFolder: onCreateFolder,
    doRename: onRename,
    doDelete: onDelete,
  }

  if (!workspacePath) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
        <FolderPlus className="size-10 text-muted-foreground/30" />
        <div>
          <p className="text-xs font-medium text-foreground">No folder open</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Open a folder to browse files.</p>
        </div>
        <button
          onClick={onOpenFolder}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors"
        >
          Open folder
        </button>
      </div>
    )
  }

  const isCreatingAtRoot = creating?.parentPath === workspacePath

  return (
    <OpsCtx.Provider value={ctx}>
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {workspacePath.split('/').pop()}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              title="New file"
              onClick={() => { setCreating({ type: 'file', parentPath: workspacePath }); setRenaming(null) }}
              className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <FilePlus className="size-3.5" />
            </button>
            <button
              title="New folder"
              onClick={() => { setCreating({ type: 'folder', parentPath: workspacePath }); setRenaming(null) }}
              className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <FolderPlus className="size-3.5" />
            </button>
            <button
              title="Open another folder"
              onClick={onOpenFolder}
              className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <FolderOpenIcon className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Tree — right-click on blank area */}
        <div
          className="flex-1 overflow-y-auto py-1"
          onContextMenu={(e) => {
            if (e.target === e.currentTarget) showCtxMenu(e, null)
          }}
        >
          {isCreatingAtRoot && (
            <InlineInput
              placeholder={creating!.type === 'file' ? 'filename.tsx' : 'folder name'}
              depth={0}
              icon={
                creating!.type === 'file'
                  ? <File className="size-3.5 shrink-0 text-blue-400/70" />
                  : <FolderClosed className="size-3.5 shrink-0 text-amber-400/80" />
              }
              onConfirm={(name) => {
                const t = creating!.type
                setCreating(null)
                if (t === 'file') onCreateFile(workspacePath, name)
                else onCreateFolder(workspacePath, name)
              }}
              onCancel={() => setCreating(null)}
            />
          )}
          {nodes.length === 0 && !isCreatingAtRoot
            ? <p className="px-4 py-4 text-xs text-muted-foreground">Empty folder</p>
            : nodes.map((n) => (
                <TreeNode key={n.path} node={n} depth={0} onOpenFile={onOpenFile} />
              ))
          }
        </div>
      </div>

      {/* Context menu portal */}
      {ctxMenu && (
        <ContextMenu
          entries={buildEntries(ctxMenu.node)}
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </OpsCtx.Provider>
  )
}
