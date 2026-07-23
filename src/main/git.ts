import { execFile } from 'child_process'
import { promisify } from 'util'
import { sanitizeEnv } from './env-filter'

const run = promisify(execFile)

async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await run('git', args, { cwd, env: sanitizeEnv({ GIT_TERMINAL_PROMPT: '0' }) })
  return stdout.trim()
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GitFile {
  path: string
  originalPath?: string
  index: string   // staged status char
  working: string // working-tree status char
}

export interface GitStatus {
  hasRepo: boolean
  branch: string
  upstream: string | null
  ahead: number
  behind: number
  staged: GitFile[]
  unstaged: GitFile[]
  untracked: GitFile[]
}

export interface GitCommit {
  hash: string
  shortHash: string
  parents: string[]
  author: string
  date: string
  message: string
}

export interface GitBranches {
  local: string[]
  current: string
}

// ── Status ────────────────────────────────────────────────────────────────────

export async function getStatus(cwd: string): Promise<GitStatus> {
  const empty: GitStatus = {
    hasRepo: false, branch: '', upstream: null,
    ahead: 0, behind: 0, staged: [], unstaged: [], untracked: []
  }
  try {
    await git(['rev-parse', '--is-inside-work-tree'], cwd)
  } catch {
    return empty
  }

  try {
    const raw = await git(['status', '--porcelain=v1', '-b', '-u'], cwd)
    const lines = raw.split('\n')

    let branch = '', upstream: string | null = null, ahead = 0, behind = 0
    const staged: GitFile[] = [], unstaged: GitFile[] = [], untracked: GitFile[] = []

    for (const line of lines) {
      if (line.startsWith('## ')) {
        const info = line.slice(3)
        const dots = info.indexOf('...')
        branch = dots !== -1 ? info.slice(0, dots) : info.replace(/ .*/, '')
        if (dots !== -1) {
          const rest = info.slice(dots + 3)
          upstream = rest.replace(/ .*/, '') || null
          const a = info.match(/ahead (\d+)/)
          const b = info.match(/behind (\d+)/)
          if (a) ahead = parseInt(a[1])
          if (b) behind = parseInt(b[1])
        }
        continue
      }
      if (line.length < 4) continue

      const x = line[0], y = line[1]
      let path = line.slice(3)
      let originalPath: string | undefined

      // Handle renames: "old -> new"
      if (x === 'R' || x === 'C') {
        const arrow = path.indexOf(' -> ')
        if (arrow !== -1) {
          originalPath = path.slice(0, arrow)
          path = path.slice(arrow + 4)
        }
      }

      const file: GitFile = { path, originalPath, index: x, working: y }

      if (x === '?' && y === '?') {
        untracked.push(file)
      } else {
        if (x !== ' ' && x !== '?') staged.push({ ...file })
        if (y !== ' ' && y !== '?') unstaged.push({ ...file })
      }
    }

    return { hasRepo: true, branch, upstream, ahead, behind, staged, unstaged, untracked }
  } catch {
    return { ...empty, hasRepo: true }
  }
}

// ── Staging ───────────────────────────────────────────────────────────────────

export async function stageFile(cwd: string, filePath: string): Promise<void> {
  await git(['add', '--', filePath], cwd)
}

export async function unstageFile(cwd: string, filePath: string): Promise<void> {
  await git(['restore', '--staged', '--', filePath], cwd)
}

export async function stageAll(cwd: string): Promise<void> {
  await git(['add', '-A'], cwd)
}

export async function unstageAll(cwd: string): Promise<void> {
  await git(['restore', '--staged', '.'], cwd)
}

export async function discardFile(cwd: string, filePath: string): Promise<void> {
  // Works for tracked files; for untracked, delete them
  try {
    await git(['checkout', '--', filePath], cwd)
  } catch {
    await git(['clean', '-f', '--', filePath], cwd)
  }
}

// ── Commit ────────────────────────────────────────────────────────────────────

export async function commit(cwd: string, message: string): Promise<void> {
  await git(['commit', '-m', message], cwd)
}

// ── Remote ────────────────────────────────────────────────────────────────────

export async function push(cwd: string): Promise<string> {
  try {
    const { stdout, stderr } = await run('git', ['push'], {
      cwd, env: sanitizeEnv({ GIT_TERMINAL_PROMPT: '0' })
    })
    return (stdout + stderr).trim()
  } catch (e: unknown) {
    const err = e as { stderr?: string; message?: string }
    throw new Error(err.stderr ?? err.message ?? 'Push failed')
  }
}

export async function pull(cwd: string): Promise<string> {
  try {
    const { stdout, stderr } = await run('git', ['pull'], {
      cwd, env: sanitizeEnv({ GIT_TERMINAL_PROMPT: '0' })
    })
    return (stdout + stderr).trim()
  } catch (e: unknown) {
    const err = e as { stderr?: string; message?: string }
    throw new Error(err.stderr ?? err.message ?? 'Pull failed')
  }
}

// ── Log / History ─────────────────────────────────────────────────────────────

export async function getLog(cwd: string, maxCount = 50): Promise<GitCommit[]> {
  const raw = await git([
    'log', '--all', `--max-count=${maxCount}`,
    '--format=%H%n%h%n%P%n%an%n%aI%n%s%n---',
  ], cwd)
  const commits: GitCommit[] = []
  for (const entry of raw.split('\n---\n')) {
    const lines = entry.trim().split('\n')
    if (lines.length < 6) continue
    commits.push({
      hash: lines[0],
      shortHash: lines[1],
      parents: lines[2] ? lines[2].split(' ') : [],
      author: lines[3],
      date: lines[4],
      message: lines[5],
    })
  }
  return commits
}

// ── Branches ──────────────────────────────────────────────────────────────────

export async function getBranches(cwd: string): Promise<GitBranches> {
  const raw = await git(['branch', '--format=%(refname:short)%(HEAD)'], cwd)
  const local: string[] = []
  let current = ''
  for (const line of raw.split('\n')) {
    if (!line) continue
    if (line.endsWith('*')) {
      current = line.slice(0, -1)
      local.push(current)
    } else {
      local.push(line)
    }
  }
  // Fallback: current might come from status
  if (!current) {
    try { current = await git(['branch', '--show-current'], cwd) } catch {}
  }
  return { local, current }
}

export async function checkoutBranch(cwd: string, branch: string): Promise<void> {
  await git(['checkout', branch], cwd)
}

export async function createBranch(cwd: string, branch: string): Promise<void> {
  await git(['checkout', '-b', branch], cwd)
}

// ── Diff ──────────────────────────────────────────────────────────────────────

export async function getFileDiff(cwd: string, filePath: string, staged: boolean): Promise<string> {
  try {
    const args = staged
      ? ['diff', '--staged', '--', filePath]
      : ['diff', '--', filePath]
    return await git(args, cwd)
  } catch {
    return ''
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

export async function initRepo(cwd: string): Promise<void> {
  await git(['init'], cwd)
}
