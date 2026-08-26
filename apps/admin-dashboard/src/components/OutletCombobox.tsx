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

  // 1. Top Options: Semua Outlet & SS ONLINE (tanpa icon keranjang)
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

  // 2. Outlet Mitra
  const mitraOptions = useMemo(() => {
    return outlets
      .filter((o) => !isExcludedOutlet(o) && o.id !== 'all' && o.id !== 'ss-online' && isMitraOutlet(o))
      .map((o) => ({ id: o.id, name: cleanOutletName(o.name) }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [outlets])

  // 3. Outlet Internal
  const internalOptions = useMemo(() => {
    return outlets
      .filter((o) => !isExcludedOutlet(o) && o.id !== 'all' && o.id !== 'ss-online' && !isMitraOutlet(o))
      .map((o) => ({ id: o.id, name: cleanOutletName(o.name) }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [outlets])

  // Filter based on search query
  const q = query.trim().toLowerCase()
  const filteredTop = useMemo(() => {
    if (!q) return topOptions
    return topOptions.filter(o => o.name.toLowerCase().includes(q))
  }, [topOptions, q])

  const filteredMitra = useMemo(() => {
    if (!q) return mitraOptions
    return mitraOptions.filter(o => o.name.toLowerCase().includes(q))
  }, [mitraOptions, q])

  const filteredInternal = useMemo(() => {
    if (!q) return internalOptions
    return internalOptions.filter(o => o.name.toLowerCase().includes(q))
  }, [internalOptions, q])

  // Determine Selected Label
  const selectedLabel = useMemo(() => {
    if (value === 'all') return 'Semua Outlet'
    if (value === 'ss-online') return 'SS ONLINE'
    const found = [...mitraOptions, ...internalOptions].find((o) => o.id === value)
    return found?.name ?? placeholder
  }, [value, mitraOptions, internalOptions, placeholder])

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
          <ul className="max-h-72 overflow-y-auto py-1">
            {/* Top Options (Semua Outlet & SS ONLINE) */}
            {filteredTop.map((o) => {
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

            {/* Separator / Header: Outlet Mitra */}
            {filteredMitra.length > 0 && (
              <li>
                <div className="px-3 pt-2.5 pb-1 text-[10px] font-extrabold text-suka-brown/50 uppercase tracking-wider border-t border-suka-gray-100 flex items-center justify-between">
                  <span>Outlet Mitra</span>
                  <span className="text-[9px] font-semibold text-suka-gray-400">({filteredMitra.length})</span>
                </div>
                <ul>
                  {filteredMitra.map((o) => {
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
              </li>
            )}

            {/* Separator / Header: Outlet Internal */}
            {filteredInternal.length > 0 && (
              <li>
                <div className="px-3 pt-2.5 pb-1 text-[10px] font-extrabold text-suka-brown/50 uppercase tracking-wider border-t border-suka-gray-100 flex items-center justify-between">
                  <span>Outlet Internal</span>
                  <span className="text-[9px] font-semibold text-suka-gray-400">({filteredInternal.length})</span>
                </div>
                <ul>
                  {filteredInternal.map((o) => {
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
              </li>
            )}

            {filteredTop.length === 0 && filteredMitra.length === 0 && filteredInternal.length === 0 && (
              <li className="px-3 py-4 text-xs text-suka-brown/40 font-medium italic text-center">
                Outlet tidak ditemukan
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

