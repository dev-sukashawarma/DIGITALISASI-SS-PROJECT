'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@suka/design-system'
import type { Outlet } from '@/lib/types'

export function DeleteOutletDialog({
  outlet, countRefs, onSoftDelete, onHardDelete, onClose,
}: {
  outlet: Outlet
  countRefs: (id: string) => Promise<number>
  onSoftDelete: () => void
  onHardDelete: () => void
  onClose: () => void
}) {
  const [mounted, setMounted] = useState(false)
  const [refs, setRefs] = useState<number | null>(null)
  const [confirmName, setConfirmName] = useState('')

  useEffect(() => {
    setMounted(true)
    let alive = true
    countRefs(outlet.id).then((n) => { if (alive) setRefs(n) }).catch(() => { if (alive) setRefs(-1) })
    return () => { alive = false }
  }, [outlet.id, countRefs])

  const canHardDelete = refs === 0 && confirmName.trim() === outlet.name

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-t-[28px] sm:rounded-2xl bg-white p-5 sm:p-6 shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        <h3 className="mb-2 text-lg font-bold text-suka-ink">Hapus {outlet.name}?</h3>

        <p className="mb-4 text-sm text-gray-600">
          <strong>Nonaktifkan</strong> menyembunyikan outlet tanpa menghapus data historis. Bisa diaktifkan kembali.
        </p>

        {refs === null && <p className="text-sm text-gray-400">Memeriksa data terkait…</p>}
        {refs !== null && refs > 0 && (
          <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-700">
            Outlet punya {refs} data terkait (staff / ledger). Hapus permanen dinonaktifkan — gunakan Nonaktifkan.
          </p>
        )}
        {refs === 0 && (
          <div className="mb-4 rounded-xl bg-red-50 p-3">
            <p className="mb-2 text-sm text-red-700">Hapus permanen tidak bisa dibatalkan. Ketik nama outlet untuk konfirmasi:</p>
            <input
              className="w-full rounded-xl border border-red-200 px-3 py-2 text-sm outline-none focus:border-red-400"
              placeholder={outlet.name} value={confirmName} onChange={(e) => setConfirmName(e.target.value)}
            />
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 min-h-[44px] text-sm font-semibold text-gray-500 hover:text-gray-700 border border-gray-200 sm:border-transparent active:scale-95"
          >
            Batal
          </button>
          <Button onClick={onSoftDelete} className="rounded-xl min-h-[44px] active:scale-95">Nonaktifkan</Button>
          <button
            type="button"
            onClick={onHardDelete} disabled={!canHardDelete}
            className="rounded-xl bg-red-600 px-4 py-2.5 min-h-[44px] text-sm font-semibold text-white disabled:opacity-40 active:scale-95"
          >
            Hapus permanen
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
