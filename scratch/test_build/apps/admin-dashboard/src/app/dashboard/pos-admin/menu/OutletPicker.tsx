'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown, Check, MapPin } from 'lucide-react'
import type { Outlet } from '@/pos-types'

interface OutletPickerProps {
  value: string | null
  onChange: (id: string | null) => void
  outlets: Outlet[]
}

export function OutletPicker({ value, onChange, outlets }: OutletPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOutlet = outlets.find(o => o.id === value)

  // Filter outlets based on search query
  const filteredOutlets = outlets.filter(o => 
    o.name.toLowerCase().includes(search.toLowerCase())
  )

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between text-left focus:outline-none focus:ring-4 focus:ring-fuchsia-500/20 bg-white border transition-all duration-200 rounded-xl px-3.5 py-3 ${
          isOpen ? 'border-fuchsia-400 shadow-sm' : 'border-fuchsia-200 hover:border-fuchsia-300'
        }`}
      >
        <span className="truncate flex items-center gap-2.5">
          {selectedOutlet ? (
            <>
              <div className="w-7 h-7 relative rounded-lg bg-fuchsia-50 flex items-center justify-center shrink-0 border border-fuchsia-100">
                <MapPin className="w-4 h-4 text-fuchsia-500" />
              </div>
              <span className="text-gray-900 font-bold text-sm truncate">{selectedOutlet.name}</span>
            </>
          ) : (
            <span className="text-gray-400 font-medium text-sm">-- Pilih Outlet --</span>
          )}
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isOpen ? 'text-fuchsia-500 rotate-180' : 'text-gray-400'}`} />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute z-[100] w-full mt-2 bg-white border border-fuchsia-100 rounded-xl shadow-xl overflow-hidden flex flex-col origin-top animate-in fade-in zoom-in-95 duration-200">
          {/* Search Input */}
          <div className="p-3 border-b border-gray-100 flex items-center gap-2.5 bg-gray-50/80">
            <Search className="w-4 h-4 text-fuchsia-500 shrink-0 ml-1" />
            <input
              type="text"
              autoFocus
              placeholder="Cari outlet..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent border-none focus:outline-none text-sm py-1 placeholder:text-gray-400 text-gray-900 font-medium"
            />
          </div>

          {/* List Options */}
          <div className="max-h-[250px] overflow-y-auto p-2 custom-scrollbar bg-white">
            {filteredOutlets.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center text-center">
                <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center mb-2">
                  <Search className="w-5 h-5 text-gray-300" />
                </div>
                <span className="text-sm text-gray-500 font-medium">Outlet tidak ditemukan</span>
              </div>
            ) : (
              filteredOutlets.map(outlet => {
                const isSelected = outlet.id === value;
                return (
                  <button
                    key={outlet.id}
                    type="button"
                    onClick={() => {
                      onChange(outlet.id)
                      setIsOpen(false)
                      setSearch('')
                    }}
                    className={`w-full flex items-center justify-between p-2.5 mb-1 last:mb-0 rounded-xl text-left transition-all duration-200 ${
                      isSelected 
                        ? 'bg-fuchsia-50 border border-fuchsia-200/50 shadow-sm' 
                        : 'hover:bg-gray-50 border border-transparent hover:border-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 overflow-hidden pr-2">
                      <div className="w-9 h-9 relative rounded-lg bg-gray-50 flex items-center justify-center shrink-0 border border-gray-100">
                        <MapPin className={`w-4 h-4 ${isSelected ? 'text-fuchsia-500' : 'text-gray-400'}`} />
                      </div>
                      <div className="flex flex-col truncate">
                        <span className={`text-sm truncate ${isSelected ? 'font-bold text-fuchsia-900' : 'font-semibold text-gray-700'}`}>
                          {outlet.name}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-fuchsia-100 flex items-center justify-center shrink-0 mr-1">
                        <Check className="w-3.5 h-3.5 text-fuchsia-600 stroke-[3]" />
                      </div>
                    )}
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
