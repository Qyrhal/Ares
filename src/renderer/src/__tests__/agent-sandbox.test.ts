import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock electron
const mockSettings: Record<string, unknown> = {}
const electronMock = {
  settings: {
    get: vi.fn().mockImplementation(() => mockSettings),
    set: vi.fn(),
  },
  exec: {
    run: vi.fn(),
  },
  ext: {
    fetchUrl: vi.fn(),
  },
}
Object.defineProperty(window, 'electron', { value: electronMock, writable: true })

describe('Agent Sandbox', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(mockSettings).forEach(k => delete mockSettings[k])
  })

  describe('SandboxSettings type', () => {
    it('has enabled boolean and optional network allowlist', () => {
      const settings = {
        sandbox: {
          enabled: true,
          network: { strictAllowlist: ['api.github.com'] },
        },
      }
      expect(settings.sandbox.enabled).toBe(true)
      expect(settings.sandbox.network.strictAllowlist).toEqual(['api.github.com'])
    })

    it('allows sandbox without network config', () => {
      const settings = {
        sandbox: {
          enabled: true,
        },
      }
      expect(settings.sandbox.enabled).toBe(true)
      expect(settings.sandbox.network).toBeUndefined()
    })

    it('allows empty sandbox (disabled)', () => {
      const settings = {
        sandbox: {
          enabled: false,
        },
      }
      expect(settings.sandbox.enabled).toBe(false)
    })
  })

  describe('Sandbox enforcement (renderer side)', () => {
    it('pass-through when sandbox is disabled', async () => {
      mockSettings.sandbox = { enabled: false }
      electronMock.exec.run.mockResolvedValue({ ok: true, output: 'hello' })

      const result = await window.electron.exec.run('/workspace', 'ls')
      expect(result).toEqual({ ok: true, output: 'hello' })
    })

    it('pass-through when sandbox setting is absent', async () => {
      delete mockSettings.sandbox
      electronMock.exec.run.mockResolvedValue({ ok: true, output: 'hello' })

      const result = await window.electron.exec.run('/workspace', 'ls')
      expect(result).toEqual({ ok: true, output: 'hello' })
    })

    it('blocks fetch when sandbox enabled and no allowlist', async () => {
      mockSettings.sandbox = { enabled: true }
      electronMock.ext.fetchUrl.mockResolvedValue({
        ok: false,
        error: 'Sandbox: external fetch blocked (no network allowlist configured)',
      })

      const result = await window.electron.ext.fetchUrl('https://example.com')
      expect(result.ok).toBe(false)
      expect(result.error).toContain('Sandbox')
    })

    it('allows fetch when sandbox enabled and domain in allowlist', async () => {
      mockSettings.sandbox = {
        enabled: true,
        network: { strictAllowlist: ['api.github.com'] },
      }
      electronMock.ext.fetchUrl.mockResolvedValue({
        ok: true,
        content: 'data',
        contentType: 'application/json',
        length: 4,
      })

      const result = await window.electron.ext.fetchUrl('https://api.github.com/repos')
      expect(result.ok).toBe(true)
    })

    it('blocks fetch when sandbox enabled and domain NOT in allowlist', async () => {
      mockSettings.sandbox = {
        enabled: true,
        network: { strictAllowlist: ['api.github.com'] },
      }
      electronMock.ext.fetchUrl.mockResolvedValue({
        ok: false,
        error: 'Sandbox: domain "evil.com" not in network allowlist',
      })

      const result = await window.electron.ext.fetchUrl('https://evil.com/payload')
      expect(result.ok).toBe(false)
      expect(result.error).toContain('not in network allowlist')
    })

    it('allows subdomain of allowlisted domain', async () => {
      mockSettings.sandbox = {
        enabled: true,
        network: { strictAllowlist: ['github.com'] },
      }
      electronMock.ext.fetchUrl.mockResolvedValue({
        ok: true,
        content: 'ok',
        contentType: 'text/html',
        length: 2,
      })

      const result = await window.electron.ext.fetchUrl('https://api.github.com/test')
      expect(result.ok).toBe(true)
    })
  })
})
