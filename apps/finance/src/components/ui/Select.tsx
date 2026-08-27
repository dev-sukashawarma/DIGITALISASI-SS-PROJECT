'use client'

import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export interface SelectOption {
  label: string
  value: string
  icon?: React.ReactNode
}

interface SelectProps {
  options: SelectOption[]
  value: string
  onChange: (val: string) => void
  placeholder?: string
  className?: string
  searchable?: boolean
  searchPlaceholder?: string
}

export function Select({ options, value, onChange, placeholder = 'Pilih...', className = '', searchable = false, searchPlaceholder = 'Cari...' }: SelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const selectedOption = options.find((o) => o.value === value)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (isOpen && searchable) {
      setTimeout(() => searchInputRef.current?.focus(), 50)
    } else {
      setSearchQuery('')
    }
  }, [isOpen, searchable])

  const filteredOptions = searchable 
    ? options.filter(o => o.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : options

  return (
    <div className={`relative ${isOpen ? 'z-50' : 'z-10'} ${className}`} ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left flex items-center justify-between bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-suka-brown focus:outline-none focus:ring-2 focus:ring-suka-orange/20 hover:border-suka-orange/50 transition-all shadow-sm"
      >
        <span className={`block truncate flex-1 pr-2 ${!selectedOption ? 'text-gray-400' : 'text-suka-brown'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {searchable && (
            <div className="p-2 border-b border-gray-100">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full px-2.5 py-1.5 bg-gray-50 border border-transparent focus:border-suka-orange rounded-lg text-xs font-medium outline-none transition-colors"
              />
            </div>
          )}
          <div className="max-h-56 overflow-y-auto p-1 text-xs">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-gray-400 text-center font-medium">
                Tidak ada opsi
              </div>
            ) : (
              filteredOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value)
                    setIsOpen(false)
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left font-medium transition-colors ${
                    value === opt.value
                      ? 'bg-suka-orange/10 text-suka-orange font-bold'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {opt.icon}
                    <span className="truncate">{opt.label}</span>
                  </div>
                  {value === opt.value && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
