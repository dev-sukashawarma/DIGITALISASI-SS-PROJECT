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

export function Select({
  options,
  value,
  onChange,
  placeholder = 'Pilih...',
  className = '',
  searchable = false,
  searchPlaceholder = 'Cari...',
}: SelectProps) {
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
    ? options.filter((o) => o.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : options

  return (
    <div className={`relative ${isOpen ? 'z-50' : 'z-10'} ${className}`} ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left flex items-center justify-between bg-white border border-suka-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-suka-ink focus:outline-none focus:ring-2 focus:ring-suka-orange/20 hover:border-suka-orange/50 transition-all shadow-2xs cursor-pointer"
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
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-suka-gray-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-suka-orange' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-[100] mt-1 w-full min-w-[220px] bg-white border border-suka-gray-200 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] py-1.5 max-h-64 overflow-auto focus:outline-none backdrop-blur-md">
          {searchable && (
            <div className="px-2 pb-2 pt-1 sticky top-0 bg-white z-10 border-b border-suka-gray-100 mb-1">
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange/30 placeholder:text-gray-400 font-medium"
              />
            </div>
          )}
          {filteredOptions.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-500 italic">Tidak ditemukan</div>
          )}
          {filteredOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value)
                setIsOpen(false)
              }}
              className={`w-full text-left flex items-center justify-between px-3 py-2 text-xs cursor-pointer hover:bg-suka-gray-50 transition-colors ${
                value === option.value ? 'bg-suka-orange/10 text-suka-brown font-bold' : 'text-suka-ink font-medium'
              }`}
            >
              <span className="flex items-center gap-2 flex-1 pr-2">
                {option.icon && <span className="shrink-0">{option.icon}</span>}
                <span className="break-words line-clamp-2">{option.label}</span>
              </span>
              {value === option.value && <Check className="w-4 h-4 shrink-0 text-suka-orange" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
