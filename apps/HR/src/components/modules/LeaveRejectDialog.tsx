'use client'

import { useState } from 'react'
import { Button } from '@suka/design-system'

const inputClass =
  'w-full rounded-xl border border-suka-gray-200 px-3 py-2.5 outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all bg-white text-suka-ink text-sm'
const labelClass = 'mb-1 block text-xs font-bold text-suka-brown'

export function LeaveRejectDialog({
  staffName,
  onSubmit,
  onClose,
  submitting,
}: {
  staffName: string
  onSubmit: (note: string) => void
  onClose: () => void
  submitting: boolean
}) {
  const [note, setNote] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 space-y-4 shadow-xl animate-in zoom-in-95">
        <h3 className="font-bold text-suka-brown text-base">Tolak Pengajuan Cuti</h3>
        <p className="text-xs text-suka-gray-500">
          Pengajuan cuti dari <strong className="text-suka-ink">{staffName}</strong> akan ditolak. Berikan alasan penolakan untuk karyawan.
        </p>

        <div>
          <label className={labelClass}>Alasan Penolakan</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className={inputClass}
            placeholder="Jelaskan alasan permohonan ditolak..."
            required
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl font-bold">
            Batal
          </Button>
          <Button
            type="button"
            disabled={submitting || note.trim().length < 3}
            onClick={() => onSubmit(note.trim())}
            className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold"
          >
            {submitting ? 'Menolak...' : 'Tolak Cuti'}
          </Button>
        </div>
      </div>
    </div>
  )
}
