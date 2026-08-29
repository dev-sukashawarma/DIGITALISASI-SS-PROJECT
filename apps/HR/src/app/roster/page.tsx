'use client'

import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Building2 } from 'lucide-react'
import { Spinner } from '@suka/design-system'
import { PageHeader } from '@/components/ui/PageHeader'
import { useRoster } from '@/hooks/useRoster'
import { useOutlets } from '@/hooks/useOutlets'
import { ShiftRosterGrid } from '@/components/modules/ShiftRosterGrid'
import type { ShiftType } from '@/lib/types'

function getWeekDates(offsetWeeks = 0): { start: string; end: string; dates: string[] } {
  const now = new Date()
  const currentDay = now.getDay() // 0 = Sunday, 1 = Monday...
  const distanceToMonday = (currentDay + 6) % 7

  const monday = new Date(now)
  monday.setDate(now.getDate() - distanceToMonday + offsetWeeks * 7)

  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    dates.push(d.toISOString().split('T')[0])
  }

  return {
    start: dates[0],
    end: dates[6],
    dates,
  }
}

export default function RosterPage() {
  const [weekOffset, setWeekOffset] = useState(0)
  const { data: outlets = [] } = useOutlets()
  const [selectedOutletId, setSelectedOutletId] = useState<string>('')

  // Set default outlet when loaded
  const activeOutletId = selectedOutletId || (outlets[0]?.id ?? '')

  const { start, end, dates } = useMemo(() => getWeekDates(weekOffset), [weekOffset])
  const { data: rosterItems = [], isLoading, setShift } = useRoster(activeOutletId, start, end)

  const handleAssignShift = (staff_id: string, date: string, shift: ShiftType) => {
    setShift.mutate(
      { staff_id, date, shift },
      {
        onSuccess: () => toast.success(`Shift ${shift} berhasil ditetapkan`),
        onError: (err: any) => toast.error(err.message || 'Gagal menyimpan shift'),
      }
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shift Roster &amp; Jadwal Kerja"
        description="Rancang dan pantau alokasi rotasi shift staf outlet per minggu (Pagi, Siang, Sore, Malam, Full Day, Off)."
      />

      {/* Roster Controls Bar */}
      <div className="bg-white p-4 rounded-2xl border border-suka-gray-200 shadow-sm flex flex-wrap justify-between items-center gap-3">
        {/* Outlet Picker */}
        <div className="flex items-center gap-2">
          <Building2 size={16} className="text-suka-orange" />
          <select
            value={activeOutletId}
            onChange={(e) => setSelectedOutletId(e.target.value)}
            className="rounded-xl border border-suka-gray-200 px-3 py-2 text-xs sm:text-sm font-bold outline-none focus:border-suka-orange bg-white text-suka-ink shadow-xs"
          >
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>

        {/* Week Navigator */}
        <div className="flex items-center gap-2 bg-[#FDF9F3] p-1.5 rounded-xl border border-suka-brown/10">
          <button
            onClick={() => setWeekOffset((v) => v - 1)}
            className="p-1.5 rounded-lg hover:bg-amber-100 text-suka-brown transition-colors cursor-pointer"
            title="Minggu Sebelumnya"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-black text-suka-brown px-2 font-mono">
            {start} &mdash; {end}
          </span>
          <button
            onClick={() => setWeekOffset((v) => v + 1)}
            className="p-1.5 rounded-lg hover:bg-amber-100 text-suka-brown transition-colors cursor-pointer"
            title="Minggu Berikutnya"
          >
            <ChevronRight size={16} />
          </button>
          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              className="text-[10px] font-bold text-suka-orange hover:underline ml-1"
            >
              Minggu Ini
            </button>
          )}
        </div>
      </div>

      {/* Shift Legend */}
      <div className="flex flex-wrap gap-2 text-xs font-semibold">
        <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
          Pagi (07:00 - 15:00)
        </span>
        <span className="px-2.5 py-1 rounded-lg bg-orange-50 text-orange-800 border border-orange-200">
          Siang (11:00 - 19:00)
        </span>
        <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
          Sore (14:00 - 22:00)
        </span>
        <span className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-800 border border-purple-200">
          Malam (16:00 - 00:00)
        </span>
        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
          Full (08:00 - 22:00)
        </span>
        <span className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-600 border border-stone-200">
          Off (Libur)
        </span>
      </div>

      {/* Roster Grid */}
      {isLoading ? (
        <div className="flex justify-center p-12">
          <Spinner />
        </div>
      ) : (
        <ShiftRosterGrid items={rosterItems} dates={dates} onAssignShift={handleAssignShift} />
      )}
    </div>
  )
}
