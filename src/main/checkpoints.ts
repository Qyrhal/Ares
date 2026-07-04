import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

export interface Checkpoint {
  id: string
  index: number
  message: string
  date: string
  branch: string
}

/**
 * Git-based checkpoint system (inspired by Claude Code Desktop).
 *
 * Checkpoints are lightweight git stash entries with a descriptive message.
 * The flow is:
 *   createCheckpoint(cwd, msg) → git stash push -m "ares:msg"
 *   listCheckpoints(cwd)       → git stash list
 *   restoreCheckpoint(cwd, n)  → git stash pop stash@{n} or git stash drop
 *   diffCheckpoint(cwd, n)     → git stash show -p stash@{n}
 */

function git(cwd: string, args: string[], ignoreExit = false): string {
  const gitDir = findGitDir(cwd)
  try {
    return execSync(`git ${args.join(' ')}`, {
      cwd: gitDir || cwd,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      stdio: ignoreExit ? ['ignore', 'pipe', 'pipe'] : undefined,
    }).trim()
  } catch (e) {
    if (ignoreExit) return ''
    throw e
  }
}

function findGitDir(cwd: string): string | null {
  let dir = path.resolve(cwd || process.cwd())
  while (true) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

function hasRepo(cwd: string): boolean {
  return findGitDir(cwd) !== null
}

/**
 * Check if there are uncommitted changes worth checkpointing.
 */
function hasChanges(cwd: string): boolean {
  try {
    const status = git(cwd, ['status', '--porcelain'], false)
    return status.length > 0
  } catch {
    return false
  }
}

export function createCheckpoint(cwd: string, message: string): Checkpoint | null {
  if (!hasRepo(cwd)) return null
  if (!hasChanges(cwd)) return null

  const tag = `ares:${message}`
  // Stage everything first so stash includes untracked files
  git(cwd, ['add', '-A'], true)
  git(cwd, ['stash', 'push', '-u', '-m', tag], false)

  // Read back from stash list to get the index
  return parseStashList(cwd).find((c) => c.message === message) ?? null
}

export function listCheckpoints(cwd: string): Checkpoint[] {
  if (!hasRepo(cwd)) return []
  return parseStashList(cwd)
}

function parseStashList(cwd: string): Checkpoint[] {
  try {
    const raw = git(cwd, ['stash', 'list'], false)
    if (!raw) return []
    return raw.split('\n').filter(Boolean).map((line, i) => {
      // stash@{0}: On branch: message
      const m = line.match(/^stash@\{(\d+)\}:.*?:\s*(.*)$/)
      const branch = line.match(/On\s+(\S+)/)?.[1] ?? 'unknown'
      return {
        id: `stash@{${i}}`,
        index: i,
        message: m?.[2]?.replace(/^ares:/, '') ?? line,
        date: '', // stash list doesn't show dates. Use git stash list --date=relative
        branch,
      }
    })
  } catch {
    return []
  }
}

export function restoreCheckpoint(cwd: string, index: number): { ok: boolean; error?: string } {
  if (!hasRepo(cwd)) return { ok: false, error: 'Not a git repository' }
  try {
    // Pop the specific stash
    git(cwd, ['stash', 'pop', `stash@{${index}}`], false)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export function dropCheckpoint(cwd: string, index: number): { ok: boolean; error?: string } {
  if (!hasRepo(cwd)) return { ok: false, error: 'Not a git repository' }
  try {
    git(cwd, ['stash', 'drop', `stash@{${index}}`], false)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export function diffCheckpoint(cwd: string, index: number): string {
  if (!hasRepo(cwd)) return ''
  try {
    return git(cwd, ['stash', 'show', '-p', `stash@{${index}}`], false)
  } catch {
    return ''
  }
}
