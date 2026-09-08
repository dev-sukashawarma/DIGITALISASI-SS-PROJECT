'use client'

import { useState, useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, X, Check, RotateCcw } from 'lucide-react'

export interface CustomDateRange {
  startDate: string // YYYY-MM-DD
  endDate: string   // YYYY-MM-DD
}

interface CustomDateFilterProps {
  startDate?: string
  endDate?: string
  isActive?: boolean
  onApply: (range: CustomDateRange) => void
  onReset?: () => void
  variant?: 'dark' | 'light'
  className?: string
}

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
]

const getTodayJakarta = (): string => {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}

const formatDateDisplay = (dateStr: string): string => {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  const year = parts[0]
  const monthIdx = parseInt(parts[1], 10) - 1
  const day = parts[2]
  return `${day} ${MONTHS_SHORT[monthIdx] || parts[1]} ${year}`
}

export const formatRangeLabel = (start?: string, end?: string): string => {
  if (!start && !end) return 'Kustom'
  if (start && !end) return `Dari ${formatDateDisplay(start)}`
  if (!start && end) return `S/d ${formatDateDisplay(end)}`
  if (start === end) return formatDateDisplay(start!)

  const [sY, sM, sD] = (start || '').split('-')
  const [eY, eM, eD] = (end || '').split('-')

  if (sY === eY && sM === eM) {
    const monthName = MONTHS_SHORT[parseInt(sM, 10) - 1] || sM
    return `${sD} - ${eD} ${monthName} ${sY}`
  }

  if (sY === eY) {
    const sMonth = MONTHS_SHORT[parseInt(sM, 10) - 1] || sM
    const eMonth = MONTHS_SHORT[parseInt(eM, 10) - 1] || eM
    return `${sD} ${sMonth} - ${eD} ${eMonth} ${sY}`
  }

  return `${formatDateDisplay(start!)} - ${formatDateDisplay(end!)}`
}

