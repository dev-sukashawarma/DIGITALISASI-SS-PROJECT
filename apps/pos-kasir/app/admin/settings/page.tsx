'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Image as ImageIcon, Save, CheckCircle2, AlertCircle, X } from 'lucide-react'
import { useBrand } from '@/components/BrandContext'

export default function AdminSettingsPage() {
  const { brandName: currentBrandName, brandLogo: currentBrandLogo, refreshBrand } = useBrand()
  
  const [name, setName] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
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
      let finalLogoUrl = preview // keep existing or null

      // Upload file to supabase storage if there is a new file
      if (logoFile) {
        const supabase = createClient()
        const fileExt = logoFile.name.split('.').pop()
        const fileName = `brand-logo-${Date.now()}.${fileExt}`
        const { error: uploadError, data } = await supabase.storage
          .from('kiosk-assets')
          .upload(fileName, logoFile, { upsert: true })
          
        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('kiosk-assets')
          .getPublicUrl(fileName)
          
        finalLogoUrl = publicUrl
      } else if (!preview) {
        // user removed the logo
        finalLogoUrl = null
      }

      // Update API
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_name: name,
          brand_logo: finalLogoUrl
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
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Pengaturan Brand</h1>
        <p className="text-gray-500 mt-1 text-sm sm:text-base font-medium">Ubah nama dan logo yang akan tampil di seluruh aplikasi Kasir dan Kiosk.</p>
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
            {/* Preview Box */}
            <div className="relative w-24 h-24 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50 shrink-0 overflow-hidden group">
              {preview ? (
                <>
                  <img src={preview} alt="Logo Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={removeLogo}
                    className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-6 h-6 text-white" />
                  </button>
                </>
              ) : (
                <ImageIcon className="w-8 h-8 text-gray-300" />
              )}
            </div>

            {/* Upload Button */}
            <div className="flex-1 space-y-2">
              <label className="inline-flex items-center justify-center px-4 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl cursor-pointer hover:bg-gray-200 transition-colors text-sm">
                <span>Pilih Gambar</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-gray-500 font-medium leading-relaxed">
                Format: JPG, PNG, WEBP.<br/>
                Ukuran maksimal 2MB.<br/>
                Disarankan gambar berbentuk persegi (1:1).
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
