'use client'

import { useState, useEffect } from 'react'
import { Button, Spinner } from '@suka/design-system'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { X } from 'lucide-react'
import type { Outlet } from '@/lib/types'

const inputCls =
  'w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-sm outline-none focus:border-suka-orange transition-colors'

export function InvestmentDialog({
  outlet,
  onClose
}: {
  outlet: Outlet
  onClose: () => void
}) {
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
      
      toast.success(`Modal Mitra untuk ${outlet.name} berhasil disimpan`)
      onClose()
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Gagal menyimpan data')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 sm:p-6 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-in">
        <div className="flex items-center justify-between border-b border-suka-gray-100 p-4 sm:p-6 bg-cyan-50/50">
          <div>
            <h3 className="text-xl font-bold text-suka-ink">
              Kelola Modal Mitra
            </h3>
            <p className="text-sm text-suka-gray-500 font-medium">{outlet.name}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-suka-gray-100 transition-colors">
            <X size={20} className="text-suka-gray-500" />
          </button>
        </div>

        <div className="p-4 sm:p-6">
          {loading ? (
            <div className="flex justify-center p-8">
              <Spinner />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className="text-sm">
                <span className="mb-1 block font-extrabold text-suka-ink uppercase tracking-wider text-xs">Total Modal / Investasi Awal</span>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-suka-gray-500 sm:text-sm font-semibold">Rp</span>
                  </div>
                  <input 
                    type="number" 
                    required
                    className={`${inputCls} pl-10 font-medium`} 
                    value={nilaiInvestasi || ''} 
                    onChange={(e) => setNilaiInvestasi(Number(e.target.value))} 
                  />
                </div>
              </label>

              <label className="text-sm">
                <span className="mb-1 block font-extrabold text-suka-ink uppercase tracking-wider text-xs">Tanggal Mulai</span>
                <input 
                  type="date" 
                  required
                  className={inputCls} 
                  value={tanggalMulai} 
                  onChange={(e) => setTanggalMulai(e.target.value)} 
                />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="text-sm">
                  <span className="mb-1 block font-extrabold text-suka-ink uppercase tracking-wider text-xs">Omzet Historis (Rp)</span>
                  <input 
                    type="number" 
                    className={inputCls} 
                    value={omzetHistoris || ''} 
                    onChange={(e) => setOmzetHistoris(Number(e.target.value))} 
                    placeholder="Contoh: 15000000"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-extrabold text-suka-ink uppercase tracking-wider text-xs">Transfer Historis (Rp)</span>
                  <input 
                    type="number" 
                    className={inputCls} 
                    value={transferHistoris || ''} 
                    onChange={(e) => setTransferHistoris(Number(e.target.value))} 
                    placeholder="Contoh: 5000000"
                  />
                </label>
              </div>

              <div className="p-4 border border-suka-gray-200 rounded-xl bg-suka-gray-50/50 space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-5 h-5 text-suka-orange focus:ring-suka-orange border-gray-300 rounded cursor-pointer"
                    checked={isProfitSharingActive}
                    onChange={(e) => setIsProfitSharingActive(e.target.checked)}
                  />
                  <span className="font-bold text-sm text-suka-ink">Aktifkan Bagi Hasil Otomatis</span>
                </label>
                
                {isProfitSharingActive && (
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-suka-gray-200 border-dashed">
                    <label className="text-sm">
                      <span className="mb-1 block font-extrabold text-suka-ink uppercase tracking-wider text-[10px]">Porsi Mitra (%)</span>
                      <div className="relative">
                        <input 
                          type="number" 
                          className={`${inputCls} pr-8`} 
                          value={persentaseBagiHasil || ''} 
                          onChange={(e) => setPersentaseBagiHasil(Number(e.target.value))} 
                          max={100}
                          min={0}
                        />
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                          <span className="text-suka-gray-500 font-semibold">%</span>
                        </div>
                      </div>
                    </label>
                    <label className="text-sm">
                      <span className="mb-1 block font-extrabold text-suka-ink uppercase tracking-wider text-[10px]">Management Fee / Bln</span>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-suka-gray-500 font-semibold text-xs">Rp</span>
                        </div>
                        <input 
                          type="number" 
                          className={`${inputCls} pl-8`} 
                          value={managementFee || ''} 
                          onChange={(e) => setManagementFee(Number(e.target.value))} 
                        />
                      </div>
                    </label>
                  </div>
                )}
              </div>

              <label className="text-sm">
                <span className="mb-1 block font-extrabold text-suka-ink uppercase tracking-wider text-xs">Catatan Khusus (Opsional)</span>
                <textarea 
                  className={`${inputCls} min-h-[100px] resize-y`} 
                  value={catatan} 
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="Misal: Perjanjian profit share 50:50 setelah dipotong management fee 3%"
                />
              </label>

              <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-suka-gray-100">
                <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
                  Batal
                </Button>
                <Button type="submit" disabled={saving} className="rounded-xl flex items-center gap-2">
                  {saving && <Spinner className="w-4 h-4 border-2" />}
                  {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
