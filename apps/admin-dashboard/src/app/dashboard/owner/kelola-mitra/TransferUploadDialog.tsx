'use client'

import { useState } from 'react'
import { saveMitraTransfer } from './actions'
import { createClient } from '@/lib/supabase'

export function TransferUploadDialog({ isOpen, onClose, outlets }: any) {
  const [loading, setLoading] = useState(false)
  const [outletId, setOutletId] = useState('')
  const [bulan, setBulan] = useState('')
  const [nominal, setNominal] = useState('')
  const [catatan, setCatatan] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!outletId || !bulan || !nominal || !file) {
      alert('Mohon lengkapi Outlet, Bulan, Nominal, dan File Bukti')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      
      // 1. Upload to storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${outletId}/${bulan}-${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from('mitra-transfers')
        .upload(fileName, file)
        
      if (uploadError) throw new Error(`Gagal upload file: ${uploadError.message}`)
      
      // 2. Save record to DB
      await saveMitraTransfer({
        outlet_id: outletId,
        bulan,
        nominal: Number(nominal),
        bukti_url: fileName,
        catatan
      })
      
      alert('Bukti transfer berhasil diupload')
      onClose()
    } catch (e: any) {
      alert(e.message || 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-xl shadow-2xl p-6">
        <h2 className="text-xl font-bold mb-4">Upload Bukti Transfer</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Outlet Mitra</label>
            <select
              value={outletId}
              onChange={(e) => setOutletId(e.target.value)}
              className="w-full border rounded-lg p-2 text-sm focus:ring-2 outline-none"
            >
              <option value="">Pilih Outlet...</option>
              {outlets.map((o: any) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bulan Transfer</label>
              <input
                type="month"
                value={bulan}
                onChange={(e) => setBulan(e.target.value)}
                className="w-full border rounded-lg p-2 text-sm focus:ring-2 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nominal (Rp)</label>
              <input
                type="number"
                value={nominal}
                onChange={(e) => setNominal(e.target.value)}
                className="w-full border rounded-lg p-2 text-sm focus:ring-2 outline-none"
                placeholder="Contoh: 1500000"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">File Bukti Transfer (PDF/JPG/PNG)</label>
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full border rounded-lg p-2 text-sm focus:ring-2 outline-none"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Catatan Tambahan</label>
            <textarea
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              className="w-full border rounded-lg p-2 text-sm focus:ring-2 outline-none"
              placeholder="Catatan opsional..."
              rows={2}
            />
          </div>
          
          <div className="flex justify-end space-x-3 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">
              Batal
            </button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
              {loading ? 'Mengupload...' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
