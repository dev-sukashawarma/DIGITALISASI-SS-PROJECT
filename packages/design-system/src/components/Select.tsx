'use client'

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { cn } from '../utils/cn'

export type SelectBadgeTone = 'neutral' | 'warning' | 'danger' | 'success'

export interface SelectOption {
  value: string
  label: string
  sublabel?: string
  badge?: string
  badgeTone?: SelectBadgeTone
  disabled?: boolean
  keywords?: string
}

export interface SelectGroup {
  label: string
  options: SelectOption[]
}

export interface SelectProps {
  value: string
  onChange: (value: string) => void
  options?: SelectOption[]
  groups?: SelectGroup[]
  placeholder?: string
  label?: string
  leadingIcon?: React.ReactNode
  clearable?: boolean
  clearValue?: string
  clearTitle?: string
  /** Otomatis aktif bila total opsi > 5, kecuali di-override eksplisit. */
  searchable?: boolean
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  required?: boolean
  size?: 'sm' | 'md' | 'lg'
  minMenuWidth?: number
  id?: string
  name?: string
  'aria-label'?: string
  className?: string
  triggerClassName?: string
}

const BADGE_TONE_CLASSES: Record<SelectBadgeTone, string> = {
  neutral: 'bg-[#fcfaf8] text-[#701604]/75 border-[#701604]/15',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

const SIZE_CLASSES: Record<NonNullable<SelectProps['size']>, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-xl min-h-[34px]',
  md: 'px-3.5 py-2.5 text-xs rounded-xl min-h-[40px]',
  lg: 'px-4 py-3 text-sm rounded-2xl min-h-[44px]',
}

interface MenuCoords {
  top?: number
  bottom?: number
  left: number
  width: number
  maxHeight: number
}

