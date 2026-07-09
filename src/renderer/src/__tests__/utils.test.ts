import { describe, it, expect } from 'vitest'
import { isMermaidCodeBlock, looksLikeJson } from '../lib/utils'

describe('isMermaidCodeBlock', () => {
  it('detects a hljs language-mermaid class', () => {
    expect(isMermaidCodeBlock('hljs language-mermaid')).toBe(true)
  })

  it('detects a bare language-mermaid class', () => {
    expect(isMermaidCodeBlock('language-mermaid')).toBe(true)
  })

  it('returns false for other languages', () => {
    expect(isMermaidCodeBlock('hljs language-typescript')).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isMermaidCodeBlock(undefined)).toBe(false)
  })

  it('does not false-positive on a substring match', () => {
    expect(isMermaidCodeBlock('language-mermaidx')).toBe(false)
  })
})

describe('looksLikeJson', () => {
  it('detects a valid JSON object', () => {
    expect(looksLikeJson('{"a": 1}')).toBe(true)
  })

  it('detects a valid JSON array', () => {
    expect(looksLikeJson('[1, 2, 3]')).toBe(true)
  })

  it('tolerates surrounding whitespace', () => {
    expect(looksLikeJson('  {"a": 1}  \n')).toBe(true)
  })

  it('returns false for plain text', () => {
    expect(looksLikeJson('hello world')).toBe(false)
  })

  it('returns false for malformed JSON-looking text', () => {
    expect(looksLikeJson('{a: 1,}')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(looksLikeJson('')).toBe(false)
  })
})
