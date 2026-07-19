import { ChildProcess, execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'

/**
 * Lightweight LSP integration (inspired by OpenCode + Claude Code Desktop).
 *
 * Manages language server processes for code intelligence:
 * - Diagnostics relayed to the AI agent for context-aware coding
 * - Symbol lookup for go-to-definition (future)
 *
 * For each supported file extension, we spawn the appropriate LSP server
 * and forward diagnostics to the renderer.
 */

interface LspServer {
  name: string
  command: string
  args: string[]
  languages: string[]
  process: ChildProcess | null
}

interface Diagnostic {
  file: string
  line: number
  column: number
  message: string
  severity: 'error' | 'warning' | 'info'
  code?: string
}

type DiagnosticListener = (diagnostics: Diagnostic[]) => void

// Registry of well-known LSP servers (auto-detected)
const WELL_KNOWN_SERVERS: Omit<LspServer, 'process'>[] = [
  {
    name: 'typescript',
    command: 'node',
    args: [],
    languages: ['typescript', 'javascript'],
  },
  {
    name: 'eslint',
    command: 'npx',
    args: ['eslint', '--format', 'json', '--stdin', '--stdin-filename'],
    languages: ['typescript', 'javascript'],
  },
]

const activeServers = new Map<string, LspServer>()
const listeners = new Set<DiagnosticListener>()

function findLspServer(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase()
  const langMap: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.py': 'python',
    '.rs': 'rust',
    '.go': 'go',
    '.css': 'css',
    '.html': 'html',
    '.json': 'json',
    '.md': 'markdown',
    '.sh': 'bash',
  }
  return langMap[ext] ?? null
}

function findExecutable(name: string): string | null {
  try {
    const result = execFileSync('which', [name], { encoding: 'utf-8' }).trim()
    return result || null
  } catch {
    // Fallback for Windows
    try {
      const result = execFileSync('where', [name], { encoding: 'utf-8' }).trim()
      return result || null
    } catch {
      return null
    }
  }
}

/**
 * Try to start an LSP server for a given file.
 * Returns available diagnostics if the server starts, or empty list.
 */
export async function getDiagnostics(filePath: string): Promise<Diagnostic[]> {
  const lang = findLspServer(filePath)
  if (!lang) return []

  const results: Diagnostic[] = []

  // TypeScript: use tsc --noEmit for basic diagnostics
  if (lang === 'typescript' || lang === 'javascript') {
    try {
      const tscPath = findExecutable('npx')
      if (tscPath) {
        const projectDir = findProjectDir(filePath)
        if (projectDir && fs.existsSync(path.join(projectDir, 'tsconfig.json'))) {
          let out = ''
          try {
            out = execFileSync('npx', ['-s', 'tsc', '--noEmit', '--pretty', 'false'], {
              cwd: projectDir, encoding: 'utf-8', maxBuffer: 1024 * 1024, timeout: 30_000,
            })
          } catch (e: any) {
            // tsc exits non-zero when errors exist — output is on stdout
            out = e.stdout ?? ''
          }
          const lines = out.split('\n').filter(Boolean)
          for (const line of lines) {
            const m = line.match(/^(.+)\((\d+),(\d+)\):\s+(error|warning)\s+(.+)$/)
            if (m) {
              const relFile = path.resolve(projectDir, m[1].trim())
              if (relFile === path.resolve(filePath)) {
                results.push({
                  file: filePath,
                  line: parseInt(m[2], 10),
                  column: parseInt(m[3], 10),
                  message: m[5].trim(),
                  severity: m[4] === 'error' ? 'error' : 'warning',
                })
              }
            }
          }
        }
      }
    } catch {
      // tsc not available — skip
    }

    // ESLint diagnostics
    try {
      const eslintPath = findExecutable('npx')
      if (eslintPath && fs.existsSync(path.join(findProjectDir(filePath) || '', '.eslintrc'))) {
        const content = fs.readFileSync(filePath, 'utf-8')
        const relPath = path.relative(findProjectDir(filePath) || '', filePath)
        const out = execFileSync('npx', ['-s', 'eslint', '--format', 'json', '--stdin', '--stdin-filename', relPath], {
          cwd: findProjectDir(filePath) || '.', input: content, encoding: 'utf-8', maxBuffer: 1024 * 1024, timeout: 15_000,
        })
        const parsed = JSON.parse(out)
        if (Array.isArray(parsed)) {
          for (const fileResult of parsed) {
            for (const msg of fileResult.messages ?? []) {
              results.push({
                file: filePath,
                line: msg.line || 0,
                column: msg.column || 0,
                message: msg.message,
                severity: msg.severity === 2 ? 'error' : 'warning',
                code: msg.ruleId,
              })
            }
          }
        }
      }
    } catch {
      // eslint not available
    }
  }

  return results
}

function findProjectDir(filePath: string): string | null {
  let dir = path.dirname(path.resolve(filePath))
  while (true) {
    if (fs.existsSync(path.join(dir, 'package.json')) || fs.existsSync(path.join(dir, 'tsconfig.json'))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

export function subscribeDiagnostics(listener: DiagnosticListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function notifyDiagnostics(diagnostics: Diagnostic[]): void {
  for (const listener of listeners) {
    try { listener(diagnostics) } catch { /* ignore */ }
  }
}

export function cleanupLsp(): void {
  for (const [, server] of activeServers) {
    if (server.process) {
      try { server.process.kill() } catch { /* ignore */ }
    }
  }
  activeServers.clear()
}

/**
 * Check if any language server is available on this system.
 */
export function hasLspSupport(): boolean {
  const checks = [
    'npx',
    'node',
  ]
  return checks.some((cmd) => findExecutable(cmd) !== null)
}
