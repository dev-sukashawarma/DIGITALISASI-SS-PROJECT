'use client'

import { useState } from 'react'
import { Button } from '@suka/design-system'
import type { ShiftRosterItem, ShiftType } from '@/lib/types'

interface ShiftAssignModalProps {
  item: ShiftRosterItem | null
  onClose: () => void
  onAssign: (shift: ShiftType) => void
}

export function ShiftAssignModal({ item, onClose, onAssign }: ShiftAssignModalProps) {
  const [selectedShift, setSelectedShift] = useState<ShiftType>(item?.shift || 'Pagi')

  if (!item) return null

  const shifts: { type: ShiftType; label: string; desc: string; color: string }[] = [
    { type: 'Pagi', label: 'Shift Pagi', desc: '07:00 - 15:00 WIB', color: 'border-amber-300 bg-amber-50 text-amber-900' },
    { type: 'Siang', label: 'Shift Siang', desc: '11:00 - 19:00 WIB', color: 'border-orange-300 bg-orange-50 text-orange-900' },
    { type: 'Sore', label: 'Shift Sore', desc: '14:00 - 22:00 WIB', color: 'border-blue-300 bg-blue-50 text-blue-900' },
    { type: 'Malam', label: 'Shift Malam', desc: '16:00 - 00:00 WIB', color: 'border-purple-300 bg-purple-50 text-purple-900' },
    { type: 'Full', label: 'Shift Full Day', desc: '08:00 - 22:00 WIB', color: 'border-emerald-300 bg-emerald-50 text-emerald-900' },
    { type: 'Off', label: 'Libur / Day Off', desc: 'Jadwal Istirahat Mingguan', color: 'border-stone-300 bg-stone-100 text-stone-700' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-sm rounded-2xl border border-suka-gray-200 bg-white p-6 shadow-xl space-y-4 animate-in zoom-in-95">
        <h3 className="text-base font-extrabold text-suka-brown">Atur Shift Kerja Staf</h3>
        <p className="text-xs text-suka-gray-500 font-medium">
          {item.outlet_staff?.name} &bull; Tanggal: <strong>{item.date}</strong>
        </p>

        <div className="grid grid-cols-1 gap-2 pt-2">
          {shifts.map((s) => (
            <label
              key={s.type}
              onClick={() => setSelectedShift(s.type)}
              className={`p-3 rounded-xl border-2 flex justify-between items-center cursor-pointer transition-all ${
                selectedShift === s.type
                  ? `${s.color} border-suka-orange shadow-xs scale-[1.01]`
                  : 'border-stone-100 bg-stone-50/50 hover:bg-stone-100'
              }`}
            >
              <div>
                <span className="font-bold text-xs block">{s.label}</span>
                <span className="text-[10px] text-gray-500">{s.desc}</span>
              </div>
              <input
                type="radio"
                name="shiftOption"
                checked={selectedShift === s.type}
                onChange={() => setSelectedShift(s.type)}
                className="w-4 h-4 text-suka-orange"
              />
            </label>
          ))}
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-2 pt-3 border-t border-suka-gray-100">
          <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl font-bold">
            Batal
          </Button>
          <Button
            type="button"
            onClick={() => onAssign(selectedShift)}
            className="rounded-xl font-bold bg-suka-orange hover:bg-suka-orange/90 text-white"
          >
            Terapkan Shift
          </Button>
        </div>
      </div>
    </div>
  )
}
