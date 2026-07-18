import React, { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { CheckIcon, ChevronDownIcon, SearchIcon } from '@/lib/icons'

export interface SelectOption {
  value: string
  label: string
  description?: string
  group?: string
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  searchable?: boolean
  className?: string
}

export function Select({
  value, onChange, options, placeholder = 'Select…',
  disabled, searchable, className
}: SelectProps): React.ReactElement {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selected = options.find((o) => o.value === value)

  const filtered = search
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(search.toLowerCase()) ||
          o.value.toLowerCase().includes(search.toLowerCase())
      )
    : options

  // Group the filtered options
  const groups = filtered.reduce<Record<string, SelectOption[]>>((acc, o) => {
    const g = o.group ?? ''
    if (!acc[g]) acc[g] = []
    acc[g].push(o)
    return acc
  }, {})

  useEffect(() => {
    if (!open) { setSearch(''); return }
    setTimeout(() => searchRef.current?.focus(), 0)
    const handler = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-md border border-border bg-input px-3 py-2 text-sm transition-colors',
          'focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20',
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-primary/40'
        )}
      >
        <span className={cn('truncate', selected ? 'text-foreground' : 'text-muted-foreground')}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDownIcon
          className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="surface-overlay absolute left-0 top-full z-50 mt-1 w-full min-w-[220px] rounded-lg border border-border">
          {searchable && (
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
          )}

          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted-foreground">No results</p>
            )}

            {Object.entries(groups).map(([group, items]) => (
              <div key={group}>
                {group && (
                  <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group}
                  </p>
                )}
                {items.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { onChange(opt.value); setOpen(false) }}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left',
                      opt.value === value ? 'text-primary' : 'text-foreground'
                    )}
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center">
                      {opt.value === value && <CheckIcon className="size-3.5" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{opt.label}</div>
                      {opt.description && (
                        <div className="truncate text-xs text-muted-foreground">{opt.description}</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
