'use client'

import { useEffect, useState } from 'react'
import { Button } from '@suka/design-system'
import { X } from 'lucide-react'

/** Jendela alasan tolak yang sama untuk semua jenis pengajuan di Hub Approval. */
export function AlasanTolakModal({
  isOpen,
  judul,
  onClose,
  onKonfirmasi,
  isPending = false,
}: {
  isOpen: boolean
  judul: string
  onClose: () => void
  onKonfirmasi: (alasan: string) => Promise<void>
  isPending?: boolean
}) {
  const [alasan, setAlasan] = useState('')

  useEffect(() => {
    if (isOpen) setAlasan('')
  }, [isOpen])

  if (!isOpen) return null

  const bersih = alasan.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-suka-brown">{judul}</h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="text-suka-gray-400 hover:text-suka-ink">
            <X size={20} />
          </button>
        </div>
        <label className="block text-sm font-semibold text-suka-gray-600">
          Alasan menolak (wajib)
          <textarea
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-sm outline-none focus:border-suka-orange"
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button variant="danger" onClick={() => onKonfirmasi(bersih)} disabled={!bersih || isPending}>
            Tolak
          </Button>
        </div>
      </div>
    </div>
  )
}
