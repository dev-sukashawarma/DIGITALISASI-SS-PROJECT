'use client'
import { useState } from 'react'
import { Button } from '@suka/design-system/src/components/Button'
import { Input } from '@suka/design-system/src/components/Input'
import { createClient } from '@/lib/supabase'
import { submitWasteReport } from '@/app/actions/waste'
import { toast } from 'sonner'
import type { BahanBaku } from '@/types/stok'

type Props = {
  outletId: string;
  bahanBaku: BahanBaku;
  onClose: () => void;
  onSuccess: () => void;
}

export function WasteModal({ outletId, bahanBaku, onClose, onSuccess }: Props) {
  const hasSmallUnit = Boolean(bahanBaku.satuan_kecil && bahanBaku.faktor_tampilan)
  const hasMediumUnit = Boolean(bahanBaku.satuan_tengah && bahanBaku.faktor_tengah)

  // Default to small unit (Gram, Lembar, etc.) for convenience on weighing scales
  const [selectedUnitType, setSelectedUnitType] = useState<'besar' | 'tengah' | 'kecil'>(
    hasSmallUnit ? 'kecil' : 'besar'
  )
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  // Current active unit label
  const activeUnitLabel = selectedUnitType === 'kecil' && bahanBaku.satuan_kecil
    ? bahanBaku.satuan_kecil
    : selectedUnitType === 'tengah' && bahanBaku.satuan_tengah
    ? bahanBaku.satuan_tengah
    : bahanBaku.satuan

  // Compute conversion preview
  const qtyNum = Number(qty)
  let finalQtyBesar = qtyNum
  if (!isNaN(qtyNum) && qtyNum > 0) {
    if (selectedUnitType === 'kecil' && bahanBaku.faktor_tampilan) {
      finalQtyBesar = qtyNum / bahanBaku.faktor_tampilan
    } else if (selectedUnitType === 'tengah' && bahanBaku.faktor_tengah) {
      finalQtyBesar = qtyNum / bahanBaku.faktor_tengah
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!qty || Number(qty) <= 0) {
      toast.error('Jumlah tidak valid')
      return
    }
    if (!reason) {
      toast.error('Pilih alasan waste')
      return
    }
    if (!file) {
      toast.error('Foto bukti harus diunggah')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const fileName = `${outletId}/${bahanBaku.id}/${Date.now()}.${ext}`
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('waste_evidence')
        .upload(fileName, file)
        
      if (uploadError) throw new Error('Gagal mengunggah foto: ' + uploadError.message)

      const photoUrl = supabase.storage.from('waste_evidence').getPublicUrl(uploadData.path).data.publicUrl

      await submitWasteReport({
        outlet_id: outletId,
        bahan_baku_id: bahanBaku.id,
        qty: finalQtyBesar,
        reason,
        photo_url: photoUrl
      })

      toast.success('Laporan waste berhasil dikirim dan menunggu persetujuan')
      onSuccess()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-[#d9c2b2]/50 animate-in fade-in zoom-in-95 duration-150">
        <div className="border-b border-[#d9c2b2]/20 pb-3 mb-4">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#6d3900] bg-[#ffdcc2] px-2 py-0.5 rounded">
            Lapor Waste
          </span>
          <h2 className="text-lg font-black text-[#701604] mt-1">{bahanBaku.nama}</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Unit selection & Qty input */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-bold text-[#544437] uppercase tracking-wide">
                Jumlah Waste
              </label>
              {(hasSmallUnit || hasMediumUnit) && (
                <div className="flex items-center gap-1 bg-[#faf2e9] p-0.5 rounded-lg border border-[#d9c2b2]/40">
                  {hasSmallUnit && (
                    <button
                      type="button"
                      onClick={() => setSelectedUnitType('kecil')}
                      className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                        selectedUnitType === 'kecil'
                          ? 'bg-[#701604] text-white shadow-xs'
                          : 'text-[#544437]/80 hover:text-[#701604]'
                      }`}
                    >
                      {bahanBaku.satuan_kecil}
                    </button>
                  )}
                  {hasMediumUnit && (
                    <button
                      type="button"
                      onClick={() => setSelectedUnitType('tengah')}
                      className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                        selectedUnitType === 'tengah'
                          ? 'bg-[#701604] text-white shadow-xs'
                          : 'text-[#544437]/80 hover:text-[#701604]'
                      }`}
                    >
                      {bahanBaku.satuan_tengah}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedUnitType('besar')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                      selectedUnitType === 'besar'
                        ? 'bg-[#701604] text-white shadow-xs'
                        : 'text-[#544437]/80 hover:text-[#701604]'
                    }`}
                  >
                    {bahanBaku.satuan}
                  </button>
                </div>
              )}
            </div>

            <div className="relative">
              <Input 
                type="number" 
                min="0.001" 
                step="any"
                value={qty} 
                onChange={e => setQty(e.target.value)} 
                placeholder={selectedUnitType === 'kecil' ? "Misal: 500" : "Misal: 1.5"}
                className="pr-16 font-bold"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#544437]/60 pointer-events-none">
                {activeUnitLabel}
              </span>
            </div>

            {/* Live conversion info */}
            {qtyNum > 0 && selectedUnitType !== 'besar' && (
              <p className="text-[11px] font-semibold text-[#006e24] bg-[#e8f5e9] px-2.5 py-1 rounded-lg border border-[#93f997]/40">
                💡 Setara dengan <span className="font-bold">{round2(finalQtyBesar)} {bahanBaku.satuan}</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-[#544437] uppercase tracking-wide mb-1">Alasan Waste</label>
            <select 
              value={reason} 
              onChange={e => setReason(e.target.value)}
              className="w-full flex h-10 border border-[#d9c2b2]/60 bg-white px-3 py-2 text-xs text-[#1e1b15] font-semibold rounded-xl focus:outline-none focus:ring-1 focus:ring-[#f29744] focus:border-[#f29744]"
              required
            >
              <option value="" disabled>Pilih alasan...</option>
              <option value="Basi / Expired">Basi / Expired</option>
              <option value="Jatuh / Tumpah">Jatuh / Tumpah</option>
              <option value="Gosong / Rusak Masak">Gosong / Rusak Masak</option>
              <option value="Kualitas Buruk (dari supplier)">Kualitas Buruk (dari supplier)</option>
              <option value="Lainnya">Lainnya</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#544437] uppercase tracking-wide mb-1">Foto Bukti</label>
            <Input 
              type="file" 
              accept="image/*"
              capture="environment"
              onChange={e => setFile(e.target.files?.[0] || null)}
              required
            />
            <p className="text-[10px] text-[#544437]/60 mt-1 font-medium">Gunakan kamera HP untuk memotret fisik barang yang waste.</p>
          </div>
          
          <div className="flex gap-2 justify-end pt-3 border-t border-[#d9c2b2]/20 mt-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading} className="rounded-xl font-bold text-xs">
              Batal
            </Button>
            <Button type="submit" disabled={loading} className="bg-[#701604] hover:bg-[#571003] text-white rounded-xl font-bold text-xs shadow-sm">
              {loading ? 'Mengirim...' : 'Kirim Laporan'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function round2(num: number): number {
  return Math.round(num * 1000) / 1000;
}
