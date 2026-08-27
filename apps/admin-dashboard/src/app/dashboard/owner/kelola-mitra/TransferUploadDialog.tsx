'use client'

import React, { useState } from 'react'
import { saveMitraTransfer } from './actions'
import { createClient } from '@/lib/supabase'
import { UploadCloud, X, Check, Paperclip } from 'lucide-react'
import { toast } from 'sonner'

export function TransferUploadDialog({ isOpen, onClose, outlets = [] }: any) {
  const [loading, setLoading] = useState(false)
  const [outletId, setOutletId] = useState('')
  const [bulan, setBulan] = useState(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
  })
  const [nominal, setNominal] = useState('')
  const [catatan, setCatatan] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!outletId || !bulan || !nominal || !file) {
      toast.error('Mohon lengkapi Outlet Mitra, Bulan, Nominal, dan Berkas Bukti')
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
        
      if (uploadError) throw new Error(`Gagal upload berkas: ${uploadError.message}`)
      
      // 2. Save record to DB
      await saveMitraTransfer({
        outlet_id: outletId,
        bulan,
        nominal: Number(nominal),
        bukti_url: fileName,
        catatan
      })
      
      toast.success('Bukti transfer bagi hasil berhasil diunggah')
      onClose()
    } catch (e: any) {
      toast.error(e.message || 'Terjadi kesalahan saat mengunggah')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl p-6 sm:p-7 space-y-5 border border-amber-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/60">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 leading-tight">Upload Bukti Transfer</h2>
              <p className="text-xs text-gray-500 font-normal">Unggah bukti transfer bagi hasil bulanan mitra</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Outlet Select */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Outlet Mitra <span className="text-rose-500">*</span>
            </label>
            <select
              value={outletId}
              onChange={(e) => setOutletId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none bg-white font-normal text-gray-800 transition-all"
            >
              <option value="">-- Pilih Outlet Mitra Tujuan --</option>
              {outlets.map((o: any) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          
          {/* Periode Bulan & Nominal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Periode Bulan <span className="text-rose-500">*</span>
              </label>
              <input
                type="month"
                value={bulan}
                onChange={(e) => setBulan(e.target.value)}
                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none bg-white font-normal text-gray-800 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Nominal Transfer (Rp) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                value={nominal}
                onChange={(e) => setNominal(e.target.value)}
                placeholder="Contoh: 15000000"
                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none bg-white font-bold text-gray-800 transition-all"
              />
            </div>
          </div>
          
          {/* Upload File */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Berkas Bukti Transfer (PDF / Gambar) <span className="text-rose-500">*</span>
            </label>
            <div className="relative border-2 border-dashed border-gray-200 hover:border-amber-400 rounded-2xl p-4 text-center transition-colors bg-gray-50/50">
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center justify-center gap-1.5">
                <Paperclip className="w-6 h-6 text-gray-400" />
                <span className="text-xs font-medium text-gray-600">
                  {file ? file.name : 'Klik atau seret berkas bukti transfer ke sini'}
                </span>
                <span className="text-[10px] text-gray-400 font-normal">PNG, JPG, PDF (Maks. 5MB)</span>
              </div>
            </div>
          </div>
          
          {/* Catatan */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Catatan / Keterangan
            </label>
            <textarea
              rows={2}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Catatan tambahan untuk mitra..."
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none bg-white font-normal text-gray-800 resize-none transition-all placeholder-gray-400"
            />
          </div>
          
          {/* Submit Action */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-amber-600/25 transition-all disabled:opacity-50"
            >
              {loading ? 'Mengunggah...' : 'Simpan Bukti Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