export function Select({
  value,
  onChange,
  options = [],
  groups,
  placeholder = 'Pilih opsi...',
  label,
  leadingIcon,
  clearable = false,
  clearValue = '',
  clearTitle = 'Reset pilihan',
  searchable,
  searchPlaceholder = 'Cari pilihan...',
  emptyMessage = 'Tidak ada pilihan yang cocok',
  disabled = false,
  required = false,
  size = 'md',
  minMenuWidth = 220,
  id,
  name,
  'aria-label': ariaLabel,
  className,
  triggerClassName,
}: SelectProps) {
  const generatedId = useId()
  const listboxId = `${id ?? generatedId}-listbox`

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState<number>(-1)
  const [coords, setCoords] = useState<MenuCoords | null>(null)

  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])

  const allOptions = useMemo(() => {
    const flat = [...options]
    if (groups) {
      for (const g of groups) {
        flat.push(...g.options)
      }
    }
    return flat
  }, [options, groups])

  // Aturan standar Design System: jika opsi > 5 otomatis tampilkan search bar
  const showSearch = searchable ?? allOptions.length > 5

  const selectedOption = useMemo(
    () => allOptions.find((opt) => opt.value === value),
    [allOptions, value]
  )

  const normalizedQuery = query.trim().toLowerCase()

  const matchesQuery = useCallback(
    (opt: SelectOption, groupLabel?: string) => {
      if (!normalizedQuery) return true
      const haystack = [opt.label, opt.sublabel, opt.badge, opt.keywords, groupLabel]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(normalizedQuery)
    },
    [normalizedQuery]
  )

  const filteredTopOptions = useMemo(
    () => options.filter((opt) => matchesQuery(opt)),
    [options, matchesQuery]
  )

  const filteredGroups = useMemo(() => {
    if (!groups) return []
    return groups
      .map((group) => ({
        label: group.label,
        options: group.options.filter((opt) => matchesQuery(opt, group.label)),
      }))
      .filter((group) => group.options.length > 0)
  }, [groups, matchesQuery])

  const navigableOptions = useMemo(() => {
    const list = [...filteredTopOptions]
    for (const g of filteredGroups) {
      list.push(...g.options)
    }
    return list
  }, [filteredTopOptions, filteredGroups])

  const updatePosition = useCallback(() => {
    const el = triggerRef.current
    if (!el || typeof window === 'undefined') return
    const rect = el.getBoundingClientRect()
    const viewportW = window.innerWidth
    const viewportH = window.innerHeight
    const margin = 8
    const gap = 6

    const desiredWidth = Math.max(rect.width, minMenuWidth)
    const width = Math.min(desiredWidth, viewportW - margin * 2)
    const left = Math.min(Math.max(margin, rect.left), viewportW - width - margin)

    const spaceBelow = viewportH - rect.bottom - margin - gap
    const spaceAbove = rect.top - margin - gap
    const openUpward = spaceBelow < 220 && spaceAbove > spaceBelow

    if (openUpward) {
      setCoords({
        bottom: viewportH - rect.top + gap,
        left,
        width,
        maxHeight: Math.min(340, Math.max(160, spaceAbove)),
      })
    } else {
      setCoords({
        top: rect.bottom + gap,
        left,
        width,
        maxHeight: Math.min(340, Math.max(160, spaceBelow)),
      })
    }
  }, [minMenuWidth])

  const closeMenu = useCallback((restoreFocus = false) => {
    setOpen(false)
    setQuery('')
    if (restoreFocus) {
      triggerRef.current?.focus()
    }
  }, [])

  const openMenu = useCallback(() => {
    if (disabled) return
    updatePosition()
    setQuery('')
    const idx = allOptions.findIndex((o) => o.value === value && !o.disabled)
    setActiveIndex(idx >= 0 ? idx : allOptions.findIndex((o) => !o.disabled))
    setOpen(true)
  }, [disabled, updatePosition, allOptions, value])

  useEffect(() => {
    if (!open) return undefined
    updatePosition()

    if (!showSearch) return undefined
    const raf = requestAnimationFrame(() => {
      searchInputRef.current?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(raf)
  }, [open, showSearch, updatePosition])

  useEffect(() => {
    if (!open) return

    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return
      }
      closeMenu(false)
    }

    function handleWindowScroll(e: Event) {
      if (menuRef.current && e.target instanceof Node && menuRef.current.contains(e.target)) {
        return
      }
      updatePosition()
    }

    function handleResize() {
      updatePosition()
    }

    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('scroll', handleWindowScroll, true)
    window.addEventListener('resize', handleResize)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('scroll', handleWindowScroll, true)
      window.removeEventListener('resize', handleResize)
    }
  }, [open, closeMenu, updatePosition])

  useEffect(() => {
    if (!open || activeIndex < 0) return
    const btn = optionRefs.current[activeIndex]
    if (btn && typeof btn.scrollIntoView === 'function') {
      btn.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex, open])

  const selectOption = useCallback(
    (opt: SelectOption) => {
      if (opt.disabled) return
      onChange(opt.value)
      closeMenu(true)
    },
    [onChange, closeMenu]
  )

  const moveHighlight = useCallback(
    (delta: 1 | -1) => {
      if (navigableOptions.length === 0) return
      let next = activeIndex
      for (let i = 0; i < navigableOptions.length; i++) {
        next = (next + delta + navigableOptions.length) % navigableOptions.length
        if (!navigableOptions[next]?.disabled) {
          setActiveIndex(next)
          return
        }
      }
    },
    [navigableOptions, activeIndex]
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return

    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        openMenu()
      }
      return
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      closeMenu(true)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveHighlight(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveHighlight(-1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const candidate = navigableOptions[activeIndex]
      if (candidate && !candidate.disabled) {
        selectOption(candidate)
      }
    }
  }

  const canClear = clearable && !disabled && value !== clearValue && Boolean(selectedOption)

  let runningIndex = -1

  const renderOptionRow = (opt: SelectOption) => {
    runningIndex += 1
    const idx = runningIndex
    const isSelected = opt.value === value
    const isHighlighted = idx === activeIndex

    return (
      <button
        key={`${opt.value}-${idx}`}
        ref={(el) => {
          optionRefs.current[idx] = el
        }}
        type="button"
        role="option"
        aria-selected={isSelected}
        disabled={opt.disabled}
        onMouseEnter={() => {
          if (!opt.disabled) setActiveIndex(idx)
        }}
        onClick={() => selectOption(opt)}
        className={cn(
          'flex w-full items-center justify-between gap-2.5 px-3 py-2 text-left text-xs transition-colors rounded-lg cursor-pointer',
          opt.disabled && 'opacity-40 cursor-not-allowed',
          isSelected
            ? 'bg-[#fff7ed] text-[#701604] font-bold'
            : isHighlighted
            ? 'bg-[#fcfaf8] text-[#1e1b15] font-semibold'
            : 'text-[#1e1b15]/85 font-medium hover:bg-[#fcfaf8]'
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate">{opt.label}</span>
          {opt.sublabel && (
            <span className="block truncate text-[11px] font-normal text-[#701604]/55 mt-0.5">
              {opt.sublabel}
            </span>
          )}
        </span>

        <span className="flex items-center gap-1.5 shrink-0">
          {opt.badge && (
            <span
              className={cn(
                'px-2 py-0.5 text-[10px] font-bold rounded-md border whitespace-nowrap',
                BADGE_TONE_CLASSES[opt.badgeTone ?? 'neutral']
              )}
            >
              {opt.badge}
            </span>
          )}
          {isSelected && <Check className="w-3.5 h-3.5 text-[#f29744] shrink-0" />}
        </span>
      </button>
    )
  }

  const popover =
    open && coords && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            id={listboxId}
            role="listbox"
            aria-label={ariaLabel ?? label ?? placeholder}
            onKeyDown={handleKeyDown}
            style={{
              position: 'fixed',
              top: coords.top,
              bottom: coords.bottom,
              left: coords.left,
              width: coords.width,
              maxHeight: coords.maxHeight,
            }}
            className="z-[9999] flex flex-col rounded-2xl border border-[#701604]/15 bg-white shadow-xl overflow-hidden"
          >
            {showSearch && (
              <div className="p-2 border-b border-[#701604]/10 bg-[#fcfaf8] shrink-0">
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 text-[#701604]/45 absolute left-3 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value)
                      setActiveIndex(0)
                    }}
                    placeholder={searchPlaceholder}
                    aria-label={searchPlaceholder}
                    className="w-full pl-8 pr-7 py-1.5 bg-white border border-[#701604]/15 rounded-xl text-xs font-medium text-[#1e1b15] placeholder:text-[#701604]/40 focus:outline-none focus:border-[#f29744] focus:ring-2 focus:ring-[#f29744]/20"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery('')
                        setActiveIndex(0)
                        searchInputRef.current?.focus({ preventScroll: true })
                      }}
                      title="Hapus pencarian"
                      className="absolute right-2 p-0.5 rounded-md text-[#701604]/40 hover:text-[#701604] hover:bg-[#fff7ed] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {normalizedQuery && (
                  <div className="px-1 pt-1.5 flex items-center justify-between text-[10px] font-bold text-[#701604]/55">
                    <span>Menampilkan {navigableOptions.length} dari {allOptions.length} pilihan</span>
                  </div>
                )}
              </div>
            )}

            <div className="overflow-y-auto p-1.5 space-y-0.5 flex-1">
              {navigableOptions.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs font-semibold text-[#701604]/50">
                  {emptyMessage}
                </div>
              ) : (
                <>
                  {filteredTopOptions.map((opt) => renderOptionRow(opt))}
                  {filteredGroups.map((group) => (
                    <div key={group.label} className="pt-1 first:pt-0">
                      <div className="px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#701604]/50 select-none">
                        {group.label}
                      </div>
                      <div className="space-y-0.5">
                        {group.options.map((opt) => renderOptionRow(opt))}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>,
          document.body
        )
      : null

  return (
    <div className={cn('relative', label ? 'flex flex-col gap-1.5' : '', className)}>
      {label && (
        <label
          htmlFor={id ?? generatedId}
          className="text-xs font-bold text-[#544437]/80 uppercase tracking-wide"
        >
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      {required && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          name={name}
          value={value}
          required={required}
          onChange={() => {}}
          className="sr-only pointer-events-none absolute bottom-0 left-1/2 h-0 w-0 opacity-0"
        />
      )}

      <button
        ref={triggerRef}
        id={id ?? generatedId}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => (open ? closeMenu(false) : openMenu())}
        onKeyDown={handleKeyDown}
        className={cn(
          'w-full flex items-center justify-between gap-2 bg-white border border-[#701604]/15 text-left font-bold text-[#701604] shadow-2xs transition-all cursor-pointer focus:outline-none focus:border-[#f29744] focus:ring-2 focus:ring-[#f29744]/20 disabled:opacity-50 disabled:cursor-not-allowed',
          SIZE_CLASSES[size],
          open && 'border-[#f29744] ring-2 ring-[#f29744]/20',
          triggerClassName
        )}
      >
        <span className="flex items-center gap-2 min-w-0 flex-1">
          {leadingIcon && (
            <span className="shrink-0 text-[#701604]/50 flex items-center">
              {leadingIcon}
            </span>
          )}
          <span
            className={cn(
              'truncate',
              selectedOption ? 'text-current' : 'text-[#701604]/45 font-medium'
            )}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span
              className={cn(
                'px-1.5 py-0.5 text-[10px] font-bold rounded-md border shrink-0',
                BADGE_TONE_CLASSES[selectedOption.badgeTone ?? 'neutral']
              )}
            >
              {selectedOption.badge}
            </span>
          )}
        </span>

        <span className="flex items-center gap-1 shrink-0">
          {canClear && (
            <span
              role="button"
              tabIndex={0}
              title={clearTitle}
              aria-label={clearTitle}
              onClick={(e) => {
                e.stopPropagation()
                onChange(clearValue)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.stopPropagation()
                  onChange(clearValue)
                }
              }}
              className="p-0.5 rounded-md text-[#701604]/40 hover:text-[#701604] hover:bg-[#fff7ed] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={cn(
              'w-4 h-4 text-[#701604]/45 transition-transform duration-150 shrink-0',
              open && 'rotate-180 text-[#f29744]'
            )}
          />
        </span>
      </button>

      {popover}
    </div>
  )
}
