'use client'

import { Plus, Trash2 } from 'lucide-react'
import { DatePicker, Switch, TimeInput } from '@/components/ui/controls'
import { toWibInputValue } from '@/lib/timezone'
import type { PromoDaySchedule } from '@/lib/promoSchedule'

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

/** Jadwal berbeda per tanggal. Mengalahkan jam Happy Hour umum bila diisi. */
export default function PromoDailyScheduleEditor({
  value,
  startDate,
  dailyStartTime,
  dailyEndTime,
  onChange,
}: {
  value?: PromoDaySchedule[] | null
  startDate?: string | null
  dailyStartTime?: string | null
  dailyEndTime?: string | null
  onChange: (value: PromoDaySchedule[]) => void
}) {
  const rows = Array.isArray(value) ? value : []
  const enabled = rows.length > 0
  const today = todayWib()

  const addRow = () => {
    const lastDate = rows[rows.length - 1]?.date
    const fallbackDate = startDate ? toWibInputValue(startDate).slice(0, 10) : today
    let date = lastDate ? nextDate(lastDate) : fallbackDate
    const usedDates = new Set(rows.map(row => row.date))
    while (usedDates.has(date)) date = nextDate(date)
    onChange([
      ...rows,
      { date, start_time: timeValue(dailyStartTime, '17:00'), end_time: timeValue(dailyEndTime, '20:00') },
    ])
  }

  const updateRow = (index: number, patch: Partial<PromoDaySchedule>) => {
    onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800">Jam berbeda per tanggal</p>
          <p className="mt-0.5 text-xs text-slate-500">Hanya tanggal yang dicantumkan yang aktif. Mengalahkan jam harian di atas.</p>
        </div>
        <Switch size="sm" checked={enabled} onChange={on => (on ? addRow() : onChange([]))} label="Jam berbeda per tanggal" />
      </div>

      {enabled && (
        <div className="space-y-2">
          {rows.map((row, index) => (
            <div key={`${index}-${row.date}`} className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <DatePicker value={row.date} today={today} label={`Tanggal jadwal ${index + 1}`} onChange={date => updateRow(index, { date })} />
                </div>
                <button
                  type="button"
                  aria-label={`Hapus jadwal ${row.date || index + 1}`}
                  title="Hapus tanggal"
                  onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
                  className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Mulai</p>
                  <TimeInput
                    value={timeValue(row.start_time, '17:00')}
                    label={`Jam mulai ${row.date}`}
                    onChange={t => updateRow(index, { start_time: `${t}:00` })}
                  />
                </div>
                <span className="pb-2.5 text-sm font-bold text-slate-400" aria-hidden>–</span>
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Selesai</p>
                  <TimeInput
                    value={timeValue(row.end_time, '20:00')}
                    label={`Jam selesai ${row.date}`}
                    onChange={t => updateRow(index, { end_time: `${t}:00` })}
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addRow}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:border-suka-orange hover:text-suka-brown"
          >
            <Plus className="h-3.5 w-3.5" /> Tambah tanggal
          </button>
          <p className="text-[11px] font-medium text-slate-500">Jam selesai tidak boleh sama dengan jam mulai. Lintas tengah malam (22:00–02:00) didukung.</p>
        </div>
      )}
    </div>
  )
}
