'use client'

// Kontrol form custom pengganti kontrol bawaan browser (<select>, checkbox,
// input date/time). Semua bisa dipakai keyboard dan punya aria yang sesuai.

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronLeft, ChevronRight, CalendarDays, Clock3, Minus, Plus, X } from 'lucide-react'

/* ───────────────────────── Switch ───────────────────────── */

export function Switch({
  checked,
  onChange,
  label,
  disabled,
  size = 'md',
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  disabled?: boolean
  size?: 'sm' | 'md'
}) {
  const track = size === 'sm' ? 'h-5 w-9' : 'h-7 w-12'
  const knob = size === 'sm' ? 'h-4 w-4' : 'h-6 w-6'
  const shift = size === 'sm' ? 'translate-x-[18px]' : 'translate-x-[22px]'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={e => {
        e.stopPropagation()
        onChange(!checked)
      }}
      className={`relative inline-flex ${track} shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-suka-orange/40 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-suka-orange' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block ${knob} rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? shift : 'translate-x-0.5'}`}
      />
    </button>
  )
}

/* ───────────────────────── Segmented ───────────────────────── */

export type SegmentOption<T extends string> = { value: T; label: string; icon?: ReactNode; hint?: string }

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  stretch = true,
}: {
  value: T
  options: SegmentOption<T>[]
  onChange: (v: T) => void
  label: string
  stretch?: boolean
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`${stretch ? 'flex w-full' : 'inline-flex'} gap-1 rounded-xl bg-slate-100 p-1`}>
      {options.map(opt => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={opt.hint}
            onClick={() => onChange(opt.value)}
            className={`${stretch ? 'flex-1' : ''} inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-suka-orange/40 sm:text-sm ${
              active ? 'bg-white text-suka-brown shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {opt.icon}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

/* ───────────────────────── Checkbox row ───────────────────────── */

export function CheckMark({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors duration-150 ${
        checked ? 'border-suka-orange bg-suka-orange text-white' : 'border-slate-300 bg-white text-transparent'
      }`}
    >
      <Check className="h-3.5 w-3.5" strokeWidth={3} />
    </span>
  )
}

/* ───────────────────────── Stepper ───────────────────────── */

export function Stepper({
  value,
  onChange,
  min = 1,
  max = 99,
  label,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  label: string
}) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)))
  const commit = (raw: string) => {
    const n = Number(raw.replace(/\D/g, ''))
    if (raw.trim() && Number.isFinite(n)) onChange(clamp(n))
    else setDraft(String(value))
  }
  return (
    <div className="inline-flex items-stretch overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-suka-orange focus-within:ring-2 focus-within:ring-suka-orange/15">
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= min}
        aria-label={`Kurangi ${label}`}
        className="flex w-10 cursor-pointer items-center justify-center text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Minus className="h-4 w-4" />
      </button>
      <input
        aria-label={label}
        value={draft}
        inputMode="numeric"
        onChange={e => setDraft(e.target.value)}
        onBlur={e => commit(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') commit((e.target as HTMLInputElement).value)
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            onChange(clamp(value + 1))
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            onChange(clamp(value - 1))
          }
        }}
        className="w-12 border-x border-slate-100 bg-transparent py-2 text-center text-base font-extrabold text-slate-900 focus:outline-none"
      />
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        aria-label={`Tambah ${label}`}
        className="flex w-10 cursor-pointer items-center justify-center text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}

/* ───────────────────────── Jam ───────────────────────── */

const pad = (n: number) => String(n).padStart(2, '0')
const isJam = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v)
const toMin = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5))
const fromMin = (m: number) => {
  const x = ((m % 1440) + 1440) % 1440
  return `${pad(Math.floor(x / 60))}:${pad(x % 60)}`
}

/** Input jam custom: ketik bebas (1730 → 17:30), tombol ±15 menit, panah atas/bawah ±1 menit. */
export function TimeInput({
  value,
  onChange,
  label,
  placeholder = '--:--',
}: {
  value: string
  onChange: (v: string) => void
  label: string
  placeholder?: string
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const commit = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 4)
    let next = ''
    if (digits.length === 4) next = `${digits.slice(0, 2)}:${digits.slice(2)}`
    else if (digits.length === 3) next = `0${digits[0]}:${digits.slice(1)}`
    else if (digits.length > 0) next = `${pad(Number(digits))}:00`
    if (next && isJam(next)) onChange(next)
    else setDraft(value)
  }
  const shift = (d: number) => onChange(fromMin((isJam(value) ? toMin(value) : 17 * 60) + d))
  return (
    <div className="flex items-stretch overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-suka-orange focus-within:ring-2 focus-within:ring-suka-orange/15">
      <button type="button" onClick={() => shift(-15)} aria-label={`${label}: mundur 15 menit`} className="cursor-pointer px-2.5 text-slate-500 hover:bg-slate-50 hover:text-slate-800">
        <Minus className="h-3.5 w-3.5" />
      </button>
      <div className="flex flex-1 items-center justify-center gap-1.5 border-x border-slate-100">
        <Clock3 className="h-3.5 w-3.5 text-slate-400" />
        <input
          aria-label={label}
          value={draft}
          inputMode="numeric"
          placeholder={placeholder}
          maxLength={5}
          onChange={e => setDraft(e.target.value)}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') commit((e.target as HTMLInputElement).value)
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              shift(1)
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              shift(-1)
            }
          }}
          className="w-14 bg-transparent py-2 text-center font-mono text-base font-extrabold tracking-wider text-slate-900 focus:outline-none"
        />
      </div>
      <button type="button" onClick={() => shift(15)} aria-label={`${label}: maju 15 menit`} className="cursor-pointer px-2.5 text-slate-500 hover:bg-slate-50 hover:text-slate-800">
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

