'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Store, Search, Check, ChevronDown } from 'lucide-react'
import { isTestOutlet } from '@/lib/outletFilters'

export function cleanOutletName(name: string) {
  const upper = (name || '').toUpperCase().replace(/^🛒\s*/, '').trim()
  return upper.replace(/^SUKA\s+SHAWARMA\s+/i, '').replace(/^MITRA\s+SUKA\s+/i, 'MITRA ')
}

export function isExcludedOutlet(o: { id?: string; name?: string; type?: string }) {
  if (isTestOutlet(o)) return true
  const nameLower = (o.name || '').toLowerCase()
  const typeLower = (o.type || '').toLowerCase()
  if (typeLower === 'system' || nameLower.includes('global outlet')) return true
  if (typeLower === 'office' || nameLower.includes('gudang') || nameLower.includes('kantor')) return true
  if (typeLower === 'marketplace' || nameLower === 'shopee' || nameLower === 'tiktok shop') return true
  return false
}

export function isMitraOutlet(o: { id?: string; name?: string; type?: string }) {
  const typeLower = (o.type || '').toLowerCase()
  const nameUpper = (o.name || '').toUpperCase()
  return typeLower === 'mitra' || nameUpper.includes('MITRA')
}

export function OutletCombobox({
  value, outlets, onChange, className, includeAll = true, placeholder = 'Pilih outlet'
}: {
  value: string
  outlets: { id: string; name: string; type?: string }[]
  onChange: (id: string) => void
  className?: string
  includeAll?: boolean
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const topOptions = useMemo(() => {
    const list: { id: string; name: string }[] = []
    if (includeAll) {
      list.push({ id: 'all', name: 'Semua Outlet' })
    }
    const hasSSOnline = outlets.some(o => o.id === 'ss-online')
    if (hasSSOnline) {
      list.push({ id: 'ss-online', name: 'SS ONLINE' })
    }
    return list
  }, [includeAll, outlets])

  const mitraOptions = useMemo(() => {
    return outlets
      .filter((o) => !isExcludedOutlet(o) && o.id !== 'all' && o.id !== 'ss-online' && isMitraOutlet(o))
      .map((o) => ({ id: o.id, name: cleanOutletName(o.name) }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [outlets])

  const internalOptions = useMemo(() => {
    return outlets
      .filter((o) => !isExcludedOutlet(o) && o.id !== 'all' && o.id !== 'ss-online' && !isMitraOutlet(o))
      .map((o) => ({ id: o.id, name: cleanOutletName(o.name) }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [outlets])

  const filteredMitra = useMemo(() => {
    if (!query.trim()) return mitraOptions
    const q = query.toLowerCase()
    return mitraOptions.filter(o => o.name.toLowerCase().includes(q))
  }, [mitraOptions, query])

  const filteredInternal = useMemo(() => {
    if (!query.trim()) return internalOptions
    const q = query.toLowerCase()
    return internalOptions.filter(o => o.name.toLowerCase().includes(q))
  }, [internalOptions, query])

  const selectedName = useMemo(() => {
    if (value === 'all') return 'Semua Cabang'
    if (value === 'ss-online') return 'SS ONLINE'
    const found = [...mitraOptions, ...internalOptions].find(o => o.id === value)
    return found ? found.name : placeholder
  }, [value, mitraOptions, internalOptions, placeholder])

  useEffect(() => {
    if (!open) return
    searchRef.current?.focus()
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className={`relative ${className || 'w-full sm:w-auto'}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full sm:w-auto flex items-center gap-2 pl-9 pr-8 py-2.5 sm:py-2 bg-white/60 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] focus:ring-2 focus:ring-suka-orange/20 text-xs font-bold text-suka-brown outline-none cursor-pointer transition-all relative sm:min-w-[170px]"
      >
        <Store className="w-4 h-4 text-suka-brown/50 absolute left-3 top-1/2 -translate-y-1/2" />
        <span className="truncate text-left flex-1">{selectedName}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-suka-brown/40 absolute right-3 top-1/2 -translate-y-1/2 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-full sm:min-w-[240px] bg-white border border-suka-gray-200 rounded-2xl shadow-xl shadow-suka-brown/10 z-[9999] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="p-2 border-b border-suka-gray-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-suka-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari outlet..."
                className="w-full pl-8 pr-3 py-1.5 bg-suka-gray-50 rounded-xl text-xs outline-none focus:ring-1 focus:ring-suka-orange font-medium text-suka-ink"
              />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto p-1 text-xs">
            {topOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onChange(opt.id)
                  setOpen(false)
                  setQuery('')
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left font-bold transition-colors ${
                  value === opt.id ? 'bg-suka-orange/10 text-suka-orange' : 'text-suka-brown hover:bg-suka-cream/60'
                }`}
              >
                <span>{opt.name}</span>
                {value === opt.id && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            ))}

            {filteredMitra.length > 0 && (
              <div className="mt-1 pt-1 border-t border-suka-gray-100">
                <div className="px-3 py-1 text-[10px] font-bold text-suka-gray-400 uppercase tracking-wider">
                  Outlet Mitra
                </div>
                {filteredMitra.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onChange(opt.id)
                      setOpen(false)
                      setQuery('')
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left font-medium transition-colors ${
                      value === opt.id ? 'bg-suka-orange/10 text-suka-orange font-bold' : 'text-suka-ink hover:bg-suka-cream/60'
                    }`}
                  >
                    <span>{opt.name}</span>
                    {value === opt.id && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                ))}
              </div>
            )}

            {filteredInternal.length > 0 && (
              <div className="mt-1 pt-1 border-t border-suka-gray-100">
                <div className="px-3 py-1 text-[10px] font-bold text-suka-gray-400 uppercase tracking-wider">
                  Outlet Internal
                </div>
                {filteredInternal.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onChange(opt.id)
                      setOpen(false)
                      setQuery('')
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left font-medium transition-colors ${
                      value === opt.id ? 'bg-suka-orange/10 text-suka-orange font-bold' : 'text-suka-ink hover:bg-suka-cream/60'
                    }`}
                  >
                    <span>{opt.name}</span>
                    {value === opt.id && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
