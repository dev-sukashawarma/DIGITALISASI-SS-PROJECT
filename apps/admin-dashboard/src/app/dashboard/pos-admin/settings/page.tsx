'use client'

import { useState, useEffect } from 'react'
import { Loader2, Image as ImageIcon, Save, CheckCircle2, AlertCircle, X } from 'lucide-react'
import { useBrand } from '@/components/BrandContext'

export default function AdminSettingsPage() {
  const { brandName: currentBrandName, brandLogo: currentBrandLogo, refreshBrand } = useBrand()
  
  const [name, setName] = useState('')
  const [_, setLogoFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState<{type: 'success' | 'error', message: string} | null>(null)

  useEffect(() => {
    setName(currentBrandName || 'SHAWARMA')
    setPreview(currentBrandLogo || null)
  }, [currentBrandName, currentBrandLogo])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast('error', 'Ukuran gambar maksimal 2MB')
        return
      }
      setLogoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeLogo = () => {
    setLogoFile(null)
    setPreview(null)
  }

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3000)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    try {
      // Send base64 preview or null (if removed) to API
      // Let the API handle the upload with a service role to bypass RLS limits
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_name: name,
          brand_logo: preview // This contains data:image/... if new file, or existing url, or null
        })
      })

      if (!res.ok) throw new Error('Gagal menyimpan pengaturan')
      
      await refreshBrand()
      showToast('success', 'Pengaturan berhasil disimpan')
      setLogoFile(null) // reset file input state
      
    } catch (error: any) {
      showToast('error', error.message || 'Terjadi kesalahan')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="animate-fade-in space-y-6 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 text-xs font-bold text-suka-orange uppercase tracking-wider mb-1">
          <span>Sistem</span>
          <span>&bull;</span>
          <span>Identitas Brand</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Pengaturan Brand</h1>
        <p className="text-gray-500 mt-1 text-sm sm:text-base font-medium">Ubah nama dan logo yang akan tampil di seluruh aplikasi (POS Kasir, Super Apps, Form Order, dan Dashboard).</p>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-gray-100 shadow-card p-6 sm:p-8 space-y-8">
        
        {/* Brand Name */}
        <div className="space-y-3">
          <label className="block text-sm font-bold text-gray-900">Nama Brand Utama</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-gray-50 border-2 border-transparent focus:border-amber-400 focus:bg-white rounded-xl px-4 py-3 outline-none transition-colors font-semibold text-gray-900"
            placeholder="Misal: SHAWARMA"
          />
          <p className="text-xs text-gray-500 font-medium">Nama ini akan muncul di header aplikasi dan struk cetak.</p>
        </div>

        {/* Brand Logo */}
        <div className="space-y-3">
          <label className="block text-sm font-bold text-gray-900">Logo Brand (Opsional)</label>
          
          <div className="flex items-start gap-6">
            {/* Preview Box - Flexible aspect ratio */}
            <div className="relative min-w-[120px] max-w-[280px] h-28 sm:h-32 px-4 py-3 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50/80 shrink-0 group transition-all">
              {preview ? (
                <>
                  <img
                    src={preview}
                    alt="Logo Preview"
                    className="max-w-full max-h-full w-auto h-auto object-contain transition-transform group-hover:scale-105"
                  />
                  <button
                    type="button"
                    onClick={removeLogo}
                    title="Hapus Logo"
                    className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-1 rounded-full shadow-md transition-all hover:scale-110"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-gray-300 gap-1.5 p-2">
                  <ImageIcon className="w-8 h-8" />
                  <span className="text-[11px] font-medium text-gray-400">Belum ada logo</span>
                </div>
              )}
            </div>

            {/* Upload Button */}
            <div className="flex-1 space-y-2.5">
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center justify-center px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl cursor-pointer transition-colors text-sm shadow-sm">
                  <span>Pilih Gambar</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
                {preview && (
                  <button
                    type="button"
                    onClick={removeLogo}
                    className="px-3 py-2 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors"
                  >
                    Hapus Logo
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 font-medium leading-relaxed">
                Format: JPG, PNG, WEBP (Maksimal 2MB).<br/>
                <span className="text-emerald-700 font-semibold">Rasio Bebas & Fleksibel:</span> Bisa persegi (1:1), horizontal / memanjang (landscape), maupun vertikal.<br/>
                Disarankan menggunakan logo dengan latar belakang transparan (PNG).
              </p>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto px-8 py-3.5 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span>Simpan Pengaturan</span>
              </>
            )}
          </button>
        </div>

      </form>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[999] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg font-semibold text-sm animate-fade-up ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {toast.message}
        </div>
      )}
    </div>
  )
}
