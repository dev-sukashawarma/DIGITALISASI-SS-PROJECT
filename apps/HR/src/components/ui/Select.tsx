'use client'

import React, { useState, useRef, useEffect, useMemo, useId } from 'react'
import { ChevronDown, Check, Search, X } from 'lucide-react'

export interface SelectOption {
  label: string
  value: string
  icon?: React.ReactNode
  disabled?: boolean
}

export interface SelectProps {
  options: SelectOption[]
  value?: string | number | null
  onChange: (val: string) => void
  placeholder?: string
  className?: string
  buttonClassName?: string
  searchable?: boolean
  searchPlaceholder?: string
  disabled?: boolean
  id?: string
  name?: string
  'aria-label'?: string
  error?: boolean | string
  size?: 'sm' | 'md'
  align?: 'left' | 'right'
}

export function Select({
  options,
  value,
  onChange,
  placeholder = 'Pilih...',
  className = '',
  buttonClassName = '',
  searchable,
  searchPlaceholder = 'Cari pilihan...',
  disabled = false,
  id,
  name,
  'aria-label': ariaLabel,
  error,
  size = 'md',
  align = 'left',
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [openUpwards, setOpenUpwards] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1)

  const wrapperRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const generatedId = useId()
  const selectId = id || generatedId

  // Aturan: tambahkan searchbar jika opsi lebih dari 5, kecuali jika prop searchable di-override secara eksplisit
  const isSearchable = searchable !== undefined ? searchable : options.length > 5

  const stringValue = value !== undefined && value !== null ? String(value) : ''
  const selectedOption = useMemo(
    () => options.find((o) => String(o.value) === stringValue),
    [options, stringValue]
  )

  const filteredOptions = useMemo(() => {
    if (!isSearchable || !searchQuery.trim()) return options
    const q = searchQuery.toLowerCase().trim()
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        String(o.value).toLowerCase().includes(q)
    )
  }, [options, isSearchable, searchQuery])

  // Handle position flip jika ruang di bawah tidak cukup
  useEffect(() => {
    if (isOpen && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      if (spaceBelow < 260 && rect.top > spaceBelow) {
        setOpenUpwards(true)
      } else {
        setOpenUpwards(false)
      }
    }
  }, [isOpen])

  // Auto focus search input saat dropdown terbuka
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('')
      return undefined
    }

    setHighlightedIndex(-1)
    if (!isSearchable) {
      return undefined
    }

    const timer = setTimeout(() => {
      searchInputRef.current?.focus()
    }, 30)
    return () => clearTimeout(timer)
  }, [isOpen, isSearchable])

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    if (!isOpen) return undefined

    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Keyboard navigation (ArrowDown, ArrowUp, Enter, Escape)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setIsOpen(true)
      }
      return
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((prev) => {
        const next = prev + 1 >= filteredOptions.length ? 0 : prev + 1
        return next
      })
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((prev) => {
        const next = prev - 1 < 0 ? filteredOptions.length - 1 : prev - 1
        return next
      })
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        const opt = filteredOptions[highlightedIndex]
        if (!opt.disabled) {
          onChange(opt.value)
          setIsOpen(false)
        }
      }
    }
  }

  const pyClass = size === 'sm' ? 'py-1.5 px-2.5 text-xs' : 'py-2 px-3 text-xs sm:text-sm'

  return (
    <div
      className={`relative inline-block text-left ${className}`}
      ref={wrapperRef}
      onKeyDown={handleKeyDown}
    >
      {name && <input type="hidden" name={name} value={stringValue} />}
      <button
        id={selectId}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel || placeholder}
        aria-expanded={isOpen}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full text-left flex items-center justify-between gap-2 bg-white border rounded-xl font-medium transition-all shadow-2xs cursor-pointer outline-none ${
          disabled
            ? 'opacity-50 cursor-not-allowed bg-stone-100 text-stone-400 border-suka-gray-200'
            : error
            ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100 hover:border-red-500'
            : 'border-suka-gray-200 text-suka-ink focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/20 hover:border-suka-orange/60'
        } ${pyClass} ${buttonClassName}`}
      >
        <span className={`block truncate flex-1 ${!selectedOption ? 'text-suka-gray-400 font-normal' : 'text-suka-ink font-semibold'}`}>
          {selectedOption ? (
            <span className="inline-flex items-center gap-2 truncate">
              {selectedOption.icon && <span className="shrink-0">{selectedOption.icon}</span>}
              <span className="truncate">{selectedOption.label}</span>
            </span>
          ) : (
            placeholder
          )}
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-suka-orange' : 'text-suka-gray-400'
          }`}
        />
      </button>

      {isOpen && (
        <div
          ref={listRef}
          className={`absolute z-[100] w-full min-w-[200px] max-w-[360px] bg-white border border-suka-gray-200 rounded-2xl shadow-[0_12px_36px_rgba(44,24,16,0.12)] p-1.5 focus:outline-none animate-in fade-in-50 zoom-in-95 duration-100 ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${openUpwards ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}`}
          role="listbox"
        >
          {isSearchable && (
            <div className="p-1.5 border-b border-suka-gray-100 mb-1 sticky top-0 bg-white z-10">
              <div className="relative flex items-center">
                <Search size={13} className="absolute left-2.5 text-suka-gray-400 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setHighlightedIndex(0)
                  }}
                  placeholder={searchPlaceholder}
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-suka-gray-50 border border-suka-gray-200 rounded-lg outline-none font-medium text-suka-ink placeholder:text-suka-gray-400 focus:bg-white focus:border-suka-orange focus:ring-1 focus:ring-suka-orange/30 transition-all"
                  onClick={(e) => e.stopPropagation()}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSearchQuery('')
                      searchInputRef.current?.focus()
                    }}
                    className="absolute right-2 text-suka-gray-400 hover:text-suka-ink p-0.5 rounded cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="max-h-60 overflow-y-auto overscroll-contain space-y-0.5 scrollbar-thin">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-3 text-center text-xs text-suka-gray-400 font-medium italic">
                Tidak ada pilihan yang cocok
              </div>
            ) : (
              filteredOptions.map((option, idx) => {
                const isSelected = String(option.value) === stringValue
                const isHighlighted = idx === highlightedIndex

                return (
                  <button
                    key={`${option.value}-${idx}`}
                    type="button"
                    disabled={option.disabled}
                    onClick={() => {
                      if (!option.disabled) {
                        onChange(option.value)
                        setIsOpen(false)
                      }
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    role="option"
                    aria-selected={isSelected}
                    className={`w-full text-left flex items-center justify-between gap-2 px-3 py-2 text-xs rounded-xl transition-colors cursor-pointer ${
                      option.disabled
                        ? 'opacity-40 cursor-not-allowed text-suka-gray-400'
                        : isSelected
                        ? 'bg-suka-orange/10 text-suka-brown font-bold'
                        : isHighlighted
                        ? 'bg-suka-cream/60 text-suka-ink font-semibold'
                        : 'text-suka-ink hover:bg-suka-cream/40 font-medium'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      {option.icon && <span className="shrink-0">{option.icon}</span>}
                      <span className="truncate">{option.label}</span>
                    </span>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 shrink-0 text-suka-orange" />
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
