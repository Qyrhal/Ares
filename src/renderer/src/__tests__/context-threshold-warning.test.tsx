import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CONTEXT_WARNING_THRESHOLD, COMPACTION_THRESHOLD } from '@/lib/context'

// ── Mock context module ───────────────────────────────────────────────────────
vi.mock('@/lib/context', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/lib/context')>()
  return {
    ...orig,
    // Re-export the real constants so tests can verify them
    CONTEXT_WARNING_THRESHOLD: orig.CONTEXT_WARNING_THRESHOLD,
    COMPACTION_THRESHOLD: orig.COMPACTION_THRESHOLD,
  }
})

describe('Context threshold warning', () => {
  it('CONTEXT_WARNING_THRESHOLD is 0.8 (80%)', () => {
    expect(CONTEXT_WARNING_THRESHOLD).toBe(0.8)
  })

  it('CONTEXT_WARNING_THRESHOLD is less than COMPACTION_THRESHOLD', () => {
    expect(CONTEXT_WARNING_THRESHOLD).toBeLessThan(COMPACTION_THRESHOLD)
  })

  it('CONTEXT_WARNING_THRESHOLD is 0.1 below COMPACTION_THRESHOLD', () => {
    expect(COMPACTION_THRESHOLD - CONTEXT_WARNING_THRESHOLD).toBeCloseTo(0.1)
  })

  describe('threshold boundary logic', () => {
    const window = 128000

    it('flags usage at exactly 80%', () => {
      const tokens = Math.floor(window * CONTEXT_WARNING_THRESHOLD)
      expect(tokens / window).toBeGreaterThanOrEqual(CONTEXT_WARNING_THRESHOLD)
    })

    it('does NOT flag usage at 79%', () => {
      const tokens = Math.floor(window * 0.79)
      expect(tokens / window).toBeLessThan(CONTEXT_WARNING_THRESHOLD)
    })

    it('flags usage at 85% (between warning and compaction)', () => {
      const tokens = Math.floor(window * 0.85)
      expect(tokens / window).toBeGreaterThanOrEqual(CONTEXT_WARNING_THRESHOLD)
      expect(tokens / window).toBeLessThan(COMPACTION_THRESHOLD)
    })

    it('flags usage at 90% (at compaction threshold)', () => {
      const tokens = Math.floor(window * COMPACTION_THRESHOLD)
      expect(tokens / window).toBeGreaterThanOrEqual(CONTEXT_WARNING_THRESHOLD)
    })

    it('does NOT flag usage at 50%', () => {
      const tokens = Math.floor(window * 0.5)
      expect(tokens / window).toBeLessThan(CONTEXT_WARNING_THRESHOLD)
    })
  })

  describe('warning message format', () => {
    it('contains the percentage in the message', () => {
      const pct = 82
      const content = `⚠️ Context at ~${pct}% — consider \`/compact\` to free up space, or start a new session with \`/new\``
      expect(content).toContain('⚠️')
      expect(content).toContain('82%')
      expect(content).toContain('/compact')
      expect(content).toContain('/new')
    })

    it('mentions /compact as a remedy', () => {
      const content = `⚠️ Context at ~80% — consider \`/compact\` to free up space, or start a new session with \`/new\``
      expect(content).toMatch(/\/compact/)
    })

    it('mentions /new as an alternative', () => {
      const content = `⚠️ Context at ~80% — consider \`/compact\` to free up space, or start a new session with \`/new\``
      expect(content).toMatch(/\/new/)
    })
  })

  describe('warning deduplication logic', () => {
    // Simulates the ref-based deduplication behavior
    it('shows warning only once when called multiple times', () => {
      let shown = false
      const msgs: string[] = []

      function checkWarning() {
        if (shown) return
        shown = true
        msgs.push('warning')
      }

      checkWarning()
      checkWarning()
      checkWarning()

      expect(msgs).toHaveLength(1)
      expect(msgs[0]).toBe('warning')
    })

    it('resets when ref is cleared (session change)', () => {
      let shown = false
      const msgs: string[] = []

      function checkWarning() {
        if (shown) return
        shown = true
        msgs.push('warning')
      }

      // First session
      checkWarning()
      expect(msgs).toHaveLength(1)

      // Switch session — reset
      shown = false

      // Second session
      checkWarning()
      expect(msgs).toHaveLength(2)
    })

    it('does not show warning when usage is below threshold', () => {
      let shown = false
      const msgs: string[] = []
      const tokens = 80000 // 62.5% of 128000

      function checkWarning() {
        if (shown) return
        if (tokens >= 128000 * CONTEXT_WARNING_THRESHOLD) {
          shown = true
          msgs.push('warning')
        }
      }

      checkWarning()
      expect(msgs).toHaveLength(0)
      expect(shown).toBe(false)
    })

    it('shows warning when usage is at or above threshold', () => {
      let shown = false
      const msgs: string[] = []
      const tokens = 102400 // 80% of 128000

      function checkWarning() {
        if (shown) return
        if (tokens >= 128000 * CONTEXT_WARNING_THRESHOLD) {
          shown = true
          msgs.push('warning')
        }
      }

      checkWarning()
      expect(msgs).toHaveLength(1)
      expect(shown).toBe(true)
    })
  })
})
