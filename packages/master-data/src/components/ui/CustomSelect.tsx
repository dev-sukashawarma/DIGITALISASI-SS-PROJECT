'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
}

interface CustomSelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  searchable?: boolean
  searchPlaceholder?: string
  className?: string
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Pilih opsi',
  disabled = false,
  searchable,
  searchPlaceholder = 'Cari pilihan...',
  className = '',
}: CustomSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const showSearch = searchable ?? options.length > 5

  useEffect(() => {
    if (!open) {
      setQuery('')
      return undefined
    }
    if (!showSearch) return undefined
    const raf = requestAnimationFrame(() => {
      searchInputRef.current?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(raf)
  }, [open, showSearch])

  useEffect(() => {
    if (!open) return
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [open])

  const selected = options.find((opt) => opt.value === value)
  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((opt) => opt.label.toLowerCase().includes(q))
  }, [options, query])

  return (
    <div ref={containerRef} className={`relative mt-1 ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-[#701604]/15 bg-white px-3 py-2 text-left text-sm font-medium text-[#1e1b15] transition-colors hover:border-[#701604]/30 focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/20 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
      >
        <span className={`truncate ${selected ? 'text-[#1e1b15]' : 'text-[#701604]/45'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#701604]/45 transition-transform ${open ? 'rotate-180 text-suka-orange' : ''}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-2xl border border-[#701604]/15 bg-white shadow-xl"
        >
          {showSearch && (
            <div className="border-b border-[#701604]/10 bg-[#fcfaf8] p-2">
              <div className="relative flex items-center">
                <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-[#701604]/45" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-xl border border-[#701604]/15 bg-white py-1.5 pl-8 pr-7 text-xs font-medium text-[#1e1b15] placeholder:text-[#701604]/40 focus:border-suka-orange focus:outline-none"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-2 rounded p-0.5 text-[#701604]/40 hover:text-[#701604]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="max-h-56 overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-[#701604]/50">
                Tidak ada pilihan yang cocok
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value
                return (
                  <button
                    key={`${opt.value}-${opt.label}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(opt.value)
                      setOpen(false)
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                      isSelected
                        ? 'bg-[#fff7ed] font-bold text-[#701604]'
                        : 'font-medium text-[#1e1b15]/85 hover:bg-[#fcfaf8]'
                    }`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-suka-orange" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
