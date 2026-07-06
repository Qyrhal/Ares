import React from 'react'

interface TooltipProps {
  content: string
  children: React.ReactElement
}

export function Tooltip({ content, children }: TooltipProps): React.ReactElement {
  const [show, setShow] = React.useState(false)

  return (
    <div
      className="relative inline-flex"
      onMouseOver={() => setShow(true)}
      onMouseOut={() => setShow(false)}
    >
      {children}
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded bg-popover text-popover-foreground text-[10px] font-medium whitespace-nowrap shadow-lg border border-border z-50 pointer-events-none">
          {content}
        </div>
      )}
    </div>
  )
}
