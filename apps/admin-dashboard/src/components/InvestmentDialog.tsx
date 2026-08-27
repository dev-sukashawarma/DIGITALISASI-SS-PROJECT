// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Spinner } from '@suka/design-system'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { X, DollarSign } from 'lucide-react'
import type { Outlet } from '@/lib/types'

const inputCls =
  'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all font-normal'

export function InvestmentDialog({
  outlet,
  onClose
}: {
  outlet: Outlet
  onClose: () => void
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [nilaiInvestasi, setNilaiInvestasi] = useState<number>(0)
  const [tanggalMulai, setTanggalMulai] = useState<string>('')
  const [catatan, setCatatan] = useState<string>('')
  
  const [omzetHistoris, setOmzetHistoris] = useState<number>(0)
  const [transferHistoris, setTransferHistoris] = useState<number>(0)
  
  const [isProfitSharingActive, setIsProfitSharingActive] = useState<boolean>(false)
  const [persentaseBagiHasil, setPersentaseBagiHasil] = useState<number>(50)
  const [managementFee, setManagementFee] = useState<number>(0)

  useEffect(() => {
    const fetchInvestment = async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('mitra_investments')
        .select('*')
        .eq('outlet_id', outlet.id)
        .maybeSingle()
      
      if (data) {
        setNilaiInvestasi(data.nilai_investasi || 0)
        setTanggalMulai(data.tanggal_mulai ? data.tanggal_mulai.slice(0, 10) : '')
        setCatatan(data.catatan || '')
        setOmzetHistoris(data.omzet_historis || 0)
        setTransferHistoris(data.transfer_historis || 0)
        setIsProfitSharingActive(data.is_profit_sharing_active || false)
        setPersentaseBagiHasil(data.persentase_bagi_hasil ?? 50)
        setManagementFee(data.management_fee || 0)
      }
      setLoading(false)
    }

    fetchInvestment()
  }, [outlet.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    
    try {
      const supabase = createClient()
      
      const { data: existing } = await supabase
        .from('mitra_investments')
        .select('id')
        .eq('outlet_id', outlet.id)
        .maybeSingle()

      const payload = {
        outlet_id: outlet.id,
        nilai_investasi: nilaiInvestasi,
        tanggal_mulai: tanggalMulai || new Date().toISOString().slice(0, 10),
        catatan: catatan,
        omzet_historis: omzetHistoris,
        transfer_historis: transferHistoris,
        is_profit_sharing_active: isProfitSharingActive,
        persentase_bagi_hasil: persentaseBagiHasil,
        management_fee: managementFee
      }

      let error = null
      if (existing?.id) {
        const { error: updErr } = await supabase
          .from('mitra_investments')
          .update(payload)
          .eq('id', existing.id)
        error = updErr
      } else {
        const { error: insErr } = await supabase
          .from('mitra_investments')
          .insert([payload])
        error = insErr
      }

      if (error) throw error

      // Synchronize profit_sharing_pct to associated mitra_profiles
      const { data: allProfs } = await supabase.from('mitra_profiles').select('id, outlet_ids')
      const targetProf = allProfs?.find((p: any) => (p.outlet_ids || []).includes(outlet.id))
      if (targetProf) {
        await supabase
          .from('mitra_profiles')
          .update({ profit_sharing_pct: persentaseBagiHasil })
          .eq('id', targetProf.id)
      }
      
      toast.success(`Modal Mitra untuk ${outlet.name} berhasil disimpan`)
      router.refresh()
      onClose()
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Gagal menyimpan data')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 sm:p-6 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fade-in border border-amber-100">
        <div className="flex items-center justify-between border-b border-gray-100 p-5 bg-amber-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-700 flex items-center justify-center border border-amber-200/60">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 leading-tight">
                Kelola Modal Investasi
              </h3>
              <p className="text-xs text-gray-500 font-normal">{outlet.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-gray-100 transition-colors">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="flex justify-center p-8">
              <Spinner />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className="text-sm">
                <span className="mb-1.5 block font-semibold text-gray-700 uppercase tracking-wider text-xs">Total Modal / Investasi Awal</span>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-400 sm:text-sm font-semibold">Rp</span>
                  </div>
                  <input 
                    type="number" 
                    required
                    className={`${inputCls} pl-10 font-bold text-gray-900`} 
                    value={nilaiInvestasi || ''} 
                    onChange={(e) => setNilaiInvestasi(Number(e.target.value))} 
                  />
                </div>
              </label>

              <label className="text-sm">
                <span className="mb-1.5 block font-semibold text-gray-700 uppercase tracking-wider text-xs">Tanggal Mulai Usaha</span>
                <input 
                  type="date" 
                  required
                  className={inputCls} 
                  value={tanggalMulai} 
                  onChange={(e) => setTanggalMulai(e.target.value)} 
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  <span className="mb-1 block font-semibold text-gray-700 uppercase tracking-wider text-[11px]">Omzet Historis (Rp)</span>
                  <span className="text-[10px] text-gray-400 block mb-1 font-normal">Omzet sebelum sistem digital</span>
                  <input 
                    type="number" 
                    className={inputCls} 
                    value={omzetHistoris || ''} 
                    onChange={(e) => setOmzetHistoris(Number(e.target.value))} 
                    placeholder="Contoh: 15000000"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-semibold text-gray-700 uppercase tracking-wider text-[11px]">Transfer Historis (Rp)</span>
                  <span className="text-[10px] text-gray-400 block mb-1 font-normal">Bagi hasil manual masa lalu</span>
                  <input 
                    type="number" 
                    className={inputCls} 
                    value={transferHistoris || ''} 
                    onChange={(e) => setTransferHistoris(Number(e.target.value))} 
                    placeholder="Contoh: 5000000"
                  />
                </label>
              </div>

              <div className="p-4 border border-gray-200 rounded-2xl bg-gray-50/50 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded cursor-pointer"
                    checked={isProfitSharingActive}
                    onChange={(e) => setIsProfitSharingActive(e.target.checked)}
                  />
                  <span className="font-semibold text-xs text-gray-900">Aktifkan Bagi Hasil & Management Fee</span>
                </label>
                
                {isProfitSharingActive && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200 border-dashed">
                    <label className="text-sm">
                      <span className="mb-1 block font-semibold text-gray-700 uppercase tracking-wider text-[10px]">Porsi Mitra (%)</span>
                      <div className="relative">
                        <input 
                          type="number" 
                          className={`${inputCls} pr-8 font-bold`} 
                          value={persentaseBagiHasil || ''} 
                          onChange={(e) => setPersentaseBagiHasil(Number(e.target.value))} 
                          max={100}
                          min={0}
                        />
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                          <span className="text-gray-400 font-semibold">%</span>
                        </div>
                      </div>
                    </label>
                    <label className="text-sm">
                      <span className="mb-1 block font-semibold text-gray-700 uppercase tracking-wider text-[10px]">Management Fee (% Omzet)</span>
                      <div className="relative">
                        <input 
                          type="number" 
                          className={`${inputCls} pr-8 font-bold`} 
                          value={managementFee || ''} 
                          onChange={(e) => setManagementFee(Number(e.target.value))} 
                          placeholder="3"
                          max={100}
                          min={0}
                        />
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                          <span className="text-gray-400 font-semibold">%</span>
                        </div>
                      </div>
                    </label>
                  </div>
                )}
              </div>

              <label className="text-sm">
                <span className="mb-1.5 block font-semibold text-gray-700 uppercase tracking-wider text-xs">Catatan Khusus (Opsional)</span>
                <textarea 
                  className={`${inputCls} min-h-[80px] resize-none`} 
                  value={catatan} 
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="Misal: Perjanjian profit share 50:50..."
                />
              </label>

              <div className="mt-2 flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={onClose} 
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={saving} 
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-amber-600/25 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <Spinner className="w-3.5 h-3.5 border-2" />}
                  <span>{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