/* ───────────────────────── Tanggal ───────────────────────── */

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

/** "2026-10-03" → "Sab, 3 Okt 2026" (tanggal kalender, tanpa zona waktu). */
export function formatTanggal(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ymd
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${HARI[(dow + 6) % 7]}, ${d} ${BULAN_PENDEK[m - 1]} ${y}`
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOutside: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside()
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onOutside()
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', esc)
    }
  }, [ref, onOutside, active])
}

/** Pemilih tanggal custom (kalender popover). Nilai "YYYY-MM-DD" atau "". */
export function DatePicker({
  value,
  onChange,
  label,
  placeholder = 'Pilih tanggal',
  today,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  placeholder?: string
  /** "YYYY-MM-DD" hari ini (WIB) — disorot di kalender. */
  today?: string
}) {
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const base = value || today || new Date().toISOString().slice(0, 10)
  const [view, setView] = useState({ y: Number(base.slice(0, 4)), m: Number(base.slice(5, 7)) - 1 })
  useClickOutside(rootRef, () => setOpen(false), open)

  useEffect(() => {
    if (!open) return
    const b = value || today || new Date().toISOString().slice(0, 10)
    setView({ y: Number(b.slice(0, 4)), m: Number(b.slice(5, 7)) - 1 })
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const first = new Date(Date.UTC(view.y, view.m, 1))
  const lead = (first.getUTCDay() + 6) % 7
  const days = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate()
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  const ymd = (d: number) => `${view.y}-${pad(view.m + 1)}-${pad(d)}`
  const move = (delta: number) => {
    const n = view.m + delta
    setView({ y: view.y + Math.floor(n / 12), m: ((n % 12) + 12) % 12 })
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="flex w-full cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-semibold transition-colors hover:border-suka-orange/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-suka-orange/30"
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
        <span className={`truncate whitespace-nowrap ${value ? 'text-slate-900' : 'text-slate-400'}`}>{value ? formatTanggal(value) : placeholder}</span>
      </button>
      {open && (
        <div role="dialog" aria-label={label} className="absolute left-0 z-50 mt-1.5 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_16px_40px_-12px_rgba(64,10,7,0.25)]">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => move(-1)} aria-label="Bulan sebelumnya" className="cursor-pointer rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-bold text-slate-800">{BULAN[view.m]} {view.y}</p>
            <button type="button" onClick={() => move(1)} aria-label="Bulan berikutnya" className="cursor-pointer rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {HARI.map(h => (
              <span key={h} className="py-1 text-[10px] font-bold uppercase text-slate-400">{h}</span>
            ))}
            {cells.map((d, i) =>
              d == null ? (
                <span key={`e${i}`} />
              ) : (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    onChange(ymd(d))
                    setOpen(false)
                  }}
                  className={`h-9 cursor-pointer rounded-lg text-sm font-semibold transition-colors ${
                    ymd(d) === value
                      ? 'bg-suka-orange text-white'
                      : ymd(d) === today
                        ? 'bg-suka-orange/10 text-suka-brown hover:bg-suka-orange/20'
                        : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {d}
                </button>
              ),
            )}
          </div>
          {today && (
            <button
              type="button"
              onClick={() => {
                onChange(today)
                setOpen(false)
              }}
              className="mt-2 w-full cursor-pointer rounded-lg bg-slate-50 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              Hari ini
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Tanggal + jam dalam satu isian. Nilai = "YYYY-MM-DDTHH:mm" (WIB) atau "".
 * Tombol × mengosongkan (artinya "langsung" / "tanpa batas", tergantung pemakai).
 */
export function DateTimeField({
  value,
  onChange,
  label,
  emptyLabel,
  defaultTime,
  today,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  emptyLabel: string
  defaultTime: string
  today?: string
}) {
  const date = value ? value.slice(0, 10) : ''
  const time = value ? value.slice(11, 16) : ''
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-600">{label}</span>
        {value && (
          <button type="button" onClick={() => onChange('')} className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-rose-600">
            <X className="h-3 w-3" /> Kosongkan
          </button>
        )}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(9.5rem,auto)] gap-2">
        <DatePicker
          value={date}
          label={`${label}: tanggal`}
          placeholder={emptyLabel}
          today={today}
          onChange={d => onChange(`${d}T${time || defaultTime}`)}
        />
        {date ? (
          <TimeInput value={time} label={`${label}: jam`} onChange={t => onChange(`${date}T${t}`)} />
        ) : (
          <span className="flex items-center rounded-xl border border-dashed border-slate-200 px-3 text-xs font-semibold text-slate-400">--:--</span>
        )}
      </div>
    </div>
  )
}
