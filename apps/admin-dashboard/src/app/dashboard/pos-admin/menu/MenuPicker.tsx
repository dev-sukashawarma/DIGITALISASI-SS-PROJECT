'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown, Check, ImageIcon } from 'lucide-react'
import { formatRupiah } from '@/lib/validations'
import type { MenuItem } from '@/pos-types'

interface MenuPickerProps {
  value: string
  onChange: (id: string) => void
  items: MenuItem[]
}

export function MenuPicker({ value, onChange, items }: MenuPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedItem = items.find(i => i.id === value)

  // Filter items based on search query
  const filteredItems = items.filter(i => 
    i.name.toLowerCase().includes(search.toLowerCase())
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
    <div className="relative flex-1" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between text-left focus:outline-none focus:ring-4 focus:ring-amber-500/20 bg-white border transition-all duration-200 rounded-xl px-3.5 py-2.5 ${
          isOpen ? 'border-amber-400 shadow-sm' : 'border-gray-200 hover:border-amber-300'
        }`}
      >
        <span className="truncate flex items-center gap-2.5">
          {selectedItem ? (
            <>
              <div className="w-7 h-7 relative rounded-lg overflow-hidden bg-gray-100 shrink-0 border border-gray-200/60 shadow-sm">
                {selectedItem.image_url ? (
                  <img 
                    src={selectedItem.image_url} 
                    alt={selectedItem.name} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                )}
              </div>
              <span className="text-gray-900 font-bold text-sm truncate">{selectedItem.name}</span>
            </>
          ) : (
            <span className="text-gray-400 font-medium text-sm">-- Pilih Menu --</span>
          )}
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isOpen ? 'text-amber-500 rotate-180' : 'text-gray-400'}`} />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute z-[100] w-[280px] sm:w-[320px] max-w-[85vw] -left-2 sm:left-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden flex flex-col origin-top-left animate-in fade-in zoom-in-95 duration-200">
          {/* Search Input */}
          <div className="p-3 border-b border-gray-100 flex items-center gap-2.5 bg-gray-50/80">
            <Search className="w-4 h-4 text-amber-500 shrink-0 ml-1" />
            <input
              type="text"
              autoFocus
              placeholder="Cari menu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent border-none focus:outline-none text-sm py-1 placeholder:text-gray-400 text-gray-900 font-medium"
            />
          </div>

          {/* List Options */}
          <div className="max-h-[300px] overflow-y-auto p-2 custom-scrollbar bg-white">
            {filteredItems.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center text-center">
                <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center mb-2">
                  <Search className="w-5 h-5 text-gray-300" />
                </div>
                <span className="text-sm text-gray-500 font-medium">Menu tidak ditemukan</span>
              </div>
            ) : (
              filteredItems.map(item => {
                const isSelected = item.id === value;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onChange(item.id)
                      setIsOpen(false)
                      setSearch('')
                    }}
                    className={`w-full flex items-center justify-between p-2.5 mb-1 last:mb-0 rounded-xl text-left transition-all duration-200 ${
                      isSelected 
                        ? 'bg-amber-50 border border-amber-200/50 shadow-sm' 
                        : 'hover:bg-gray-50 border border-transparent hover:border-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 overflow-hidden pr-2">
                      <div className="w-11 h-11 relative rounded-lg overflow-hidden bg-gray-100 shrink-0 border border-gray-200 shadow-sm">
                        {item.image_url ? (
                          <img 
                            src={item.image_url} 
                            alt={item.name} 
                            className="w-full h-full object-cover" 
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col truncate">
                        <span className={`text-sm truncate ${isSelected ? 'font-bold text-amber-900' : 'font-semibold text-gray-700'}`}>
                          {item.name}
                        </span>
                        <span className="text-[13px] text-gray-500 font-medium mt-0.5">
                          {formatRupiah(item.price)}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mr-1">
                        <Check className="w-3.5 h-3.5 text-amber-600 stroke-[3]" />
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
