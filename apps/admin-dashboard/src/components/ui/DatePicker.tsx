'use client'

import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  addDays,
  calendarGrid,
  formatTanggalPendek,
  parseIsoDate,
  toIsoDate,
  todayWib,
} from '@/lib/dateIso'

const HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

export interface DatePickerProps {
  /** Nilai 'yyyy-MM-dd'. */
  value: string
  onChange: (val: string) => void
  /** Teks kecil di depan tanggal, mis. "Dari". */
  label?: string
  placeholder?: string
  /** Batas bawah/atas yang boleh dipilih ('yyyy-MM-dd'). */
  min?: string
  max?: string
  /** Rentang yang diberi arsiran lembut di kalender (untuk pasangan Dari–Sampai). */
  rangeFrom?: string
  rangeTo?: string
  className?: string
  align?: 'left' | 'right'
  'aria-label'?: string
}

export function DatePicker({
  value,
  onChange,
  label,
  placeholder = 'Pilih tanggal',
  min,
  max,
  rangeFrom,
  rangeTo,
  className = '',
  align = 'left',
  'aria-label': ariaLabel,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [openUpwards, setOpenUpwards] = useState(false)
  const selected = parseIsoDate(value)
  const [view, setView] = useState(() => {
    const base = selected ?? parseIsoDate(todayWib())!
    return { year: base.getFullYear(), month: base.getMonth() }
  })
  const [focused, setFocused] = useState<string>(value || todayWib())

  const wrapperRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const dialogId = useId()

  const today = todayWib()
  const cells = useMemo(() => calendarGrid(view.year, view.month), [view])
  const monthLabel = new Date(view.year, view.month, 1).toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  })

  const isDisabled = (iso: string) => (min ? iso < min : false) || (max ? iso > max : false)

  // Saat dibuka: lompat ke bulan tanggal terpilih & tentukan arah popover.
  const open = () => {
    const base = parseIsoDate(value) ?? parseIsoDate(todayWib())!
    setView({ year: base.getFullYear(), month: base.getMonth() })
    setFocused(value || todayWib())
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      setOpenUpwards(spaceBelow < 380 && rect.top > spaceBelow)
    }
    setIsOpen(true)
  }

  // Pindahkan fokus keyboard ke sel yang aktif.
  useEffect(() => {
    if (!isOpen) return
    const btn = gridRef.current?.querySelector<HTMLButtonElement>(`[data-iso="${focused}"]`)
    btn?.focus()
  }, [isOpen, focused, view])

  // Tutup saat klik di luar.
  useEffect(() => {
    if (!isOpen) return undefined
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [isOpen])

  const close = () => {
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  const pick = (iso: string) => {
    if (isDisabled(iso)) return
    onChange(iso)
    close()
  }

  const moveFocus = (next: Date) => {
    const iso = toIsoDate(next)
    setFocused(iso)
    if (next.getMonth() !== view.month || next.getFullYear() !== view.year) {
      setView({ year: next.getFullYear(), month: next.getMonth() })
    }
  }

  const shiftMonth = (delta: number) => {
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
    const cur = parseIsoDate(focused)
    if (cur) {
      const target = new Date(cur.getFullYear(), cur.getMonth() + delta, 1)
      const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
      setFocused(toIsoDate(new Date(target.getFullYear(), target.getMonth(), Math.min(cur.getDate(), lastDay))))
    }
  }

  const onGridKeyDown = (e: React.KeyboardEvent) => {
    const cur = parseIsoDate((e.target as HTMLElement).dataset.iso ?? focused)
    if (!cur) return
    const map: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    if (e.key in map) {
      e.preventDefault()
      moveFocus(addDays(cur, map[e.key]))
    } else if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault()
      shiftMonth(e.key === 'PageUp' ? -1 : 1)
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      const offset = (cur.getDay() + 6) % 7
      moveFocus(addDays(cur, e.key === 'Home' ? -offset : 6 - offset))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      pick(toIsoDate(cur))
    }
  }

  const rFrom = rangeFrom && rangeTo && rangeFrom <= rangeTo ? rangeFrom : undefined
  const rTo = rFrom ? rangeTo : undefined

  return (
    <div
      ref={wrapperRef}
      className={`relative inline-block text-left ${className}`}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && isOpen) {
          e.preventDefault()
          close()
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? dialogId : undefined}
        aria-label={ariaLabel ?? `${label ?? 'Tanggal'}: ${value ? formatTanggalPendek(value) : placeholder}`}
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        className={`w-full flex items-center gap-2 bg-white border rounded-xl py-2 px-3 text-xs sm:text-sm font-medium shadow-2xs cursor-pointer outline-none transition-colors duration-150 ${
          isOpen
            ? 'border-suka-orange ring-2 ring-suka-orange/20'
            : 'border-suka-gray-200 hover:border-suka-orange/60 focus-visible:border-suka-orange focus-visible:ring-2 focus-visible:ring-suka-orange/20'
        }`}
      >
        <CalendarDays size={15} className={isOpen ? 'text-suka-orange' : 'text-suka-gray-500'} aria-hidden />
        {label && <span className="text-suka-gray-500 font-bold text-xs">{label}</span>}
        <span className={`flex-1 text-left tabular-nums ${value ? 'text-suka-ink font-semibold' : 'text-suka-gray-400'}`}>
          {value ? formatTanggalPendek(value) : placeholder}
        </span>
        <ChevronDown
          size={15}
          aria-hidden
          className={`shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-suka-orange' : 'text-suka-gray-400'}`}
        />
      </button>

      {isOpen && (
        <div
          id={dialogId}
          role="dialog"
          aria-label={`Pilih ${label?.toLowerCase() ?? 'tanggal'}`}
          className={`absolute z-[100] w-[288px] bg-white border border-suka-gray-200 rounded-2xl shadow-[0_12px_36px_rgba(44,24,16,0.12)] p-3 animate-in fade-in-50 zoom-in-95 duration-100 ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${openUpwards ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}`}
        >
          {/* Navigasi bulan */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="Bulan sebelumnya"
              className="w-9 h-9 flex items-center justify-center rounded-xl text-suka-gray-600 hover:bg-suka-cream hover:text-suka-brown cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-suka-orange/40"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-bold text-suka-ink capitalize" aria-live="polite">
              {monthLabel}
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="Bulan berikutnya"
              className="w-9 h-9 flex items-center justify-center rounded-xl text-suka-gray-600 hover:bg-suka-cream hover:text-suka-brown cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-suka-orange/40"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Nama hari */}
          <div className="grid grid-cols-7 mb-1" aria-hidden>
            {HARI.map((h, i) => (
              <span
                key={h}
                className={`text-center text-[11px] font-bold uppercase tracking-wide py-1 ${i === 6 ? 'text-red-600' : 'text-suka-gray-500'}`}
              >
                {h}
              </span>
            ))}
          </div>

          {/* Grid tanggal */}
          <div ref={gridRef} role="grid" onKeyDown={onGridKeyDown} className="grid grid-cols-7 gap-y-0.5">
            {cells.map((d) => {
              const iso = toIsoDate(d)
              const inMonth = d.getMonth() === view.month
              const isSelected = iso === value
              const isToday = iso === today
              const disabled = isDisabled(iso)
              const inRange = rFrom && rTo ? iso >= rFrom && iso <= rTo : false
              const isRangeEdge = iso === rFrom || iso === rTo
              const isSunday = d.getDay() === 0

              return (
                <div
                  key={iso}
                  className={`flex justify-center ${
                    inRange && !isRangeEdge ? 'bg-suka-orange/10' : ''
                  } ${iso === rFrom && rFrom !== rTo ? 'bg-gradient-to-r from-transparent from-50% to-suka-orange/10 to-50%' : ''} ${
                    iso === rTo && rFrom !== rTo ? 'bg-gradient-to-l from-transparent from-50% to-suka-orange/10 to-50%' : ''
                  }`}
                >
                  <button
                    type="button"
                    data-iso={iso}
                    tabIndex={iso === focused ? 0 : -1}
                    disabled={disabled}
                    aria-selected={isSelected}
                    aria-current={isToday ? 'date' : undefined}
                    aria-label={d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    onClick={() => pick(iso)}
                    className={`relative w-9 h-9 rounded-xl text-xs tabular-nums transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-suka-orange focus-visible:ring-offset-1 ${
                      disabled
                        ? 'text-suka-gray-300 cursor-not-allowed'
                        : isSelected
                        ? 'bg-suka-orange text-white font-bold shadow-sm cursor-pointer'
                        : isRangeEdge
                        ? 'bg-suka-orange/25 text-suka-brown font-bold cursor-pointer hover:bg-suka-orange/35'
                        : `cursor-pointer hover:bg-suka-cream ${
                            inMonth
                              ? isSunday
                                ? 'text-red-600 font-semibold'
                                : 'text-suka-ink font-semibold'
                              : 'text-suka-gray-400 font-medium'
                          }`
                    } ${isToday && !isSelected ? 'ring-1 ring-inset ring-suka-orange' : ''}`}
                  >
                    {d.getDate()}
                  </button>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-suka-gray-100">
            <button
              type="button"
              onClick={() => pick(today)}
              disabled={isDisabled(today)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-suka-brown hover:bg-suka-cream cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed outline-none focus-visible:ring-2 focus-visible:ring-suka-orange/40"
            >
              Hari ini
            </button>
            <button
              type="button"
              onClick={close}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-suka-gray-600 hover:bg-suka-gray-100 cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-suka-orange/40"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
