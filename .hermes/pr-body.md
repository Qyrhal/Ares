## Summary

Adds a compact sidebar mode toggle that reduces vertical space per session card in the sidebar. When enabled, session cards show only the title and status line — model badge, tags, and notes are hidden, padding is reduced, and font sizes are smaller.

## Changes

### Store (`useAppStore.ts`)
- Added `compactSidebar: boolean` state (default `false`)
- Added `toggleCompactSidebar` action

### Sidebar (`Sidebar.tsx`)
- Added `PanelLeftClose` icon import from lucide-react
- Added compact mode toggle button in the sidebar header (next to export button)
- When `compactSidebar` is true:
  - Session card padding reduced from `py-1.5` to `py-0.5`
  - Title font size reduced from `text-xs` to `text-[10px]`
  - Status line font size reduced from `text-[10px]` to `text-[9px]`
  - Model badge hidden
  - Tags hidden
  - Notes hidden
  - "Pinned" section header text hidden (sessions still shown)

### Tests (`compact-sidebar.test.tsx`)
- 10 new tests covering: default normal mode, compact mode rendering, toggle switching, model badge hiding, tags hiding, notes hiding, padding reduction, pinned header visibility

## Verification
- ✅ 4740 tests pass, 0 fail
- ✅ TypeScript clean (`tsc --noEmit`)
- ✅ Build clean (`npm run build`)
