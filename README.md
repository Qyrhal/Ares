# Ares

An AI-powered coding assistant desktop app. Connect to any OpenAI-compatible API and get a full coding agent with a file editor, terminal, git panel, slash commands, MCP server support, and a plugin/skills ecosystem.

Built on [Pi Agent](https://github.com/earendil-works/pi-coding-agent) with Electron + React.

---

## Features

- **AI chat** — streaming responses with live thinking traces, tool-call visibility, and persistent session history across restarts
- **File editor** — Monaco-based editor with full read/write access to your workspace; file tree updates automatically after AI operations
- **Terminal** — integrated shell via xterm.js
- **Git panel** — stage, commit, push, branch checkout, and diff viewer
- **Skills & plugins** — auto-discovers skills and slash commands from `~/.pi`, `~/.claude`, and `~/.omp` on boot
- **MCP servers** — configure Model Context Protocol servers through the UI; they're spawned on demand per session
- **Slash commands** — built-in commands plus any discovered from installed plugins, all accessible with `/` in the chat input
- **Workspace context** — `@file` mentions expand file contents inline before the AI sees them
- **Checkpoints / Undo** (inspired by Claude Code Desktop) — git stash-backed snapshots created before AI tool operations; view, diff, restore, or delete from the Checkpoints panel
- **Language Server Protocol (LSP) integration** (inspired by OpenCode + Claude Code) — automatic TypeScript/ESLint diagnostics fed to the AI for context-aware code changes
- **Lifecycle hooks** (inspired by Claude Code Desktop) — run scripts, send webhooks, or inject prompt context on agent lifecycle events (pre/post tool, pre/post send, on error)
- **Session export/import** (inspired by OpenCode) — share conversations as standalone JSON files; import sessions from the sidebar
- **Zen mode** (inspired by OpenCode) — distraction-free full-width coding with `Cmd+Shift+Z`
- **Custom keyboard shortcuts** — Zen mode toggle, easy to extend

## Tech stack

| Layer | Technology |
|---|---|
| Shell | Electron 33 + electron-vite |
| UI | React 19 + TypeScript + Tailwind v4 + shadcn/ui |
| AI backend | Pi Agent (`@earendil-works/pi-coding-agent`) |
| API protocol | OpenAI-compatible (OpenAI, Ollama, LM Studio, Groq, Together AI, …) |
| Persistence | JSON file store (`userData/ares-db.json`) |
| Editor | Monaco Editor |
| Terminal | xterm.js + node-pty |

## Prerequisites

- **Node.js** 20+
- **npm** 10+ (or bun)
- **macOS** — primary development target. Linux should work; Windows may need adjustments for `node-pty`.

## Getting started

```bash
git clone https://github.com/Qyrhal/Ares.git
cd Ares
npm install

# If Electron's binary is missing after install, re-download it:
node node_modules/electron/install.js

npm run dev
```

## Configuration

Open **Settings** (gear icon in the sidebar) and enter your API base URL and key:

| Provider | Base URL |
|---|---|
| OpenAI | `https://api.openai.com/v1` |
| Ollama (local) | `http://localhost:11434/v1` |
| LM Studio | `http://localhost:1234/v1` |
| Groq | `https://api.groq.com/openai/v1` |
| Together AI | `https://api.together.xyz/v1` |

Your key and settings are stored locally in your OS user-data directory — never sent anywhere except the endpoint you configure.

## Building

```bash
npm run build      # compile (Electron main + renderer)
npm run package    # compile + electron-builder (creates a distributable in release/)
```

## Project structure

```
src/
  main/
    db.ts          JSON persistence (sessions, messages, settings, agent config)
    index.ts       Electron main process + all IPC handlers
    pi.ts          Pi Agent session lifecycle and file-based history persistence
    scanner.ts     Background plugin/skill/MCP scanner (runs after boot)
    git.ts         Git operations (simple-git wrapper)
  preload/
    index.ts       Context bridge — exposes window.electron to the renderer
  renderer/src/
    App.tsx        Root layout, tab management, session/file state
    hooks/
      useAI.ts     OpenAI-compatible streaming client (delegates to Pi Agent via IPC)
    components/    All React UI components
    store/         Zustand app store
    types/         Shared TypeScript types
```

## Contributing

See [AGENTS.md](AGENTS.md) for branch naming conventions, commit message format, and code style guidelines.

## License

[MIT](LICENSE)
