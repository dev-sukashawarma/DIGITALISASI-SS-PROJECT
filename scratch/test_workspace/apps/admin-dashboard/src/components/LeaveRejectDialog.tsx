'use client'

import { useState } from 'react'
import { Button } from '@suka/design-system'

const inputClass =
  'w-full rounded-xl border border-suka-gray-200 px-3 py-2.5 outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all bg-white text-suka-ink text-sm'
const labelClass = 'mb-1 block text-sm font-semibold text-suka-ink'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 space-y-4">
        <h3 className="font-bold text-suka-ink">Tolak Pengajuan Cuti</h3>
        <p className="text-sm text-gray-500">
          Pengajuan cuti dari <span className="font-semibold text-suka-ink">{staffName}</span> akan ditolak.
        </p>

        <div>
          <label className={labelClass}>Alasan Penolakan</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className={inputClass}
            placeholder="Jelaskan alasan penolakan..."
            required
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl">
            Batal
          </Button>
          <Button
            type="button"
            disabled={submitting || note.trim().length < 3}
            onClick={() => onSubmit(note.trim())}
            className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
          >
            {submitting ? 'Menolak...' : 'Tolak Cuti'}
          </Button>
        </div>
      </div>
    </div>
  )
}
