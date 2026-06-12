import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search, Check, Store } from 'lucide-react'
import type { Outlet } from '@/types'

interface BranchFilterProps {
  outlets: Outlet[]
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

  const selectedName = selectedOutlet === 'all' 
    ? 'Semua Cabang' 
    : outlets.find(o => o.id === selectedOutlet)?.name || 'Pilih Cabang...'

  const filteredOutlets = outlets.filter(o => 
    o.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
        <div className="absolute top-full right-0 mt-2 w-full sm:w-72 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden animate-fade-in">
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
          <div className="max-h-60 overflow-y-auto p-2">
            <button
              onClick={() => {
                onChange('all')
                setIsOpen(false)
                setSearchQuery('')
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedOutlet === 'all' 
                  ? 'bg-amber-50 text-amber-700 font-bold' 
                  : 'text-gray-700 font-medium hover:bg-gray-50'
              }`}
            >
              Semua Cabang
              {selectedOutlet === 'all' && <Check className="w-4 h-4 text-amber-500" />}
            </button>
            
            {filteredOutlets.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-gray-400 font-medium">
                Cabang tidak ditemukan
              </div>
            ) : (
              filteredOutlets.map(o => (
                <button
                  key={o.id}
                  onClick={() => {
                    onChange(o.id)
                    setIsOpen(false)
                    setSearchQuery('')
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors mt-1 ${
                    selectedOutlet === o.id 
                      ? 'bg-amber-50 text-amber-700 font-bold' 
                      : 'text-gray-700 font-medium hover:bg-gray-50'
                  }`}
                >
                  <span className="truncate pr-2">{o.name}</span>
                  {selectedOutlet === o.id && <Check className="w-4 h-4 text-amber-500 shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
