import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search, Check } from 'lucide-react'

export interface Option {
  id: string
  name: string
}

interface MultiSelectDropdownProps {
  options: Option[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
  icon?: React.ElementType
  className?: string
  allLabel?: string
}

export default function MultiSelectDropdown({ 
  options, 
  selectedIds, 
  onChange, 
  placeholder = "Pilih...", 
  icon: Icon,
  className = "w-full sm:w-64",
  allLabel = "Semua"
}: MultiSelectDropdownProps) {
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

  const isAllSelected = selectedIds.includes('all') || selectedIds.length === 0 || selectedIds.length === options.length

  const selectedName = isAllSelected
    ? allLabel
    : selectedIds.length === 1
      ? options.find(o => o.id === selectedIds[0])?.name || placeholder
      : `${selectedIds.length} Terpilih`

  const filteredOptions = options.filter(o => 
    o.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const toggleOption = (id: string) => {
    if (id === 'all') {
      onChange(['all'])
      return
    }

    let newSelected = selectedIds.filter(x => x !== 'all')
    if (newSelected.includes(id)) {
      newSelected = newSelected.filter(x => x !== id)
    } else {
      newSelected.push(id)
    }

    if (newSelected.length === 0 || newSelected.length === options.length) {
      onChange(['all'])
    } else {
      onChange(newSelected)
    }
  }

  return (
    <div className={`relative z-50 ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-white border border-gray-200 hover:border-amber-400 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 transition-all shadow-sm outline-none focus:ring-2 focus:ring-amber-500/20"
      >
        <div className="flex items-center gap-2 truncate">
          {Icon && <Icon className="w-4 h-4 text-amber-500 shrink-0" />}
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
                placeholder="Cari..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-transparent focus:border-amber-400 rounded-lg text-sm font-medium outline-none transition-colors"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto p-2 space-y-1">
            {/* Opsi Semua */}
            <button
              type="button"
              onClick={() => toggleOption('all')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                isAllSelected
                  ? 'bg-amber-50/80 text-amber-900 font-semibold' 
                  : 'text-gray-700 font-medium hover:bg-gray-50'
              }`}
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0 ${
                isAllSelected 
                  ? 'bg-amber-500 border-amber-500 text-white' 
                  : 'border-gray-300 bg-white'
              }`}>
                {isAllSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
              </div>
              <span className="truncate flex-1">{allLabel}</span>
            </button>
            
            <div className="h-px bg-gray-100 my-1" />

            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-gray-400 font-medium">
                Tidak ditemukan
              </div>
            ) : (
              filteredOptions.map(o => {
                const isSelected = !isAllSelected && selectedIds.includes(o.id)
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => toggleOption(o.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                      isSelected
                        ? 'bg-amber-50/80 text-amber-900 font-semibold' 
                        : 'text-gray-700 font-medium hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0 ${
                      isSelected 
                        ? 'bg-amber-500 border-amber-500 text-white' 
                        : 'border-gray-300 bg-white'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                    </div>
                    <span className="truncate flex-1">{o.name}</span>
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
