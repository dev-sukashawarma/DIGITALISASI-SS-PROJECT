'use client'

import { useState } from 'react'
import { Button } from '@suka/design-system'
import { generateTempPassword } from '@/lib/generatePassword'

export function ResetPasswordDialog({
  staffName,
  onSubmit,
  onClose,
  submitting,
}: {
  staffName: string
  onSubmit: (newPassword: string) => void
  onClose: () => void
  submitting: boolean
}) {
  const [pw, setPw] = useState(() => generateTempPassword())

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 space-y-4 shadow-xl animate-in zoom-in-95">
        <h3 className="font-bold text-suka-ink text-base">Reset Password — {staffName}</h3>
        <p className="text-xs text-suka-gray-500">Salin password baru di bawah ini dan berikan kepada karyawan yang bersangkutan.</p>
        <input
          className="w-full rounded-xl border border-suka-gray-200 px-3 py-2.5 outline-none font-mono text-sm font-bold text-suka-orange focus:border-suka-orange"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl">
            Batal
          </Button>
          <Button
            type="button"
            disabled={submitting || pw.length < 6}
            onClick={() => onSubmit(pw)}
            className="rounded-xl bg-suka-orange hover:bg-suka-orange/90 text-white"
          >
            {submitting ? 'Menyimpan...' : 'Simpan Password'}
          </Button>
        </div>
      </div>
    </div>
  )
}
