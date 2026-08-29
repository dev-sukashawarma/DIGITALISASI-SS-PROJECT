'use client'

import { useState } from 'react'
import type { ShiftRosterItem, ShiftType } from '@/lib/types'
import { ShiftAssignModal } from './ShiftAssignModal'

const SHIFT_BADGES: Record<ShiftType, { bg: string; text: string; border: string }> = {
  Pagi: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  Siang: { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200' },
  Sore: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
  Malam: { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
  Middle: { bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200' },
  Full: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
  Off: { bg: 'bg-stone-100', text: 'text-stone-500', border: 'border-stone-200' },
}

export function ShiftRosterGrid({
  items,
  dates,
  onAssignShift,
}: {
  items: ShiftRosterItem[]
  dates: string[]
  onAssignShift: (staff_id: string, date: string, shift: ShiftType) => void
}) {
  const [selectedItem, setSelectedItem] = useState<ShiftRosterItem | null>(null)

  // Group items by staff_id
  const staffMap = new Map<string, { name: string; role: string; shifts: Map<string, ShiftRosterItem> }>()

  items.forEach((it) => {
    if (!staffMap.has(it.staff_id)) {
      staffMap.set(it.staff_id, {
        name: it.outlet_staff?.name || 'Staff',
        role: it.outlet_staff?.role || 'crew',
        shifts: new Map(),
      })
    }
    staffMap.get(it.staff_id)!.shifts.set(it.date, it)
  })

  const staffList = Array.from(staffMap.entries())

  const formatHeaderDate = (dStr: string) => {
    const d = new Date(dStr)
    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
    return {
      day: dayNames[d.getDay()],
      date: `${d.getDate()}/${d.getMonth() + 1}`,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
    }
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-suka-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-center text-xs">
            <thead>
              <tr className="border-b border-suka-gray-200 bg-[#FDF9F3]">
                <th className="px-4 py-3 text-left font-bold text-suka-brown uppercase tracking-wider min-w-[180px]">
                  Karyawan
                </th>
                {dates.map((d) => {
                  const info = formatHeaderDate(d)
                  return (
                    <th
                      key={d}
                      className={`px-2 py-2.5 font-bold border-l border-suka-gray-100 min-w-[90px] ${
                        info.isWeekend ? 'bg-amber-100/50 text-suka-brown' : 'text-stone-700'
                      }`}
                    >
                      <div className="font-extrabold text-[11px]">{info.day}</div>
                      <div className="text-[10px] text-gray-500 font-mono">{info.date}</div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-suka-gray-100">
              {staffList.map(([staffId, s]) => (
                <tr key={staffId} className="hover:bg-amber-50/20 transition-colors">
                  <td className="px-4 py-3 text-left">
                    <div className="font-bold text-suka-ink text-sm">{s.name}</div>
                    <div className="text-[10px] text-suka-brown uppercase font-semibold">
                      {s.role.replace('_', ' ')}
                    </div>
                  </td>
                  {dates.map((d) => {
                    const shiftItem = s.shifts.get(d)
                    const shiftType = shiftItem?.shift || 'Pagi'
                    const badge = SHIFT_BADGES[shiftType] || SHIFT_BADGES.Pagi

                    return (
                      <td key={d} className="px-1.5 py-2 border-l border-suka-gray-100">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedItem(
                              shiftItem || {
                                id: `${staffId}_${d}`,
                                staff_id: staffId,
                                outlet_id: '',
                                date: d,
                                shift: shiftType,
                                outlet_staff: { name: s.name, role: s.role },
                              }
                            )
                          }
                          className={`w-full py-1.5 px-2 rounded-xl border text-[11px] font-bold transition-all cursor-pointer hover:shadow-2xs ${badge.bg} ${badge.text} ${badge.border} hover:scale-[1.03]`}
                        >
                          {shiftType}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}

              {staffList.length === 0 && (
                <tr>
                  <td colSpan={dates.length + 1} className="px-4 py-12 text-center text-suka-gray-500 font-medium">
                    Pilih outlet untuk memuat jadwal roster staf.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ShiftAssignModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onAssign={(shift) => {
          if (selectedItem) {
            onAssignShift(selectedItem.staff_id, selectedItem.date, shift)
            setSelectedItem(null)
          }
        }}
      />
    </>
  )
}