export function CustomDateFilter({
  startDate = '',
  endDate = '',
  isActive = false,
  onApply,
  onReset,
  variant = 'light',
  className = '',
}: CustomDateFilterProps) {
  const [mounted, setMounted] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [localStart, setLocalStart] = useState(startDate)
  const [localEnd, setLocalEnd] = useState(endDate)
  const modalTitleId = useId()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      const today = getTodayJakarta()
      setLocalStart(startDate || today)
      setLocalEnd(endDate || today)
    }
  }, [isOpen, startDate, endDate])

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Presets
  const applyPreset = (preset: 'today' | 'yesterday' | 'last7' | 'thisMonth' | 'lastMonth') => {
    const now = new Date()
    const todayStr = getTodayJakarta()

    if (preset === 'today') {
      setLocalStart(todayStr)
      setLocalEnd(todayStr)
    } else if (preset === 'yesterday') {
      const y = new Date(now)
      y.setDate(y.getDate() - 1)
      const yStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(y)
      setLocalStart(yStr)
      setLocalEnd(yStr)
    } else if (preset === 'last7') {
      const past = new Date(now)
      past.setDate(past.getDate() - 6)
      const pastStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(past)
      setLocalStart(pastStr)
      setLocalEnd(todayStr)
    } else if (preset === 'thisMonth') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      const firstStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(firstDay)
      setLocalStart(firstStr)
      setLocalEnd(todayStr)
    } else if (preset === 'lastMonth') {
      const firstPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0)
      const fStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(firstPrevMonth)
      const lStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(lastPrevMonth)
      setLocalStart(fStr)
      setLocalEnd(lStr)
    }
  }

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault()
    if (!localStart || !localEnd) return
    if (localEnd < localStart) return

    onApply({
      startDate: localStart,
      endDate: localEnd,
    })
    setIsOpen(false)
  }

  const handleClear = () => {
    if (onReset) {
      onReset()
    }
    setIsOpen(false)
  }

  const isInvalid = Boolean(localStart && localEnd && localEnd < localStart)
  const isFormValid = Boolean(localStart && localEnd && !isInvalid)

  return (
    <>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
          variant === 'dark'
            ? isActive
              ? 'bg-suka-orange text-white shadow-md ring-1 ring-white/20'
              : 'text-white/70 hover:text-white hover:bg-white/10'
            : isActive
              ? 'bg-suka-brown text-white shadow-xs'
              : 'text-suka-gray-600 hover:text-suka-brown hover:bg-white/50'
        } ${className}`}
        title="Filter Rentang Tanggal Kustom"
      >
        <Calendar size={12} className={isActive ? 'text-white' : variant === 'dark' ? 'text-amber-300' : 'text-suka-orange'} />
        <span>{isActive ? formatRangeLabel(startDate, endDate) : 'Kustom'}</span>
      </button>

      {/* Modal Dialog with Fixed Backdrop rendered via Portal to escape parent overflow/backdrop-filter */}
      {mounted && isOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={modalTitleId}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-suka-brown/10 text-suka-ink space-y-4 animate-in zoom-in-95 duration-150"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-suka-brown/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-suka-orange/10 text-suka-orange flex items-center justify-center">
                  <Calendar size={16} />
                </div>
                <div>
                  <h3 id={modalTitleId} className="text-sm font-black text-suka-brown uppercase tracking-wider font-display">
                    Filter Tanggal Custom
                  </h3>
                  <p className="text-[10px] text-suka-gray-500 font-semibold">
                    Tentukan rentang tanggal manifes distribusi
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-suka-gray-400 hover:text-suka-brown hover:bg-suka-brown/5 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Quick Preset Buttons */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-black text-suka-gray-400 uppercase tracking-widest">
                Preset Cepat
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { key: 'today', label: 'Hari Ini' },
                  { key: 'yesterday', label: 'Kemarin' },
                  { key: 'last7', label: '7 Hari Terakhir' },
                  { key: 'thisMonth', label: 'Bulan Ini' },
                  { key: 'lastMonth', label: 'Bulan Lalu' },
                ].map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => applyPreset(p.key as any)}
                    className="px-2.5 py-1 bg-[#fff8f1] hover:bg-suka-orange/10 hover:text-suka-orange border border-suka-brown/10 rounded-lg text-[10px] font-bold text-suka-brown transition-colors cursor-pointer"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date Inputs Form */}
            <form onSubmit={handleApply} className="space-y-3.5 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-suka-gray-500">
                    Dari Tanggal
                  </label>
                  <input
                    type="date"
                    value={localStart}
                    onChange={(e) => setLocalStart(e.target.value)}
                    className="w-full px-3 py-2 bg-[#fff8f1]/60 border border-suka-brown/15 focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/20 rounded-xl text-xs font-bold text-suka-brown outline-hidden transition-all select-text"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-suka-gray-500">
                    Sampai Tanggal
                  </label>
                  <input
                    type="date"
                    value={localEnd}
                    min={localStart}
                    onChange={(e) => setLocalEnd(e.target.value)}
                    className="w-full px-3 py-2 bg-[#fff8f1]/60 border border-suka-brown/15 focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/20 rounded-xl text-xs font-bold text-suka-brown outline-hidden transition-all select-text"
                  />
                </div>
              </div>

              {isInvalid && (
                <p className="text-[11px] font-bold text-red-600 bg-red-50 p-2 rounded-xl border border-red-200">
                  Tanggal akhir tidak boleh lebih awal dari tanggal mulai.
                </p>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                {isActive && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="px-3 py-2 border border-suka-brown/15 hover:bg-suka-brown/5 text-suka-brown font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                    title="Hapus Filter Tanggal"
                  >
                    <RotateCcw size={13} />
                    <span className="hidden sm:inline">Reset</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-suka-brown/15 hover:bg-suka-brown/5 text-suka-brown font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer text-center"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={!isFormValid}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-suka-orange to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md shadow-suka-orange/20 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Check size={14} />
                  <span>Terapkan</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
