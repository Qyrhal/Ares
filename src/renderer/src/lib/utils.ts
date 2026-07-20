import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  if (m > 0) return `${m}m ago`
  return 'just now'
}

export function truncate(str: string, n: number): string {
  return str.length > n ? str.slice(0, n) + '…' : str
}

export function formatDuration(startMs: number, endMs: number): string {
  const diff = Math.max(0, endMs - startMs)
  const totalMin = Math.floor(diff / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  const s = Math.floor(diff / 1000)
  return s > 0 ? `${s}s` : '<1m'
}

export function isMermaidCodeBlock(className: string | undefined): boolean {
  return /(?:^|\s)language-mermaid(?:\s|$)/.test(className ?? '')
}

export function looksLikeJson(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  const first = trimmed[0]
  const last = trimmed[trimmed.length - 1]
  if (!((first === '{' && last === '}') || (first === '[' && last === ']'))) return false
  try {
    JSON.parse(trimmed)
    return true
  } catch {
    return false
  }
}
