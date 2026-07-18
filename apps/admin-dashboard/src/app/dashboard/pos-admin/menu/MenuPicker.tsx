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
        className="w-full input flex items-center justify-between text-left focus:outline-none focus:ring-2 focus:ring-amber-500/50 bg-white"
      >
        <span className="truncate flex items-center gap-2">
          {selectedItem ? (
            <>
              <div className="w-6 h-6 relative rounded-md overflow-hidden bg-gray-100 shrink-0 border border-gray-200">
                {selectedItem.image_url ? (
                  <img 
                    src={selectedItem.image_url} 
                    alt={selectedItem.name} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-3 h-3 text-gray-400" />
                  </div>
                )}
              </div>
              <span className="text-gray-900 font-medium text-sm truncate">{selectedItem.name}</span>
            </>
          ) : (
            <span className="text-gray-400">-- Pilih Menu --</span>
          )}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden flex flex-col">
          {/* Search Input */}
          <div className="p-2 border-b border-gray-100 flex items-center gap-2 bg-gray-50/50">
            <Search className="w-4 h-4 text-gray-400 shrink-0 ml-1" />
            <input
              type="text"
              autoFocus
              placeholder="Cari menu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent border-none focus:outline-none text-sm py-1 placeholder:text-gray-400 text-gray-900"
            />
          </div>

          {/* List Options */}
          <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
            {filteredItems.length === 0 ? (
              <div className="py-4 text-center text-sm text-gray-500">
                Tidak ada menu ditemukan
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
                    className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors ${
                      isSelected ? 'bg-amber-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden pr-2">
                      <div className="w-10 h-10 relative rounded-lg overflow-hidden bg-gray-100 shrink-0 border border-gray-200">
                        {item.image_url ? (
                          <img 
                            src={item.image_url} 
                            alt={item.name} 
                            className="w-full h-full object-cover" 
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col truncate">
                        <span className={`text-sm truncate ${isSelected ? 'font-semibold text-amber-900' : 'font-medium text-gray-900'}`}>
                          {item.name}
                        </span>
                        <span className="text-xs text-gray-500 font-medium">
                          {formatRupiah(item.price)}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-amber-600 shrink-0 mr-1" />
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
