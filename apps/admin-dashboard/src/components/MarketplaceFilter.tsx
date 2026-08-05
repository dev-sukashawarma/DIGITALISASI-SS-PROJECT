import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, ShoppingBag } from 'lucide-react'
import type { Outlet } from '@/pos-types'

interface MarketplaceFilterProps {
  platforms: Outlet[]
  selectedOutlet: string
  onChange: (id: string) => void
  className?: string
}

export default function MarketplaceFilter({
  platforms,
  selectedOutlet,
  onChange,
  className = "w-full sm:w-56",
}: MarketplaceFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
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
    ? 'SS Online'
    : platforms.find(p => p.id === selectedOutlet)?.name || 'SS Online'

  return (
    <div className={`relative z-50 ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-white border border-gray-200 hover:border-amber-400 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-700 transition-all shadow-sm outline-none focus:ring-2 focus:ring-amber-500/20"
      >
        <div className="flex items-center gap-2 truncate">
          <ShoppingBag className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="truncate">{selectedName}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-full sm:w-64 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden animate-fade-in">
          <div className="max-h-60 overflow-y-auto p-2">
            <button
              onClick={() => { onChange('all'); setIsOpen(false) }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedOutlet === 'all'
                  ? 'bg-amber-50 text-amber-700 font-bold'
                  : 'text-gray-700 font-medium hover:bg-gray-50'
              }`}
            >
              Semua Platform Online
              {selectedOutlet === 'all' && <Check className="w-4 h-4 text-amber-500" />}
            </button>

            {platforms.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-gray-400 font-medium">
                Belum ada platform terdaftar
              </div>
            ) : (
              platforms.map(p => (
                <button
                  key={p.id}
                  onClick={() => { onChange(p.id); setIsOpen(false) }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors mt-1 ${
                    selectedOutlet === p.id
                      ? 'bg-amber-50 text-amber-700 font-bold'
                      : 'text-gray-700 font-medium hover:bg-gray-50'
                  }`}
                >
                  <span className="truncate pr-2">{p.name}</span>
                  {selectedOutlet === p.id && <Check className="w-4 h-4 text-amber-500 shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
