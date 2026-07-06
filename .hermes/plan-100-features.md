# 100+ Feature Implementation Plan — Ares

## Strategy
- 10–15 PRs, each focused on one feature area
- ~10 features per PR
- Each feature gets integration tests (renderer + e2e)
- Branch from main, PR → squash merge, delete branch

## PR 1: Message Interactions & Chat UX
Reply, edit, copy, reactions, timestamps, auto-scroll
- [ ] Reply to message (quote + reply chain)
- [ ] Edit own messages (inline edit)
- [ ] Copy message text button
- [ ] Copy code block button
- [ ] Message timestamp display
- [ ] Streaming token counter (tokens/sec)
- [ ] Auto-scroll chat on new message
- [ ] Scroll lock / follow mode toggle
- [ ] Message reactions (thumbs up/down)
- [ ] Message delete with undo

## PR 2: Search & Navigation
Find in session, command palette, quick file open
- [ ] Search messages in session (Ctrl+F)
- [ ] Highlight search results
- [ ] Command palette (Cmd+Shift+P)
- [ ] Quick file open (Cmd+P)
- [ ] Session history search in sidebar
- [ ] Session grouping by date
- [ ] Tab search/switch (Cmd+Shift+O)
- [ ] Go to line in file editor
- [ ] Breadcrumb navigation in file tree
- [ ] Recent files list

## PR 3: Agent System Deepening
Spawning, monitoring, cost tracking, memory
- [ ] Spawn agent from AI message / detect intent
- [ ] Agent creation from chat context
- [ ] Agent output display in thread
- [ ] Agent live progress streaming
- [ ] Agent termination from UI
- [ ] Agent queue with priority
- [ ] Agent timeout configuration
- [ ] Per-agent model override
- [ ] Agent cost/token tracking
- [ ] Sub-agent result collapse/expand

## PR 4: Token Economy & Performance Metrics
Token counting, cost estimation, speed
- [ ] Tokens per second live display
- [ ] Total tokens per message
- [ ] Session token accumulator
- [ ] Estimated cost display
- [ ] Response time (latency) display
- [ ] Model context window display
- [ ] Remaining context tokens
- [ ] Token usage breakdown (input vs output)
- [ ] API call timing
- [ ] Token usage graph/history

## PR 5: Git Enhancements
Stash, blame, cherry-pick, graph, auto-commit
- [ ] Git stash management (list/create/drop/apply)
- [ ] Git blame annotations in file editor
- [ ] File history view
- [ ] Cherry-pick UI
- [ ] Git graph (branch visualization)
- [ ] Auto-commit on save (configurable)
- [ ] Commit message generation from diff
- [ ] Diff view with syntax highlighting
- [ ] Merge conflict indicator
- [ ] .gitignore quick-edit

## PR 6: Terminal Power User Features
Tabs, search, config, split
- [ ] Terminal tab renaming (double-click)
- [ ] Terminal search (Ctrl+Shift+F)
- [ ] Terminal color scheme config
- [ ] Terminal bell disable
- [ ] Font size control
- [ ] Terminal clear shortcut
- [ ] Send text to terminal from chat
- [ ] Terminal selection auto-copy
- [ ] Terminal paste confirmation for large text
- [ ] Multiple terminal profiles

## PR 7: File System & Editor Polish
Search, multi-select, drag, auto-save, syntax
- [ ] Full-text search across workspace (Ctrl+Shift+F)
- [ ] File multi-select
- [ ] Drag-drop files between folders
- [ ] Auto-save with debounce
- [ ] Unsaved indicator per file
- [ ] Binary file detection + warning
- [ ] Large file open warning
- [ ] File creation from template
- [ ] File type icons
- [ ] Folder collapse state persistence

## PR 8: Settings & Configuration Depth
API validation, model config, theme builder, import/export
- [ ] API key validation on save
- [ ] Model temperature slider
- [ ] Max tokens config
- [ ] System prompt templates
- [ ] Model list refresh
- [ ] Theme preview with live swap
- [ ] Custom theme color pickers
- [ ] Settings import/export
- [ ] Font family/size customization
- [ ] UI density toggle (comfortable/compact)

## PR 9: Notifications & Progress
Desktop notifications, sound, progress indicators
- [ ] Desktop notification on task completion
- [ ] Sound on task complete (configurable)
- [ ] Session progress indicator in sidebar
- [ ] Message streaming progress bar
- [ ] File upload progress
- [ ] Git operation progress
- [ ] Agent execution progress ring
- [ ] Loading skeletons for lists
- [ ] Background task indicator
- [ ] Notification preferences panel

## PR 10: Keyboard Shortcuts & Accessibility
Custom keybinds UI, zoom, accessibility
- [ ] Custom keybind editor UI
- [ ] Keybind preset themes (vscode, sublime, emacs)
- [ ] Zoom in/out (Cmd+/Cmd-)
- [ ] Find in chat (Cmd+F)
- [ ] Quick session switch
- [ ] Tab navigation (Ctrl+Tab, Ctrl+Shift+Tab)
- [ ] Close other tabs
- [ ] Cmd+W closes tab
- [ ] Accessibility: tab index, aria labels
- [ ] Screen reader support for chat

## PR 11: Data Export & Persistence
Export formats, session archival, backup
- [ ] Chat export as markdown
- [ ] Chat export as JSON (full)
- [ ] Session archival (hide from main list)
- [ ] Batch session delete
- [ ] Message copy as plain text
- [ ] Code block download as file
- [ ] Automatic session title generation
- [ ] Session rename in sidebar (inline edit)
- [ ] Recent sessions limit config
- [ ] Session search by content

## PR 12: UI Polish & Empty States
Empty states, tooltips, transitions, responsive
- [ ] Empty state illustrations/messages
- [ ] Hover tooltips on icons
- [ ] Animated view transitions
- [ ] Tab drag-reorder
- [ ] Sidebar collapse/expand
- [ ] Resizable sidebar width
- [ ] Welcome screen with quick actions
- [ ] Context menus throughout
- [ ] Toast notifications for async operations
- [ ] Undo toast for destructive actions

## PR 13: Testing Infrastructure
Comprehensive test coverage across all features
- [ ] E2E test framework (Playwright)
- [ ] IPC handler integration tests
- [ ] Store action tests
- [ ] Component rendering tests
- [ ] Keyboard shortcut tests
- [ ] API mocking helpers
- [ ] Window management tests
- [ ] File system operation tests
- [ ] Network request mocking
- [ ] Test coverage reporting config

## Summary
13 PRs × ~10 features = ~130 features
~10 tests per feature = ~1300+ tests
