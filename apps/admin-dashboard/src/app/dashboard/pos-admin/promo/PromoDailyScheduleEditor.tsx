'use client'

import { CalendarDays, Check, Plus, Trash2 } from 'lucide-react'
import { toWibInputValue } from '@/lib/timezone'
import type { PromoDaySchedule } from '@/lib/promoSchedule'

type Accent = 'amber' | 'blue'

const STYLE = {
  amber: {
    box: 'border-amber-200/70 bg-white',
    icon: 'text-amber-600',
    border: 'border-amber-200 focus:border-amber-400',
    button: 'border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-400 hover:bg-amber-100',
  },
  blue: {
    box: 'border-blue-200/70 bg-white',
    icon: 'text-blue-500',
    border: 'border-blue-200 focus:border-blue-400',
    button: 'border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-400 hover:bg-blue-100',
  },
} as const

function todayWib(): string {
  return toWibInputValue(new Date().toISOString()).slice(0, 10)
}

function nextDate(value: string): string {
  const parsed = Date.parse(`${value}T00:00:00Z`)
  return isNaN(parsed) ? todayWib() : new Date(parsed + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function timeValue(value: string | null | undefined, fallback: string): string {
  return value?.slice(0, 5) || fallback
}

export default function PromoDailyScheduleEditor({
  value,
  startDate,
  dailyStartTime,
  dailyEndTime,
  onChange,
  accent,
}: {
  value?: PromoDaySchedule[] | null
  startDate?: string | null
  dailyStartTime?: string | null
  dailyEndTime?: string | null
  onChange: (value: PromoDaySchedule[]) => void
  accent: Accent
}) {
  const style = STYLE[accent]
  const rows = Array.isArray(value) ? value : []
  const enabled = rows.length > 0

  const addRow = () => {
    const lastDate = rows[rows.length - 1]?.date
    const fallbackDate = startDate ? toWibInputValue(startDate).slice(0, 10) : todayWib()
    let date = lastDate ? nextDate(lastDate) : fallbackDate
    const usedDates = new Set(rows.map(row => row.date))
    while (usedDates.has(date)) date = nextDate(date)
    onChange([
      ...rows,
      {
        date,
        start_time: timeValue(dailyStartTime, '17:00'),
        end_time: timeValue(dailyEndTime, '20:00'),
      },
    ])
  }

  const updateRow = (index: number, patch: Partial<PromoDaySchedule>) => {
    onChange(rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row))
  }

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${style.box}`}>
      <label className="flex items-start gap-3 cursor-pointer group">
        <div className="relative flex items-center pt-0.5">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={enabled}
            onChange={event => event.target.checked ? addRow() : onChange([])}
          />
          <div className={`w-5 h-5 rounded-md border-2 bg-white transition-all flex items-center justify-center ${style.border.split(' ')[0]} ${style.icon} peer-checked:bg-current peer-checked:border-current`}>
            <Check className="w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 scale-50 peer-checked:scale-100 transition-all" strokeWidth={3} />
          </div>
        </div>
        <div className="flex-1">
          <span className="flex items-center gap-2 text-sm font-bold text-gray-800 group-hover:text-gray-700 transition-colors">
            <CalendarDays className={`w-4 h-4 ${style.icon}`} />
            Atur jam berbeda per tanggal
          </span>
          <span className="block text-xs text-gray-500 mt-0.5">
            Cocok untuk promo beberapa hari dengan jam yang berbeda. Hanya tanggal yang dicantumkan yang akan aktif; aturan ini mengalahkan jam Happy Hour umum.
          </span>
        </div>
      </label>

      {enabled && (
        <div className="pl-8 space-y-2">
          {rows.map((row, index) => (
            <div key={`${index}-${row.date}`} className="grid grid-cols-1 sm:grid-cols-[minmax(8rem,1.2fr)_minmax(6rem,1fr)_minmax(6rem,1fr)_auto] items-end gap-2">
              <label className="space-y-1">
                <span className="block text-[11px] font-bold text-gray-600">Tanggal (WIB)</span>
                <input
                  type="date"
                  value={row.date}
                  onChange={event => updateRow(index, { date: event.target.value })}
                  className={`w-full rounded-lg border-2 bg-white px-2 py-2 text-sm font-semibold text-gray-900 outline-none ${style.border}`}
                />
              </label>
              <label className="space-y-1">
                <span className="block text-[11px] font-bold text-gray-600">Mulai</span>
                <input
                  type="time"
                  value={timeValue(row.start_time, '17:00')}
                  onChange={event => updateRow(index, { start_time: event.target.value ? `${event.target.value}:00` : '' })}
                  className={`w-full rounded-lg border-2 bg-white px-2 py-2 text-sm font-semibold text-gray-900 outline-none ${style.border}`}
                />
              </label>
              <label className="space-y-1">
                <span className="block text-[11px] font-bold text-gray-600">Selesai</span>
                <input
                  type="time"
                  value={timeValue(row.end_time, '20:00')}
                  onChange={event => updateRow(index, { end_time: event.target.value ? `${event.target.value}:00` : '' })}
                  className={`w-full rounded-lg border-2 bg-white px-2 py-2 text-sm font-semibold text-gray-900 outline-none ${style.border}`}
                />
              </label>
              <button
                type="button"
                aria-label={`Hapus jadwal ${row.date || index + 1}`}
                title="Hapus tanggal"
                onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
                className="mb-0.5 rounded-lg border border-gray-200 p-2 text-gray-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={addRow}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${style.button}`}
          >
            <Plus className="h-3.5 w-3.5" />
            Tambah tanggal
          </button>
          <p className="text-[11px] font-medium text-gray-500">
            Jam selesai tidak boleh sama dengan jam mulai. Format lintas tengah malam seperti 22:00–02:00 juga didukung.
          </p>
        </div>
      )}
    </div>
  )
}
