# Ares Daily Pipeline — Jul 19, 2026

## Phase 1: Research Summary

| Competitor | Latest Release | New Features | Ares Gap? |
|---|---|---|---|
| **Cursor** | Slack improvements (Jul 16), v3.11 (Jul 9) | Plan preview in Slack, multi-repo env, cross-channel workflows | Plan preview built ✅ |
| **Claude Code** | v2.1.214 (Jul 17) | Security/bug fixes only (EndConversation tool, heartbeat, OTEL) | No new features to port |
| **Zed** | Preview 1.12.0 (Jul 15) | Agent sandboxing, staged/unstaged grouping, file finder multi-select, CSV filtering | Staged/unstaged grouping concept → diff preview already built ✅ |
| **Copilot** | Jul 14-17 | Repo-level usage metrics GA, security reviews in app, code review customization | Security review concept explored |
| **Devin Desktop** | v3.4.27 (Jul 4) | "New session in space" kebab menu | Nothing new to port |

**Verdict:** Quiet week — no major competitor features warranting porting.

## Phase 2: Audit

| Check | Result |
|---|---|
| `npm test` (vitest) | 74 files, 1375 passed, 4 errors (non-fatal uncaught exceptions in test env) |
| `npx tsc --noEmit` | ✅ No errors found |
| `git log --oneline -5` | 8005ba1 test(qa): add schema tests (#138), 80f5381 feat(mcp): auto-background (#136), 6fa95d6 test(qa): archive schema/store tests (#135), 70136a8 feat(chat): /usage (#133), 965c241 feat(chat): plan preview mode (#132) |

**Total tests:** 1375 passing (+17 from last pipeline's 1358)

## Phase 3: Features Designed

### Feature 1: `/changes` Slash Command
- **What:** Shows workspace git status (branch, staged, unstaged, untracked files, sync info) as a formatted system message in chat
- **Why:** Quick git context without leaving the chat view; complements `/overview` and `/status`
- **Files:** `InputBar.tsx` (register command), `App.tsx` (handler with `el.git.status()`), `changes-command.test.ts` (new tests)
- **Dependencies:** None — uses existing `git:status` IPC
- **Competitor inspiration:** Zed 1.12.0 staged/unstaged grouping, general ADE git awareness

### Feature 2: `/archive` Slash Command
- **What:** Toggles the current session's archived state
- **Why:** Keyboard-accessible archiving; feature exists in UI (sidebar toggle) but no slash command
- **Files:** `InputBar.tsx` (register command), `App.tsx` (handler using existing `handleArchiveSession`), `archive-command.test.ts` (new tests)
- **Dependencies:** None — runs after Feature 1 is merged
