'use client'
import { useState } from 'react'
import { Button, Input } from '@suka/design-system'
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
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

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
        qty: Number(qty),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
        <h2 className="text-lg font-bold mb-4">Lapor Waste: {bahanBaku.nama}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Waste ({bahanBaku.satuan})</label>
            <Input 
              type="number" 
              min="0.01" 
              step="any"
              value={qty} 
              onChange={e => setQty(e.target.value)} 
              placeholder="Contoh: 1.5"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Alasan</label>
            <select 
              value={reason} 
              onChange={e => setReason(e.target.value)}
              className="w-full flex h-10 border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 rounded-md"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Foto Bukti</label>
            <Input 
              type="file" 
              accept="image/*"
              capture="environment"
              onChange={e => setFile(e.target.files?.[0] || null)}
              required
            />
            <p className="text-xs text-gray-500 mt-1">Gunakan kamera HP untuk memotret fisik barang yang waste.</p>
          </div>
          
          <div className="flex gap-2 justify-end mt-6">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>Batal</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Mengirim...' : 'Kirim Laporan'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
