'use client'
import { useEffect, useRef, useState } from 'react'
import { usePermintaanActions } from '@/hooks/usePermintaan'
import type { PermintaanWithItems } from '@/types/permintaan'

interface Props {
  permintaan: PermintaanWithItems
  onClose: () => void
  onDone: () => void
}

export function ApprovalModal({ permintaan, onClose, onDone }: Props) {
  const { approve, tolak } = usePermintaanActions()
  const dialogRef = useRef<HTMLDivElement>(null)

  // qty_disetujui state keyed by bahan_baku_id
  const [qtys, setQtys] = useState<Record<string, number>>(() =>
    Object.fromEntries(permintaan.items.map(it => [it.bahan_baku_id, it.qty_diminta]))
  )
  const [alasan, setAlasan] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [loading, onClose])

  const handleApprove = async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const items = permintaan.items.map(it => ({
        bahan_baku_id: it.bahan_baku_id,
        qty_disetujui: qtys[it.bahan_baku_id] ?? 0,
      }))
      await approve(permintaan.id, items)
      onDone()
    } catch (err: any) {
      setErrorMsg(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleTolak = async () => {
    if (!alasan.trim()) {
      setErrorMsg('Alasan wajib diisi untuk menolak.')
      return
    }
    setLoading(true)
    setErrorMsg(null)
    try {
      await tolak(permintaan.id, alasan.trim())
      onDone()
    } catch (err: any) {
      setErrorMsg(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-5"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        aria-modal="true"
        aria-labelledby="approval-modal-title"
        role="dialog"
      >
        {/* Header */}
        <div>
          <h2 id="approval-modal-title" className="text-base font-bold text-[#1e1b15]">
            Permintaan — {permintaan.outlet_name ?? permintaan.outlet_id}
          </h2>
          <p className="text-[11px] text-[#544437]/60 mt-0.5">
            {new Date(permintaan.created_at).toLocaleString('id-ID')}
          </p>
        </div>

        {/* Items */}
        <div className="space-y-3">
          <div className="space-y-3 max-h-[35vh] overflow-y-auto pr-2">
            {permintaan.items.map(it => (
              <div key={it.bahan_baku_id} className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1e1b15] truncate">{it.nama ?? it.bahan_baku_id}</p>
                  <p className="text-[11px] text-[#544437]/60">minta {it.qty_diminta}</p>
                </div>
                <input
                  type="number"
                  min={0}
                  value={qtys[it.bahan_baku_id] ?? 0}
                  onChange={e => {
                    setQtys(prev => ({ ...prev, [it.bahan_baku_id]: Number(e.target.value) }))
                    setErrorMsg(null)
                  }}
                  className="w-20 text-right border border-[#d9c2b2] rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#f29744]/50"
                  disabled={loading}
                />
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[#544437]/50">Set qty 0 untuk menolak item tertentu</p>
        </div>

        {/* Alasan */}
        <div>
          <label className="block text-xs font-semibold text-[#544437] mb-1">
            Alasan (untuk tolak)
          </label>
          <textarea
            rows={2}
            value={alasan}
            onChange={e => {
              setAlasan(e.target.value)
              setErrorMsg(null)
            }}
            placeholder="Wajib diisi jika menolak…"
            className="w-full border border-[#d9c2b2] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#f29744]/50"
            disabled={loading}
          />
        </div>

        {/* Error */}
        {errorMsg && (
          <p className="text-xs font-bold text-[#ba1a1a] bg-red-50 border border-red-200 p-2 rounded" role="alert">
            {errorMsg}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-xl text-[#544437] border border-[#d9c2b2] hover:bg-[#f7f0ea] transition disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={handleTolak}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-xl text-red-600 border border-red-300 hover:bg-red-50 transition disabled:opacity-50"
          >
            Tolak
          </button>
          <button
            onClick={handleApprove}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-xl bg-[#f29744] text-white font-semibold hover:bg-[#e0873a] transition disabled:opacity-50"
          >
            Setujui
          </button>
        </div>
      </div>
    </div>
  )
}
