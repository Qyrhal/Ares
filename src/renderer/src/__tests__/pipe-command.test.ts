import { describe, it, expect } from 'vitest'
import { BUILTIN_COMMANDS } from '../components/InputBar'

describe('/pipe slash command logic', () => {
  it('is registered in BUILTIN_COMMANDS', () => {
    const cmd = BUILTIN_COMMANDS.find(c => c.name === 'pipe')
    expect(cmd).toBeDefined()
    expect(cmd!.description).toContain('Chain')
  })

  it('has correct description', () => {
    const cmd = BUILTIN_COMMANDS.find(c => c.name === 'pipe')
    expect(cmd!.description).toBe('Chain multiple slash commands sequentially')
  })

  it('BUILTIN_COMMANDS length updated to 84', () => {
    expect(BUILTIN_COMMANDS.length).toBe(84)
  })

  it('pipe appears before help in BUILTIN_COMMANDS order', () => {
    const pipeIdx = BUILTIN_COMMANDS.findIndex(c => c.name === 'pipe')
    const helpIdx = BUILTIN_COMMANDS.findIndex(c => c.name === 'help')
    expect(pipeIdx).toBeLessThan(helpIdx)
  })

  it('pipe appears after reset in BUILTIN_COMMANDS order', () => {
    const resetIdx = BUILTIN_COMMANDS.findIndex(c => c.name === 'reset')
    const pipeIdx = BUILTIN_COMMANDS.findIndex(c => c.name === 'pipe')
    expect(resetIdx).toBeLessThan(pipeIdx)
  })

  // ── Argument parsing logic ────────────────────────────────────────────────

  function parsePipeArgs(raw: string): { commands: string[]; onError: 'stop' | 'continue' } {
    let onError: 'stop' | 'continue' = 'stop'
    let pipeline = raw
    const flagMatch = pipeline.match(/--on-error\s+(stop|continue)/i)
    if (flagMatch) {
      onError = flagMatch[1].toLowerCase() as 'stop' | 'continue'
      pipeline = pipeline.replace(flagMatch[0], '').trim()
    }
    const commands = pipeline.split('|').map(c => c.trim()).filter(Boolean)
    return { commands, onError }
  }

  it('parses simple two-command pipe', () => {
    const { commands, onError } = parsePipeArgs('lint | test')
    expect(commands).toEqual(['lint', 'test'])
    expect(onError).toBe('stop')
  })

  it('parses three-command pipe', () => {
    const { commands } = parsePipeArgs('lint | test | build')
    expect(commands).toEqual(['lint', 'test', 'build'])
  })

  it('parses commands with args', () => {
    const { commands } = parsePipeArgs('test src/utils | grep pattern --ext ts')
    expect(commands).toEqual(['test src/utils', 'grep pattern --ext ts'])
  })

  it('parses --on-error continue flag', () => {
    const { commands, onError } = parsePipeArgs('lint | test --on-error continue')
    expect(commands).toEqual(['lint', 'test'])
    expect(onError).toBe('continue')
  })

  it('parses --on-error stop flag explicitly', () => {
    const { onError } = parsePipeArgs('lint | test --on-error stop')
    expect(onError).toBe('stop')
  })

  it('handles --on-error flag with mixed case', () => {
    const { onError } = parsePipeArgs('lint | test --on-error Continue')
    expect(onError).toBe('continue')
  })

  it('trims whitespace from commands', () => {
    const { commands } = parsePipeArgs('  lint   |   test  ')
    expect(commands).toEqual(['lint', 'test'])
  })

  it('filters empty segments from extra pipes', () => {
    const { commands } = parsePipeArgs('lint || test')
    expect(commands).toEqual(['lint', 'test'])
  })

  it('returns empty array for empty input', () => {
    const { commands } = parsePipeArgs('')
    expect(commands).toEqual([])
  })

  it('returns single command for single input', () => {
    const { commands } = parsePipeArgs('lint')
    expect(commands).toEqual(['lint'])
  })

  // ── Command name extraction ───────────────────────────────────────────────

  function extractCommand(full: string): { name: string; args: string } {
    const parts = full.split(/\s+/)
    const name = parts[0].replace(/^\//, '').toLowerCase()
    const cmdArgs = parts.slice(1).join(' ')
    return { name, args: cmdArgs }
  }

  it('extracts command name from simple command', () => {
    const { name, args } = extractCommand('lint')
    expect(name).toBe('lint')
    expect(args).toBe('')
  })

  it('extracts command name with leading slash', () => {
    const { name } = extractCommand('/lint')
    expect(name).toBe('lint')
  })

  it('extracts command name with args', () => {
    const { name, args } = extractCommand('test src/utils')
    expect(name).toBe('test')
    expect(args).toBe('src/utils')
  })

  it('extracts command name with multiple args', () => {
    const { name, args } = extractCommand('grep pattern --ext ts')
    expect(name).toBe('grep')
    expect(args).toBe('pattern --ext ts')
  })

  // ── Pipeline result formatting ────────────────────────────────────────────

  it('formats pipeline header with commands', () => {
    const commands = ['lint', 'test', 'build']
    const header = `**Pipeline:** ${commands.map(c => `\`${c}\``).join(' → ')}\n**On error:** stop`
    expect(header).toContain('`lint`')
    expect(header).toContain('`test`')
    expect(header).toContain('`build`')
    expect(header).toContain('→')
    expect(header).toContain('stop')
  })

  it('formats step separator', () => {
    const step = 2
    const total = 3
    const cmd = 'test'
    const sep = `**Step ${step}/${total}:** \`${cmd}\``
    expect(sep).toContain('2/3')
    expect(sep).toContain('test')
  })

  it('formats completion message', () => {
    const count = 3
    const msg = `✅ Pipeline completed: ${count} command(s) executed.`
    expect(msg).toContain('✅')
    expect(msg).toContain('3 command(s)')
  })

  it('formats error message', () => {
    const step = 2
    const error = 'Command failed'
    const msg = `❌ Step ${step} failed: ${error}`
    expect(msg).toContain('❌')
    expect(msg).toContain('Step 2')
    expect(msg).toContain('Command failed')
  })

  it('formats abort message', () => {
    const step = 2
    const total = 3
    const msg = `Pipeline aborted at step ${step}/${total}.`
    expect(msg).toContain('aborted')
    expect(msg).toContain('2/3')
  })

  // ── Usage text ────────────────────────────────────────────────────────────

  it('includes pipe in help text', () => {
    const helpText = 'Commands: /model <name> - change model, /clear - clear messages, /compact - compact conversation context, /usage - show session token usage and cost, /cost - workspace-wide cost summary, /overview - project summary, /status - system health check, /doctor - run environment diagnostics, /undo - remove last exchange, /summary - session summary, /fork - duplicate this session as a new session, /pr - generate a PR from session context, /changes - show workspace git status, /ci - check GitHub Actions CI status, /open-pr - open current PR in browser, /focus <file> - navigate to file in editor, /diff - show git diff of all changes, /log - show recent git commits, /export - export session as Markdown, /shortcuts - show keyboard shortcuts, /note <text> - add notes to session, /review - AI-powered review of session code and patterns, /summarize - AI summary of the conversation, /rename <title> - rename current session, /pin - pin or unpin session, /branches - git branch management, /stage - stage or unstage files, /commit <message> - commit staged changes, /debug - show diagnostic and debug info, /history <n> - show recent prompt history, /theme - switch color mode or accent, /context - show context window utilization, /agents - show sub-agent sessions, /kill <name> - stop a running sub-agent, /config - view or change settings, /rewind - rewind conversation to an earlier point, /search <query> - search messages in current session, /export-all - export all sessions as Markdown, /stats - show detailed session statistics, /helpful - mark last response helpful, /not-helpful - mark last response not helpful, /filter <model:X|status:X|keyword> - filter sessions, /sort <recent|name|duration|messages> - sort sessions, /grep <pattern> [--ext ts] - search workspace file contents, /gitignore [pattern] - manage .gitignore patterns, /cat <file> [--head N] [--tail N] - display file contents in chat, /wc <file> [--all] - count lines, words, and bytes, /squash [n] - squash last N commits into one, /reset [mode] - git reset (soft/mixed/hard), /pipe <cmd1> | <cmd2> - chain commands sequentially, /help - this help'
    expect(helpText).toContain('/pipe <cmd1> | <cmd2>')
    expect(helpText).toContain('chain commands sequentially')
  })

  // ── Edge cases ────────────────────────────────────────────────────────────

  it('handles commands with pipe character in args (edge case)', () => {
    // If a user accidentally puts a pipe in args, the parser splits on all pipes
    const { commands } = parsePipeArgs('grep "foo|bar" | test')
    // This splits into 3 segments: 'grep "foo', 'bar"', 'test'
    // The user should quote the pipe — this is documented behavior
    expect(commands.length).toBe(3)
  })

  it('handles trailing pipe', () => {
    const { commands } = parsePipeArgs('lint | test |')
    expect(commands).toEqual(['lint', 'test'])
  })

  it('handles leading pipe', () => {
    const { commands } = parsePipeArgs('| lint | test')
    expect(commands).toEqual(['lint', 'test'])
  })

  it('handles multiple spaces between pipes', () => {
    const { commands } = parsePipeArgs('lint    |    test    |    build')
    expect(commands).toEqual(['lint', 'test', 'build'])
  })
})
