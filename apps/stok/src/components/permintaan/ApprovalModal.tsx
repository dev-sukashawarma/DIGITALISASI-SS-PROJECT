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

  const handleMinus = (id: string) => {
    setQtys(prev => ({
      ...prev,
      [id]: Math.max(0, (prev[id] ?? 0) - 1),
    }))
    setErrorMsg(null)
  }

  const handlePlus = (id: string) => {
    setQtys(prev => ({
      ...prev,
      [id]: (prev[id] ?? 0) + 1,
    }))
    setErrorMsg(null)
  }

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 border border-[#d9c2b2]/40 space-y-5"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        aria-modal="true"
        aria-labelledby="approval-modal-title"
        role="dialog"
      >
        {/* Header */}
        <div>
          <h2 id="approval-modal-title" className="text-lg font-bold text-[#701604]">
            Persetujuan Permintaan
          </h2>
          <p className="text-xs font-semibold text-[#1e1b15] mt-1">
            Outlet: {permintaan.outlet_name ?? permintaan.outlet_id}
          </p>
          <p className="text-[11px] text-[#544437]/60 mt-0.5">
            Dibuat: {new Date(permintaan.created_at).toLocaleString('id-ID')}
          </p>
        </div>

        {/* Items */}
        <div className="space-y-3">
          <div className="space-y-3 max-h-[35vh] overflow-y-auto pr-2">
            {permintaan.items.map(it => (
              <div key={it.bahan_baku_id} className="flex items-center justify-between gap-4 border-b border-[#d9c2b2]/10 pb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#1e1b15] truncate">{it.nama ?? it.bahan_baku_id}</p>
                  <p className="text-[11px] text-[#544437]/60 mt-0.5">Diminta: {it.qty_diminta}</p>
                </div>
                
                {/* Qty Stepper */}
                <div className="flex items-center bg-[#faf2e9] border border-[#d9c2b2]/30 rounded-xl px-1 py-0.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleMinus(it.bahan_baku_id)}
                    disabled={loading}
                    className="w-8 h-8 flex items-center justify-center text-[#904d00] hover:bg-[#efe7dd] rounded-lg transition-colors font-bold text-lg disabled:opacity-40"
                    aria-label={`Kurangi ${it.nama ?? it.bahan_baku_id}`}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={0}
                    value={qtys[it.bahan_baku_id] ?? 0}
                    onChange={e => {
                      setQtys(prev => ({ ...prev, [it.bahan_baku_id]: Number(e.target.value) }))
                      setErrorMsg(null)
                    }}
                    className="w-12 bg-transparent border-none text-center font-bold text-[#1e1b15] focus:ring-0 p-0 text-sm"
                    disabled={loading}
                    aria-label={`Jumlah disetujui ${it.nama ?? it.bahan_baku_id}`}
                  />
                  <button
                    type="button"
                    onClick={() => handlePlus(it.bahan_baku_id)}
                    disabled={loading}
                    className="w-8 h-8 flex items-center justify-center text-[#904d00] hover:bg-[#efe7dd] rounded-lg transition-colors font-bold text-lg disabled:opacity-40"
                    aria-label={`Tambah ${it.nama ?? it.bahan_baku_id}`}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[#544437]/50">Set qty 0 untuk menolak item tertentu</p>
        </div>

        {/* Alasan */}
        <div>
          <label className="block text-xs font-semibold text-[#544437] mb-1">
            Alasan Penolakan (wajib jika menolak seluruh permintaan)
          </label>
          <textarea
            rows={2}
            value={alasan}
            onChange={e => {
              setAlasan(e.target.value)
              setErrorMsg(null)
            }}
            placeholder="Tulis alasan jika menolak permintaan ini…"
            className="w-full border border-[#d9c2b2] rounded-xl px-3 py-2 text-xs bg-[#faf2e9]/40 resize-none focus:outline-none focus:ring-2 focus:ring-[#f29744]/50 focus:border-[#f29744] text-[#1e1b15]"
            disabled={loading}
          />
        </div>

        {/* Error */}
        {errorMsg && (
          <p className="text-xs font-bold text-[#ba1a1a] bg-[#ffdad6] border border-[#ba1a1a]/20 p-2.5 rounded-xl" role="alert">
            {errorMsg}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-3 text-xs uppercase font-bold tracking-wider rounded-xl text-[#544437] border border-[#d9c2b2] hover:bg-[#f7f0ea] transition active:scale-95 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleTolak}
            disabled={loading}
            className="px-4 py-3 text-xs uppercase font-bold tracking-wider rounded-xl text-red-600 border border-red-300 hover:bg-red-50 transition active:scale-95 disabled:opacity-50"
          >
            Tolak
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={loading}
            className="px-5 py-3 text-xs uppercase font-bold tracking-wider rounded-xl bg-[#f29744] text-white hover:bg-[#e0873a] transition active:scale-95 disabled:opacity-50"
          >
            Setujui
          </button>
        </div>
      </div>
    </div>
  )
}
