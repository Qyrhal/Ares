# Ares – Project Instructions

## Tech stack

Electron 33 + electron-vite · React 18 + TypeScript · Tailwind v4 (CSS-first) · shadcn v4 · JSON file store (`src/main/db.ts`)

## Git workflow

**Always follow this flow — no exceptions:**

```
main  →  git checkout -b <branch>  →  PR  →  Squash and merge  →  delete branch
```

1. **Never commit directly to `main`.**
2. Branch from the latest `main`.
3. Open a PR when the work is ready.
4. Merge with **Squash and merge** only.
5. Delete the branch after merge.

## Branch naming

```
<type>/<short-slug>
```

Examples: `feat/file-editor`, `fix/traffic-light-overlap`, `chore/update-deps`, `docs/readme`

Types: `feat` · `fix` · `chore` · `docs` · `refactor` · `test` · `ci`

## Commit messages (Conventional Commits)

```
<type>(<scope>): <short description>
```

- **type** – one of: `feat`, `fix`, `chore`, `docs`, `refactor`, `style`, `test`, `ci`
- **scope** – the area changed, e.g. `app`, `chat`, `editor`, `settings`, `db`, `ipc`, `ui`, `deps`
- **description** – lowercase, imperative, no period, ≤72 chars

Examples:
```
feat(editor): add monaco syntax highlighting
fix(sidebar): clear traffic-light overlap with pl-20
chore(deps): upgrade shadcn to 4.12
refactor(db): replace better-sqlite3 with fs json store
docs(claude): add conventional commit conventions
```

## PR titles

Follow the same `type(scope): description` format as commits.

## Code style

- Match existing conventions; never reformat unrelated lines.
- No comments unless the *why* is non-obvious.
- No speculative abstractions — only what the task requires.
- Run `npm run build` to verify the build before opening a PR.

## Key paths

| Path | Purpose |
|---|---|
| `src/main/db.ts` | JSON persistence layer (sessions, messages, settings, workspace) |
| `src/main/index.ts` | Electron main process + all IPC handlers |
| `src/preload/index.ts` | Context bridge — exposes `window.electron` |
| `src/renderer/src/App.tsx` | Root layout, tab management, session/file state |
| `src/renderer/src/hooks/useAI.ts` | OpenAI-compatible streaming client |
| `src/renderer/src/components/` | All React components |
| `src/renderer/src/types/index.ts` | Shared TypeScript types |
