import { useCallback, useRef, useState } from 'react'

export interface ContextMenuState {
  x: number
  y: number
  items: ContextMenuItem[]
  open: boolean
}

export interface ContextMenuItem {
  id: string
  label: string
  shortcut?: string
  disabled?: boolean
  danger?: boolean
  action: () => void
}

export function useContextMenu() {
  const [menu, setMenu] = useState<ContextMenuState>({ x: 0, y: 0, items: [], open: false })

  const show = useCallback((e: React.MouseEvent, items: ContextMenuItem[]) => {
    e.preventDefault()
    e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY, items, open: true })
  }, [])

  const hide = useCallback(() => {
    setMenu((prev) => ({ ...prev, open: false }))
  }, [])

  return { menu, show, hide }
}
