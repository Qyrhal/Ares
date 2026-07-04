import fs from 'fs'
import path from 'path'
import os from 'os'
import { BrowserWindow } from 'electron'
import { getAgentConfig, setAgentConfig, DbPiSkill, DbPiExtension, DbMcpServer, DbSlashCommand } from './db'
import { clearAllPiSessions } from './pi'
import { v4 as uuidv4 } from 'uuid'

interface ScanResult {
  skills: number
  extensions: number
  mcpServers: number
  commands: number
}

// ── helpers ───────────────────────────────────────────────────────────────────

function exists(p: string): boolean {
  try { fs.accessSync(p); return true } catch { return false }
}

function readJsonSafe<T>(p: string): T | null {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')) as T } catch { return null }
}

function readFileSafe(p: string): string {
  try { return fs.readFileSync(p, 'utf-8') } catch { return '' }
}

// Resolve symlinks so we get the real path for de-duplication
function realPathSafe(p: string): string {
  try { return fs.realpathSync(p) } catch { return p }
}

// Recursively find all SKILL.md files under a directory (max 4 levels deep)
function findSkillFiles(dir: string, depth = 0): string[] {
  if (depth > 4 || !exists(dir)) return []
  const results: string[] = []
  let entries: fs.Dirent[]
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return [] }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isSymbolicLink()) {
      const real = realPathSafe(full)
      const stat = fs.statSync(real)
      if (stat.isDirectory()) results.push(...findSkillFiles(real, depth + 1))
      else if (e.name === 'SKILL.md') results.push(real)
    } else if (e.isDirectory()) {
      results.push(...findSkillFiles(full, depth + 1))
    } else if (e.name === 'SKILL.md') {
      results.push(full)
    }
  }
  return results
}

// Parse frontmatter name/description from a markdown file
function parseFrontmatter(content: string): { name: string; description: string } {
  const m = content.match(/^---\s*\n([\s\S]*?)\n---/)
  if (!m) return { name: '', description: '' }
  const name = (m[1].match(/^name:\s*(.+)$/m)?.[1] ?? '').trim()
  const description = (m[1].match(/^description:\s*(.+)$/m)?.[1] ?? '').trim()
  return { name, description }
}

// ── skill sources ─────────────────────────────────────────────────────────────

function skillsFromDir(dir: string): DbPiSkill[] {
  return findSkillFiles(dir).map((filePath) => {
    const content = readFileSafe(filePath)
    const { name, description } = parseFrontmatter(content)
    return {
      id: uuidv4(),
      name: name || path.basename(path.dirname(filePath)),
      description,
      content,
    }
  })
}

