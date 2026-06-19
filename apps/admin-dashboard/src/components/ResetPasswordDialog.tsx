'use client'
import { useState } from 'react'
import { Button } from '@suka/design-system'

export function ResetPasswordDialog({
  staffName, onSubmit, onClose, submitting,
}: {
  staffName: string
  onSubmit: (newPassword: string) => void
  onClose: () => void
  submitting: boolean
}) {
  const [pw, setPw] = useState('sukashawarma123')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 space-y-4">
        <h3 className="font-bold text-suka-ink">Reset Password — {staffName}</h3>
        <input
          className="w-full rounded-xl border border-suka-gray-200 px-3 py-2.5 outline-none focus:border-suka-orange"
          value={pw} onChange={(e) => setPw(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl">Batal</Button>
          <Button type="button" disabled={submitting || pw.length < 6} onClick={() => onSubmit(pw)} className="rounded-xl">
            {submitting ? 'Menyimpan...' : 'Simpan Password'}
          </Button>
        </div>
      </div>
    </div>
  )
}
