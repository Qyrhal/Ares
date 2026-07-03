import React, { useState, useCallback } from 'react'
import {
  FolderOpen, FolderClosed, FolderPlus,
  FileCode, FileText, FileJson, File, ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { FileNode } from '@/types'

interface FileTreeProps {
  nodes: FileNode[]
  workspacePath: string | null
  onOpenFile: (node: FileNode) => void
  onOpenFolder: () => void
}

const EXT_ICONS: Record<string, React.FC<{ className?: string }>> = {
  ts: FileCode, tsx: FileCode, js: FileCode, jsx: FileCode,
  py: FileCode, go: FileCode, rs: FileCode, cpp: FileCode, c: FileCode,
  json: FileJson, jsonc: FileJson,
  md: FileText, txt: FileText, csv: FileText,
}

function fileIcon(name: string): React.FC<{ className?: string }> {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return EXT_ICONS[ext] ?? File
}

function TreeNode({
  node, depth, onOpenFile
}: {
  node: FileNode; depth: number; onOpenFile: (n: FileNode) => void
}): React.ReactElement {
  const [expanded, setExpanded] = useState(depth < 1)
  const isDir = node.type === 'directory'
  const Icon = isDir
    ? (expanded ? FolderOpen : FolderClosed)
    : fileIcon(node.name)

  const handleClick = (): void => {
    if (isDir) setExpanded((v) => !v)
    else onOpenFile(node)
  }

  return (
    <div>
      <button
        onClick={handleClick}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        className={cn(
          'group flex w-full items-center gap-1.5 py-[3px] pr-2 text-left text-xs transition-colors',
          isDir
            ? 'text-muted-foreground hover:text-foreground'
            : 'text-foreground/80 hover:bg-accent/50 hover:text-foreground rounded-sm'
        )}
      >
        {isDir && (
          <ChevronRight
            className={cn('size-3 shrink-0 transition-transform', expanded && 'rotate-90')}
          />
        )}
        {!isDir && <span className="w-3" />}
        <Icon className={cn('size-3.5 shrink-0', isDir ? 'text-amber-400/80' : 'text-blue-400/70')} />
        <span className="truncate">{node.name}</span>
      </button>

      {isDir && expanded && node.children && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.path} node={child} depth={depth + 1} onOpenFile={onOpenFile} />
          ))}
        </div>
      )}
    </div>
  )
}

export function FileTree({ nodes, workspacePath, onOpenFile, onOpenFolder }: FileTreeProps): React.ReactElement {
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

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Workspace header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {workspacePath.split('/').pop()}
        </span>
        <button
          onClick={onOpenFolder}
          title="Open another folder"
          className="text-muted-foreground hover:text-foreground"
        >
          <FolderOpen className="size-3.5" />
        </button>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {nodes.length === 0
          ? <p className="px-4 py-4 text-xs text-muted-foreground">Empty folder</p>
          : nodes.map((n) => (
              <TreeNode key={n.path} node={n} depth={0} onOpenFile={onOpenFile} />
            ))
        }
      </div>
    </div>
  )
}
