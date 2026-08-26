import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, Search, Check, Store } from 'lucide-react'
import type { Outlet } from '@/pos-types'
import { isExcludedOutlet, isMitraOutlet, cleanOutletName } from './OutletCombobox'

interface BranchFilterProps {
  outlets: (Outlet | { id: string; name: string; type?: string })[]
  selectedOutlet: string
  onChange: (id: string) => void
  className?: string
}

export default function BranchFilter({ outlets, selectedOutlet, onChange, className = "w-full sm:w-64" }: BranchFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 1. Top Options: Semua Cabang & SS ONLINE
  const topOptions = useMemo(() => {
    const list = [{ id: 'all', name: 'Semua Cabang' }]
    if (outlets.some(o => o.id === 'ss-online')) {
      list.push({ id: 'ss-online', name: 'SS ONLINE' })
    }
    return list
  }, [outlets])

  // 2. Mitra
  const mitraOptions = useMemo(() => {
    return outlets
      .filter((o) => !isExcludedOutlet(o as any) && o.id !== 'all' && o.id !== 'ss-online' && isMitraOutlet(o as any))
      .map((o) => ({ id: o.id, name: cleanOutletName(o.name) }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [outlets])

  // 3. Internal
  const internalOptions = useMemo(() => {
    return outlets
      .filter((o) => !isExcludedOutlet(o as any) && o.id !== 'all' && o.id !== 'ss-online' && !isMitraOutlet(o as any))
      .map((o) => ({ id: o.id, name: cleanOutletName(o.name) }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [outlets])

  const q = searchQuery.trim().toLowerCase()
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

  const selectedName = useMemo(() => {
    if (selectedOutlet === 'all') return 'Semua Cabang'
    if (selectedOutlet === 'ss-online') return 'SS ONLINE'
    const found = [...mitraOptions, ...internalOptions].find(o => o.id === selectedOutlet)
    return found?.name || 'Pilih Cabang...'
  }, [selectedOutlet, mitraOptions, internalOptions])

  return (
    <div className={`relative z-50 ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-white border border-gray-200 hover:border-amber-400 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-700 transition-all shadow-sm outline-none focus:ring-2 focus:ring-amber-500/20"
      >
        <div className="flex items-center gap-2 truncate">
          <Store className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="truncate">{selectedName}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-full sm:w-72 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden animate-fade-in">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                autoFocus
                placeholder="Cari cabang..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-transparent focus:border-amber-400 rounded-lg text-sm font-medium outline-none transition-colors"
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto p-1.5 space-y-1">
            {/* Top Options (Semua Cabang, SS ONLINE) */}
            {filteredTop.map(o => (
              <button
                key={o.id}
                onClick={() => {
                  onChange(o.id)
                  setIsOpen(false)
                  setSearchQuery('')
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
                  selectedOutlet === o.id 
                    ? 'bg-amber-50 text-amber-700 font-bold' 
                    : 'text-gray-700 font-medium hover:bg-gray-50'
                }`}
              >
                <span className="truncate pr-2">{o.name}</span>
                {selectedOutlet === o.id && <Check className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
              </button>
            ))}

            {/* Separator / Header: Outlet Mitra */}
            {filteredMitra.length > 0 && (
              <div className="pt-2">
                <div className="px-3 py-1 text-[10px] font-extrabold text-gray-400 uppercase tracking-wider border-t border-gray-100 flex items-center justify-between">
                  <span>Outlet Mitra</span>
                  <span className="text-[9px] font-semibold text-gray-400">({filteredMitra.length})</span>
                </div>
                {filteredMitra.map(o => (
                  <button
                    key={o.id}
                    onClick={() => {
                      onChange(o.id)
                      setIsOpen(false)
                      setSearchQuery('')
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
                      selectedOutlet === o.id 
                        ? 'bg-amber-50 text-amber-700 font-bold' 
                        : 'text-gray-700 font-medium hover:bg-gray-50'
                    }`}
                  >
                    <span className="truncate pr-2">{o.name}</span>
                    {selectedOutlet === o.id && <Check className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                  </button>
                ))}
              </div>
            )}

            {/* Separator / Header: Outlet Internal */}
            {filteredInternal.length > 0 && (
              <div className="pt-2">
                <div className="px-3 py-1 text-[10px] font-extrabold text-gray-400 uppercase tracking-wider border-t border-gray-100 flex items-center justify-between">
                  <span>Outlet Internal</span>
                  <span className="text-[9px] font-semibold text-gray-400">({filteredInternal.length})</span>
                </div>
                {filteredInternal.map(o => (
                  <button
                    key={o.id}
                    onClick={() => {
                      onChange(o.id)
                      setIsOpen(false)
                      setSearchQuery('')
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
                      selectedOutlet === o.id 
                        ? 'bg-amber-50 text-amber-700 font-bold' 
                        : 'text-gray-700 font-medium hover:bg-gray-50'
                    }`}
                  >
                    <span className="truncate pr-2">{o.name}</span>
                    {selectedOutlet === o.id && <Check className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                  </button>
                ))}
              </div>
            )}

            {filteredTop.length === 0 && filteredMitra.length === 0 && filteredInternal.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-gray-400 font-medium italic">
                Cabang tidak ditemukan
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
