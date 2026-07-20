'use client'
import { useEffect, useRef, useState } from 'react'
import { usePermintaanActions } from '@/hooks/usePermintaan'
import { useBahanBaku } from '@/hooks/useBahanBaku'
import type { PermintaanWithItems } from '@/types/permintaan'
import { fetchCrosscheckStok } from '@/app/actions/permintaan'
import { calculateBahanBakuRequest } from '@/app/actions/permintaan_target'
import { convertToDistribusiUnit, convertToBaseUnit } from '@/lib/format/compositeUnit'

interface Props {
  permintaan: PermintaanWithItems
  onClose: () => void
  onDone: () => void
  /** Bila `false`, rincian tetap bisa dibaca tetapi Setujui/Tolak dikunci. */
  canApprove?: boolean
}

export function ApprovalModal({ permintaan, onClose, onDone, canApprove = true }: Props) {
  const { approve, tolak } = usePermintaanActions()
  const { bahanBaku } = useBahanBaku()
  const dialogRef = useRef<HTMLDivElement>(null)

  // qty_disetujui state keyed by bahan_baku_id (in distribusi unit)
  const [qtys, setQtys] = useState<Record<string, number>>({})
  
  useEffect(() => {
    if (bahanBaku.length > 0 && Object.keys(qtys).length === 0) {
      setQtys(Object.fromEntries(permintaan.items.map(it => {
        const b = bahanBaku.find(x => x.id === it.bahan_baku_id)
        return [it.bahan_baku_id, b ? Math.ceil(convertToDistribusiUnit(it.qty_diminta, b)) : it.qty_diminta]
      })))
    }
  }, [permintaan.items, bahanBaku])
  const [crosscheckData, setCrosscheckData] = useState<Record<string, { outletStok: number; gudangStok: number }> | null>(null)
  const [isFetchingCrosscheck, setIsFetchingCrosscheck] = useState(true)
  const [calculatedMap, setCalculatedMap] = useState<Record<string, number>>({})

  useEffect(() => {
    const fetchCrosscheck = async () => {
      try {
        const bahanBakuIds = permintaan.items.map(it => it.bahan_baku_id)
        const data = await fetchCrosscheckStok(permintaan.outlet_id, bahanBakuIds)
        setCrosscheckData(data)
      } catch (err) {
        console.error('Failed to fetch crosscheck data', err)
      } finally {
        setIsFetchingCrosscheck(false)
      }
    }
    const fetchKebutuhan = async () => {
      if (Array.isArray(permintaan.target_metadata) && permintaan.target_metadata.length > 0) {
        try {
          const targets = permintaan.target_metadata.map((tm: any) => ({
            resep_id: tm.id,
            qty_target: tm.qty
          }))
          const calcResult = await calculateBahanBakuRequest(permintaan.outlet_id, targets)
          const map: Record<string, number> = {}
          calcResult.forEach((c) => {
            map[c.bahan_baku_id] = c.kebutuhan
          })
          setCalculatedMap(map)
        } catch (err) {
          console.error('Failed to calculate kebutuhan', err)
        }
      }
    }
    
    fetchCrosscheck()
    fetchKebutuhan()
  }, [permintaan.outlet_id, permintaan.items, permintaan.target_metadata])

  const hasOverStock = permintaan.items.some(
    it => {
      if (!crosscheckData || !crosscheckData[it.bahan_baku_id]) return false
      const b = bahanBaku.find(x => x.id === it.bahan_baku_id)
      const qtyDisetujuiBase = b ? convertToBaseUnit(qtys[it.bahan_baku_id] ?? 0, b) : (qtys[it.bahan_baku_id] ?? 0)
      return qtyDisetujuiBase > crosscheckData[it.bahan_baku_id].gudangStok
    }
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
      const items = permintaan.items.map(it => {
        const b = bahanBaku.find(x => x.id === it.bahan_baku_id)
        const qtyDisetujuiBase = b ? convertToBaseUnit(qtys[it.bahan_baku_id] ?? 0, b) : (qtys[it.bahan_baku_id] ?? 0)
        return {
          bahan_baku_id: it.bahan_baku_id,
          qty_disetujui: qtyDisetujuiBase,
        }
      })
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

        {/* Target Menu Summary */}
        {Array.isArray(permintaan.target_metadata) && permintaan.target_metadata.length > 0 && (
          <div className="bg-[#faf2e9] p-3 rounded-xl border border-[#d9c2b2]/30 text-sm space-y-2">
            <p className="font-bold text-[#701604] text-xs uppercase tracking-wide">Target Penjualan</p>
            <div className="space-y-1">
              {permintaan.target_metadata.map((tm: any, i: number) => (
                <div key={i} className="flex justify-between items-center text-[11px] text-[#544437]">
                  <span>{tm.qty}x {tm.nama}</span>
                  <span className="font-semibold text-[#1e1b15]">Rp {(tm.qty * (tm.harga_jual || 0)).toLocaleString('id-ID')}</span>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t border-[#d9c2b2]/30 flex justify-between items-center text-xs">
              <span className="font-bold text-[#544437]">Estimasi Omzet</span>
              <span className="font-bold text-[#2b5914] bg-[#e3f5d5] px-2 py-0.5 rounded border border-[#c3e3af]">
                Rp {permintaan.target_metadata.reduce((acc: number, tm: any) => acc + (tm.qty * (tm.harga_jual || 0)), 0).toLocaleString('id-ID')}
              </span>
            </div>
          </div>
        )}

        {/* Items */}
        <div className="space-y-3">
          <div className="space-y-3 max-h-[35vh] overflow-y-auto pr-2">
            {permintaan.items.map(it => {
              const b = bahanBaku.find(x => x.id === it.bahan_baku_id)
              const distUnit = b?.satuan_distribusi || it.satuan || ''
              const qtyDiminta = b ? Math.ceil(convertToDistribusiUnit(it.qty_diminta, b)) : it.qty_diminta
              const qtyDisetujuiBase = b ? convertToBaseUnit(qtys[it.bahan_baku_id] ?? 0, b) : (qtys[it.bahan_baku_id] ?? 0)
              const gudangStokBase = crosscheckData?.[it.bahan_baku_id]?.gudangStok ?? 0
              const isOverStock = crosscheckData && crosscheckData[it.bahan_baku_id] && qtyDisetujuiBase > gudangStokBase

              return (
              <div key={it.bahan_baku_id} className="flex items-center justify-between gap-4 border-b border-[#d9c2b2]/10 pb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#1e1b15] truncate">{it.nama ?? it.bahan_baku_id}</p>
                  {calculatedMap[it.bahan_baku_id] !== undefined && (
                    <p className="text-[10px] font-medium text-[#544437] mt-0.5">
                      HPP Penggunaan: <span className="font-bold">{Number(calculatedMap[it.bahan_baku_id]).toFixed(2)}</span> {it.satuan ?? ''} | 
                      Pembulatan: <span className="font-bold">{Math.ceil(calculatedMap[it.bahan_baku_id])}</span> {it.satuan ?? ''}
                    </p>
                  )}
                  <p className="text-[11px] font-semibold text-[#544437] mt-0.5">Diminta: <span className="font-bold text-[#701604]">{qtyDiminta} {distUnit}</span></p>
                  {isFetchingCrosscheck ? (
                    <p className="text-[10px] text-[#544437]/60 mt-0.5 animate-pulse">Memuat stok...</p>
                  ) : crosscheckData && crosscheckData[it.bahan_baku_id] ? (
                    <p className="text-[10px] text-[#544437] mt-0.5 font-medium">
                      Stok Outlet: {crosscheckData[it.bahan_baku_id].outletStok} {it.satuan} | Stok Gudang: {crosscheckData[it.bahan_baku_id].gudangStok} {it.satuan}
                    </p>
                  ) : (
                    <p className="text-[10px] text-[#544437]/60 mt-0.5">(Stok tidak dapat dimuat)</p>
                  )}
                </div>
                
                {/* Qty Stepper */}
                <div className="flex items-center flex-shrink-0">
                  {isOverStock && (
                    <span className="text-xs mr-2" title="Melebihi stok gudang">⚠️</span>
                  )}
                  <div className={`flex items-center border rounded-xl px-1 py-0.5 ${
                    isOverStock
                      ? 'bg-orange-50 border-orange-200'
                      : 'bg-[#faf2e9] border-[#d9c2b2]/30'
                  }`}>
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
                      className={`w-12 bg-transparent border-none text-center font-bold focus:ring-0 p-0 text-sm ${
                        isOverStock
                          ? 'text-orange-600'
                          : 'text-[#1e1b15]'
                      }`}
                      disabled={loading}
                      aria-label={`Jumlah disetujui ${it.nama ?? it.bahan_baku_id}`}
                    />
                    <span className="text-[10px] font-bold text-[#904d00] mr-1">{distUnit}</span>
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
              </div>
              )
            })}
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

        {/* Warning Melebihi Gudang */}
        {hasOverStock && (
          <p className="text-xs font-bold text-orange-600 bg-orange-50 border border-orange-200 p-2.5 rounded-xl mb-4 flex items-center gap-2" role="alert">
            <span>⚠️</span> Beberapa item melebihi stok gudang. Mohon periksa kembali.
          </p>
        )}

        {!canApprove && (
          <p
            className="text-xs font-semibold text-[#544437] bg-[#f5ede3] border border-[#d9c2b2]/60 p-2.5 rounded-xl mb-4 flex items-start gap-2"
            role="status"
          >
            <span>👁️</span>
            <span>
              Anda hanya memantau. Keputusan setujui/tolak permintaan ini ada di Gudang Pusat
              (kitchen), admin, atau owner — sebab persetujuan langsung menerbitkan surat jalan.
            </span>
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
            disabled={loading || !canApprove}
            title={canApprove ? undefined : 'Hanya Gudang Pusat, admin, atau owner yang boleh menolak'}
            className="px-4 py-3 text-xs uppercase font-bold tracking-wider rounded-xl text-red-600 border border-red-300 hover:bg-red-50 transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            Tolak
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={loading || !canApprove}
            title={canApprove ? undefined : 'Hanya Gudang Pusat, admin, atau owner yang boleh menyetujui'}
            className="px-5 py-3 text-xs uppercase font-bold tracking-wider rounded-xl bg-[#f29744] text-white hover:bg-[#e0873a] transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#f29744]"
          >
            Setujui
          </button>
        </div>
      </div>
    </div>
  )
}