function collectSkills(): DbPiSkill[] {
  const home = os.homedir()
  const skills: DbPiSkill[] = []

  // ~/.pi/agent/skills/
  skills.push(...skillsFromDir(path.join(home, '.pi', 'agent', 'skills')))

  // ~/.omp/agent/skills/
  skills.push(...skillsFromDir(path.join(home, '.omp', 'agent', 'skills')))

  // ~/.agents/skills/ (shared skills referenced by Pi symlinks)
  skills.push(...skillsFromDir(path.join(home, '.agents', 'skills')))

  // ~/.claude/plugins/installed_plugins.json → each installPath/skills/
  const installed = readJsonSafe<{ plugins: Record<string, Array<{ installPath: string }>> }>(
    path.join(home, '.claude', 'plugins', 'installed_plugins.json')
  )
  if (installed?.plugins) {
    for (const versions of Object.values(installed.plugins)) {
      for (const v of versions) {
        if (v.installPath) {
          skills.push(...skillsFromDir(path.join(v.installPath, 'skills')))
        }
      }
    }
  }

  // Deduplicate by skill content fingerprint (first 120 chars of content)
  const seen = new Set<string>()
  return skills.filter((s) => {
    const key = s.content.slice(0, 120).trim()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ── extension sources ─────────────────────────────────────────────────────────

function extensionsFromDir(dir: string): DbPiExtension[] {
  if (!exists(dir)) return []
  let entries: fs.Dirent[]
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return [] }
  return entries
    .filter((e) => !e.isDirectory() && /\.(js|ts)$/.test(e.name))
    .map((e) => ({
      id: uuidv4(),
      name: e.name.replace(/\.(js|ts)$/, ''),
      path: realPathSafe(path.join(dir, e.name)),
      enabled: true,
    }))
}

function collectExtensions(): DbPiExtension[] {
  const home = os.homedir()
  const exts: DbPiExtension[] = []

  exts.push(...extensionsFromDir(path.join(home, '.pi', 'agent', 'extensions')))
  exts.push(...extensionsFromDir(path.join(home, '.omp', 'agent', 'extensions')))

  // Deduplicate by resolved file path
  const seen = new Set<string>()
  return exts.filter((e) => {
    if (seen.has(e.path)) return false
    seen.add(e.path)
    return true
  })
}

// ── Slash command sources ─────────────────────────────────────────────────────

function parseTomlCommand(content: string, name: string): DbSlashCommand | null {
  // Match: key = "value" (single-line TOML strings only)
  const get = (key: string): string => {
    const m = content.match(new RegExp(`^${key}\\s*=\\s*"([^"]*)"`, 'm'))
    return m?.[1]?.trim() ?? ''
  }
  const description = get('description')
  const prompt = get('prompt')
  if (!description || !prompt) return null
  return { id: uuidv4(), name, description, prompt, source: name }
}

function parseMdCommand(content: string, name: string): DbSlashCommand | null {
  const fm = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)/)
  if (!fm) return null
  const frontmatter = fm[1]
  const body = fm[2].trim()
  const get = (key: string): string => frontmatter.match(new RegExp(`^${key}:\\s*(.+)`, 'm'))?.[1]?.trim() ?? ''
  const description = get('description').replace(/^["']|["']$/g, '')
  const argumentHint = get('argument-hint').replace(/^["']|["']$/g, '') || undefined
  if (!description || !body) return null
  return { id: uuidv4(), name, description, prompt: body, argumentHint, source: name }
}

function commandsFromDir(dir: string): DbSlashCommand[] {
  if (!exists(dir)) return []
  let entries: fs.Dirent[]
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return [] }
  const commands: DbSlashCommand[] = []
  for (const e of entries) {
    if (e.isDirectory()) continue
    const full = path.join(dir, e.name)
    const content = readFileSafe(full)
    const name = e.name.replace(/\.(toml|md)$/, '')
    if (e.name.endsWith('.toml')) {
      const cmd = parseTomlCommand(content, name)
      if (cmd) commands.push(cmd)
    } else if (e.name.endsWith('.md')) {
      const cmd = parseMdCommand(content, name)
      if (cmd) commands.push(cmd)
    }
  }
  return commands
}

function collectCommands(): DbSlashCommand[] {
  const home = os.homedir()
  const commands: DbSlashCommand[] = []

  // ~/.pi/agent/skills symlinks may have accompanying commands dirs — skip, Pi doesn't have commands

  // ~/.claude/plugins/installed_plugins.json → each installPath/commands/
  const installed = readJsonSafe<{ plugins: Record<string, Array<{ installPath: string }>> }>(
    path.join(home, '.claude', 'plugins', 'installed_plugins.json')
  )
  if (installed?.plugins) {
    for (const versions of Object.values(installed.plugins)) {
      for (const v of versions) {
        if (v.installPath) {
          commands.push(...commandsFromDir(path.join(v.installPath, 'commands')))
        }
      }
    }
  }

  // ~/.claude/plugins/marketplaces/*/plugins/*/commands/ (for uninstalled but known)
  const marketplacesDir = path.join(home, '.claude', 'plugins', 'marketplaces')
  if (exists(marketplacesDir)) {
    let markets: string[]
    try { markets = fs.readdirSync(marketplacesDir) } catch { markets = [] }
    for (const market of markets) {
      const pluginsDir = path.join(marketplacesDir, market, 'plugins')
      if (!exists(pluginsDir)) continue
      let plugins: string[]
      try { plugins = fs.readdirSync(pluginsDir) } catch { continue }
      for (const plugin of plugins) {
        commands.push(...commandsFromDir(path.join(pluginsDir, plugin, 'commands')))
      }
    }
  }

  // Deduplicate by name (first wins)
  const seen = new Set<string>()
  return commands.filter((c) => {
    if (seen.has(c.name)) return false
    seen.add(c.name)
    return true
  })
}

// ── MCP server sources ────────────────────────────────────────────────────────

type McpServerMap = Record<string, { command?: string; args?: string[]; env?: Record<string, string>; url?: string; type?: string }>

function mcpFromMap(map: McpServerMap): DbMcpServer[] {
  return Object.entries(map).map(([name, cfg]) => ({
    id: uuidv4(),
    name,
    command: cfg.command ?? (cfg.url ? 'sse' : 'npx'),
    args: cfg.args ?? (cfg.url ? [cfg.url] : []),
    env: cfg.env ?? {},
    enabled: true,
  }))
}

function collectMcpServers(): DbMcpServer[] {
  const home = os.homedir()
  const servers: DbMcpServer[] = []

  // ~/.pi/agent/mcp.json
  const piMcp = readJsonSafe<{ mcpServers?: McpServerMap }>(path.join(home, '.pi', 'agent', 'mcp.json'))
  if (piMcp?.mcpServers) servers.push(...mcpFromMap(piMcp.mcpServers))

  // ~/.omp/agent/mcp.json
  const ompMcp = readJsonSafe<{ mcpServers?: McpServerMap }>(path.join(home, '.omp', 'agent', 'mcp.json'))
  if (ompMcp?.mcpServers) servers.push(...mcpFromMap(ompMcp.mcpServers))

  // ~/.claude/settings.json (mcpServers field)
  const claudeSettings = readJsonSafe<{ mcpServers?: McpServerMap }>(
    path.join(home, '.claude', 'settings.json')
  )
  if (claudeSettings?.mcpServers) servers.push(...mcpFromMap(claudeSettings.mcpServers))

  // Deduplicate by name
  const seen = new Set<string>()
  return servers.filter((s) => {
    if (seen.has(s.name)) return false
    seen.add(s.name)
    return true
  })
}

// ── main export ────────────────────────────────────────────────────────────────

export function runBackgroundScan(win: BrowserWindow): void {
  // Run after the current call stack clears so boot is never blocked
  setImmediate(async () => {
    try {
      const [newSkills, newExtensions, newMcpServers, newCommands] = await Promise.all([
        Promise.resolve(collectSkills()),
        Promise.resolve(collectExtensions()),
        Promise.resolve(collectMcpServers()),
        Promise.resolve(collectCommands()),
      ])

      if (newSkills.length === 0 && newExtensions.length === 0 && newMcpServers.length === 0 && newCommands.length === 0) return

      const existing = getAgentConfig()

      // Merge: skip anything already present (match by name for skills/MCP/commands, by path for extensions)
      const existingSkillNames = new Set(existing.skills.map((s) => s.name))
      const existingExtPaths = new Set(existing.extensions.map((e) => e.path))
      const existingMcpNames = new Set(existing.mcpServers.map((s) => s.name))
      const existingCmdNames = new Set((existing.commands ?? []).map((c) => c.name))

      const addedSkills = newSkills.filter((s) => !existingSkillNames.has(s.name))
      const addedExts = newExtensions.filter((e) => !existingExtPaths.has(e.path))
      const addedMcp = newMcpServers.filter((s) => !existingMcpNames.has(s.name))
      // Commands are always replaced (they come from read-only plugin files)
      const addedCmds = newCommands.filter((c) => !existingCmdNames.has(c.name))

      const total = addedSkills.length + addedExts.length + addedMcp.length + addedCmds.length
      if (total === 0) return

      const updated = {
        skills: [...existing.skills, ...addedSkills],
        extensions: [...existing.extensions, ...addedExts],
        mcpServers: [...existing.mcpServers, ...addedMcp],
        commands: [...(existing.commands ?? []), ...addedCmds],
      }

      setAgentConfig(updated)
      clearAllPiSessions()

      const result: ScanResult = {
        skills: addedSkills.length,
        extensions: addedExts.length,
        mcpServers: addedMcp.length,
        commands: addedCmds.length,
      }

      if (!win.isDestroyed()) {
        win.webContents.send('agentConfig:scanResult', result)
      }
    } catch (err) {
      console.error('[ares] background scan error:', err)
    }
  })
}
