'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Store, Search, Check, ChevronDown } from 'lucide-react'

export function cleanOutletName(name: string) {
  const upper = (name || '').toUpperCase()
  return upper.replace('SUKA SHAWARMA ', '').replace('MITRA SUKA ', 'MITRA ')
}

export function OutletCombobox({
  value, outlets, onChange, className, includeAll = true, placeholder = 'Pilih outlet'
}: {
  value: string
  outlets: { id: string; name: string }[]
  onChange: (id: string) => void
  className?: string
  includeAll?: boolean
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const options = useMemo(
    () => [
      ...(includeAll ? [{ id: 'all', name: 'Semua Outlet' }] : []),
      ...outlets.map((o) => ({ id: o.id, name: cleanOutletName(o.name) })),
    ],
    [includeAll, outlets]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.name.toLowerCase().includes(q))
  }, [options, query])

  const selectedLabel = options.find((o) => o.id === value)?.name ?? placeholder

  useEffect(() => {
    if (!open) return
    searchRef.current?.focus()
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
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className={`relative w-full sm:w-auto ${className || ''}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full sm:w-auto flex items-center gap-2 pl-9 pr-8 py-2.5 sm:py-2 bg-suka-cream/30 border border-suka-gray-200 focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/10 rounded-xl text-xs font-bold text-suka-brown outline-none cursor-pointer transition-all relative min-w-[150px] sm:min-w-[180px]"
      >
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-suka-brown/50">
          <Store className="w-4 h-4" />
        </span>
        <span className="truncate text-left flex-1">{selectedLabel}</span>
        <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-suka-brown/40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-20 mt-1.5 w-full sm:w-64 left-0 bg-white border border-suka-gray-200 rounded-xl shadow-lg shadow-suka-brown/10 overflow-hidden">
          <div className="relative p-2 border-b border-suka-gray-100">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-suka-brown/40" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari outlet..."
              className="w-full pl-7 pr-2 py-1.5 text-xs font-semibold text-suka-brown bg-suka-cream/40 rounded-lg outline-none focus:ring-2 focus:ring-suka-orange/15 placeholder:text-suka-brown/30 placeholder:font-medium"
            />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-xs text-suka-brown/40 font-medium italic">Outlet tidak ditemukan</li>
            )}
            {filtered.map((o) => {
              const isActive = o.id === value
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(o.id)
                      setOpen(false)
                      setQuery('')
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-bold text-left transition-colors ${
                      isActive ? 'bg-suka-orange/10 text-suka-orange' : 'text-suka-brown hover:bg-suka-cream/60'
                    }`}
                  >
                    <span className="truncate">{o.name}</span>
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
