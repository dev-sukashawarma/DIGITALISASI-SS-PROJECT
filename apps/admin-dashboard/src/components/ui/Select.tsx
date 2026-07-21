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

  // Close dropdown when clicking outside
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
    : options;

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left flex items-center justify-between bg-white border border-suka-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-suka-brown/20 transition-shadow"
      >
        <span className={`block truncate flex-1 pr-2 ${!selectedOption ? 'text-suka-gray-400' : 'text-suka-ink'}`}>
          {selectedOption ? (
            <span className="flex items-center gap-2">
              {selectedOption.icon && <span className="shrink-0">{selectedOption.icon}</span>}
              <span className="truncate">{selectedOption.label}</span>
            </span>
          ) : (
            placeholder
          )}
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-suka-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-suka-gray-200 rounded-lg shadow-lg py-1 max-h-60 overflow-auto focus:outline-none">
          {searchable && (
            <div className="px-2 pb-2 pt-1 sticky top-0 bg-white z-10 border-b border-suka-gray-100 mb-1">
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange/30 placeholder:text-gray-400"
              />
            </div>
          )}
          {filteredOptions.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500 italic">Tidak ditemukan</div>
          )}
          {filteredOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value)
                setIsOpen(false)
              }}
              className={`w-full text-left flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-suka-gray-50 transition-colors ${
                value === option.value ? 'bg-suka-orange/5 text-suka-brown font-semibold' : 'text-suka-ink'
              }`}
            >
              <span className="flex items-center gap-2 flex-1 pr-2">
                {option.icon && <span className="shrink-0">{option.icon}</span>}
                <span className="break-words line-clamp-2">{option.label}</span>
              </span>
              {value === option.value && <Check className="w-4 h-4 shrink-0 text-suka-brown" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
