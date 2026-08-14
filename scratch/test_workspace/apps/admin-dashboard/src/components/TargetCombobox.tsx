'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, Check, Search, Store } from 'lucide-react'

export interface TargetOption {
  value: string
  label: string
  icon?: React.ReactNode
}

interface TargetComboboxProps {
  value: string
  options: TargetOption[]
  onChange: (val: string) => void
  placeholder?: string
  className?: string
  icon?: React.ReactNode
}

export function TargetCombobox({
  value,
  options,
  onChange,
  placeholder = 'Pilih target...',
  className = '',
  icon = <Store className="w-4 h-4" />
}: TargetComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query])

  const selectedOption = options.find((o) => o.value === value)
  const selectedLabel = selectedOption?.label ?? placeholder

  useEffect(() => {
    if (!open) return
    // Focus search input after a brief moment to ensure render
    const timeout = setTimeout(() => searchRef.current?.focus(), 50)
    
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      clearTimeout(timeout)
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className={`relative w-full sm:w-auto ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full sm:w-auto flex items-center gap-2 pl-9 pr-8 py-2.5 sm:py-2 bg-suka-cream/30 border border-suka-gray-200 focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/10 rounded-xl text-xs font-bold text-suka-brown outline-none cursor-pointer transition-all relative sm:min-w-[180px]"
      >
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-suka-brown/50">
          {selectedOption?.icon ?? icon}
        </span>
        <span className="truncate text-left flex-1">{selectedLabel}</span>
        <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-suka-brown/40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full sm:w-64 sm:right-0 sm:left-auto left-0 bg-white border border-suka-gray-200 rounded-xl shadow-lg shadow-suka-brown/10 overflow-hidden">
          <div className="relative p-2 border-b border-suka-gray-100">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-suka-brown/40" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari..."
              className="w-full pl-7 pr-2 py-1.5 text-xs font-semibold text-suka-brown bg-suka-cream/40 rounded-lg outline-none focus:ring-2 focus:ring-suka-orange/15 placeholder:text-suka-brown/30 placeholder:font-medium"
            />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-xs text-suka-brown/40 font-medium italic">Tidak ditemukan</li>
            )}
            {filtered.map((o) => {
              const isActive = o.value === value
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(o.value)
                      setOpen(false)
                      setQuery('')
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-bold text-left transition-colors ${
                      isActive ? 'bg-suka-orange/10 text-suka-orange' : 'text-suka-brown hover:bg-suka-cream/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {o.icon && <span className="shrink-0">{o.icon}</span>}
                      <span className="truncate">{o.label}</span>
                    </div>
                    {isActive && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
