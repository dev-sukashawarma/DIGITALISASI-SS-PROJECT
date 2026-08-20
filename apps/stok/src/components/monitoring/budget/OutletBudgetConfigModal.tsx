'use client'

import React, { useState, useEffect } from 'react'
import { X, Sliders, History, User, Clock, Check, AlertCircle } from 'lucide-react'
import { useOutletBudgetHistory, useUpdateOutletBudgetConfig } from '@/hooks/useOutletBudget'
import type { OutletBudgetSummaryItem } from '@/types/budgetMonitoring'


interface Props {
  outlet: OutletBudgetSummaryItem | null
  onClose: () => void
  onSuccess?: () => void
}

const QUICK_AMOUNTS = [3000000, 5000000, 7500000, 10000000, 15000000, 20000000, 25000000, 30000000]

function formatRupiah(val: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(val)
}

export function OutletBudgetConfigModal({ outlet, onClose, onSuccess }: Props) {
  const [nominal, setNominal] = useState<string>('')
  const [catatan, setCatatan] = useState<string>('')
  const [showHistory, setShowHistory] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const { history, loading: loadingHistory } = useOutletBudgetHistory(outlet?.outletId ?? null)
  const updateMutation = useUpdateOutletBudgetConfig()

  useEffect(() => {
    if (outlet) {
      setNominal(outlet.hasConfig ? String(outlet.nominal) : '10000000')
      setCatatan('')
      setErrorMsg(null)
    }
  }, [outlet])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !updateMutation.isPending) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, updateMutation.isPending])

  if (!outlet) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const numNominal = Number(nominal.replace(/\D/g, ''))
    if (isNaN(numNominal) || numNominal < 0) {
      setErrorMsg('Nominal plafon harus berupa angka valid')
      return
    }

    try {
      await updateMutation.mutateAsync({
        outletId: outlet.outletId,
        nominal: numNominal,
        periodType: 'mingguan',
        customDays: null,
        catatan: catatan.trim() || undefined,
      })
      onSuccess?.()
      onClose()
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memperbarui konfigurasi plafon budget')
    }
  }

  const rawNominal = Number(nominal.replace(/\D/g, '')) || 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-suka-brown/15 rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-suka-brown/10 flex items-center justify-between bg-suka-cream/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-suka-orange/10 flex items-center justify-center text-suka-orange">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-suka-brown text-base">Atur Plafon Budget</h3>
              <p className="text-xs text-suka-brown/60 font-semibold">{outlet.outletName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={updateMutation.isPending}
            className="w-9 h-9 rounded-xl bg-suka-cream/80 hover:bg-suka-cream text-suka-brown/60 hover:text-suka-brown flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Info Pengubah Terakhir */}
          {outlet.updatedByStaffName && (
            <div className="bg-suka-cream/40 border border-suka-brown/10 rounded-2xl p-3.5 flex items-start gap-3 text-xs">
              <User className="w-4 h-4 text-suka-orange shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold text-suka-brown">
                  Terakhir disetel oleh <span className="text-suka-orange">{outlet.updatedByStaffName}</span>
                </p>
                <p className="text-suka-brown/60 text-[11px] flex items-center gap-1">
                  <Clock className="w-3 h-3 text-suka-brown/40" />
                  {outlet.updatedAt ? new Date(outlet.updatedAt).toLocaleString('id-ID') : '-'}
                </p>
              </div>
            </div>
          )}

          {/* Input Nominal */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-suka-brown uppercase tracking-wider">
              Nominal Limit Plafon (Rupiah)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-suka-brown/40 text-sm">
                Rp
              </span>
              <input
                type="text"
                value={rawNominal > 0 ? rawNominal.toLocaleString('id-ID') : ''}
                onChange={(e) => setNominal(e.target.value.replace(/\D/g, ''))}
                placeholder="0"
                className="w-full pl-12 pr-4 py-3 bg-white border border-suka-brown/20 rounded-2xl text-base font-black text-suka-brown focus:outline-none focus:ring-2 focus:ring-suka-orange focus:border-transparent font-mono"
              />
            </div>

            {/* Quick amount chips */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[10px] font-bold text-suka-brown/50 uppercase tracking-wider mr-1">
                Pilihan Cepat:
              </span>
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  type="button"
                  key={amt}
                  onClick={() => setNominal(String(amt))}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                    rawNominal === amt
                      ? 'bg-suka-orange text-white border-suka-orange shadow-2xs'
                      : 'bg-suka-cream/30 hover:bg-suka-cream text-suka-brown/70 border-suka-brown/10'
                  }`}
                >
                  {(amt / 1000000).toLocaleString('id-ID')} Jt
                </button>
              ))}
            </div>
          </div>

          {/* Catatan / Alasan Perubahan (Audit Trail) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-suka-brown uppercase tracking-wider">
              Catatan / Alasan Perubahan <span className="text-suka-brown/40 font-normal">(Audit Log)</span>
            </label>
            <input
              type="text"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Contoh: Kenaikan batas top-up karena event akhir bulan"
              className="w-full px-4 py-2.5 bg-white border border-suka-brown/20 rounded-xl text-xs text-suka-brown focus:outline-none focus:ring-2 focus:ring-suka-orange"
            />
          </div>

          {/* Error message */}
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Riwayat Audit Toggle */}
          <div className="border-t border-suka-brown/10 pt-4">
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs font-bold text-suka-orange hover:text-suka-brown flex items-center gap-1.5 cursor-pointer"
            >
              <History className="w-3.5 h-3.5" />
              <span>{showHistory ? 'Sembunyikan Riwayat Audit' : 'Lihat Riwayat Perubahan Plafon'}</span>
            </button>

            {showHistory && (
              <div className="mt-3 space-y-2 max-h-40 overflow-y-auto pr-1">
                {loadingHistory ? (
                  <p className="text-xs text-suka-brown/50 italic">Memuat riwayat...</p>
                ) : history.length === 0 ? (
                  <p className="text-xs text-suka-brown/50 italic">Belum ada riwayat perubahan tercatat.</p>
                ) : (
                  history.map((h) => (
                    <div key={h.id} className="bg-suka-cream/30 border border-suka-brown/10 rounded-xl p-2.5 text-[11px]">
                      <div className="flex items-center justify-between font-bold text-suka-brown">
                        <span>{formatRupiah(h.nominalBaru)} ({h.periodTypeBaru})</span>
                        <span className="text-[10px] text-suka-brown/50 font-normal">
                          {new Date(h.changedAt).toLocaleDateString('id-ID')}
                        </span>
                      </div>
                      <p className="text-suka-brown/70 mt-0.5">
                        Oleh: <strong className="text-suka-brown">{h.changedByName}</strong>
                        {h.catatan && <span className="italic ml-1">· "{h.catatan}"</span>}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Footer Submit Button */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={updateMutation.isPending}
              className="px-4 py-2.5 rounded-xl border border-suka-brown/20 text-xs font-bold text-suka-brown/70 hover:bg-suka-cream/40 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="px-5 py-2.5 rounded-xl bg-suka-orange hover:bg-suka-orange/90 text-white text-xs font-bold shadow-xs hover:shadow transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {updateMutation.isPending ? (
                <span>Menyimpan...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Simpan Plafon Budget</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
