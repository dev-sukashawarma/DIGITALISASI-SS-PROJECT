'use client'

import { useState, useEffect } from 'react'
import {
  Loader2,
  Image as ImageIcon,
  Save,
  CheckCircle2,
  AlertCircle,
  Building2,
  ShoppingBag,
  Upload,
  Trash2,
  Monitor,
  Globe,
} from 'lucide-react'
import { useBrand } from '@/components/BrandContext'

const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5MB sebelum optimasi otomatis
const MAX_LOGO_DIMENSION = 1024

function optimizeLogoToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Gagal membaca file gambar'))
    reader.onload = () => {
      const rawDataUrl = reader.result as string
      const img = new window.Image()
      img.onload = () => {
        // Jika dimensi sudah kecil dan ukuran file <= 400KB, langsung pakai aslinya
        if (
          img.naturalWidth <= MAX_LOGO_DIMENSION &&
          img.naturalHeight <= MAX_LOGO_DIMENSION &&
          file.size <= 400 * 1024
        ) {
          resolve(rawDataUrl)
          return
        }

        const scale = Math.min(
          1,
          MAX_LOGO_DIMENSION / img.naturalWidth,
          MAX_LOGO_DIMENSION / img.naturalHeight
        )
        const width = Math.max(1, Math.round(img.naturalWidth * scale))
        const height = Math.max(1, Math.round(img.naturalHeight * scale))

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(rawDataUrl)
          return
        }
        ctx.clearRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)

        // Gunakan WebP (tetap menjaga transparansi alpha channel & ringan di HP)
        const webpUrl = canvas.toDataURL('image/webp', 0.9)
        if (webpUrl && webpUrl.startsWith('data:image/webp')) {
          resolve(webpUrl)
        } else {
          resolve(canvas.toDataURL('image/png'))
        }
      }
      img.onerror = () => reject(new Error('Format gambar tidak valid'))
      img.src = rawDataUrl
    }
    reader.readAsDataURL(file)
  })
}

interface LogoCardProps {
  title: string
  subtitle: string
  badgeText: string
  targets: string[]
  icon: React.ReactNode
  targetIcon: React.ReactNode
  preview: string | null
  emptyHint: string
  onSelectFile: (file: File) => void
  onRemove: () => void
  disabled?: boolean
}

function LogoOptionCard({
  title,
  subtitle,
  badgeText,
  targets,
  icon,
  targetIcon,
  preview,
  emptyHint,
  onSelectFile,
  onRemove,
  disabled,
}: LogoCardProps) {
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onSelectFile(file)
    }
    e.target.value = ''
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col justify-between gap-5 shadow-sm">
      <div className="space-y-4">
        {/* Card Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
              {icon}
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 leading-snug">{title}</h2>
              <p className="text-xs text-gray-500 font-medium mt-0.5">{subtitle}</p>
            </div>
          </div>
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 text-[11px] font-bold shrink-0">
            {badgeText}
          </span>
        </div>

        {/* Target Applications Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {targets.map((target) => (
            <span
              key={target}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 text-[11px] font-semibold text-gray-600"
            >
              {targetIcon}
              <span>{target}</span>
            </span>
          ))}
        </div>

        {/* Preview Area */}
        <div className="relative w-full h-40 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center p-4 overflow-hidden">
          {preview ? (
            <img
              src={preview}
              alt={title}
              className="max-w-full max-h-full w-auto h-auto object-contain"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-center gap-2 px-4">
              <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-400">
                <ImageIcon className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-gray-500">{emptyHint}</p>
            </div>
          )}
        </div>
      </div>

      {/* Actions & Spec Info */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center gap-2.5">
          <label
            className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl transition-colors text-xs sm:text-sm ${
              disabled ? 'opacity-60 pointer-events-none' : 'cursor-pointer'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>{preview ? 'Ganti Gambar' : 'Pilih Gambar'}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileInput}
              disabled={disabled}
              className="hidden"
            />
          </label>

          {preview && (
            <button
              type="button"
              onClick={onRemove}
              disabled={disabled}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors cursor-pointer disabled:opacity-60"
              title="Hapus Logo"
            >
              <Trash2 className="w-4 h-4" />
              <span>Hapus</span>
            </button>
          )}
        </div>

        <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
          Format PNG, WEBP, atau JPG (maks. 5MB, otomatis dioptimalkan). Disarankan PNG/WEBP transparan dengan rasio persegi atau horizontal.
        </p>
      </div>
    </div>
  )
}

export default function AdminSettingsPage() {
  const {
    brandName: currentBrandName,
    brandLogo: currentInternalLogo,
    userBrandLogo: currentUserLogo,
    refreshBrand,
  } = useBrand()

  const [name, setName] = useState('')
  const [internalPreview, setInternalPreview] = useState<string | null>(null)
  const [userPreview, setUserPreview] = useState<string | null>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    setName(currentBrandName || 'SHAWARMA')
    setInternalPreview(currentInternalLogo || null)
    setUserPreview(currentUserLogo || null)
  }, [currentBrandName, currentInternalLogo, currentUserLogo])

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3500)
  }

  const handleSelectLogo = async (target: 'internal' | 'user', file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      showToast('error', 'Ukuran gambar maksimal 5MB')
      return
    }
    try {
      const optimizedDataUrl = await optimizeLogoToDataUrl(file)
      if (target === 'internal') {
        setInternalPreview(optimizedDataUrl)
      } else {
        setUserPreview(optimizedDataUrl)
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Gagal memproses gambar')
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_name: name.trim() || 'SHAWARMA',
          brand_logo: internalPreview,
          user_brand_logo: userPreview,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData?.error || 'Gagal menyimpan pengaturan')
      }

      await refreshBrand()
      showToast('success', 'Pengaturan brand & kedua logo berhasil disimpan')
    } catch (error: any) {
      showToast('error', error.message || 'Terjadi kesalahan saat menyimpan')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="animate-fade-in space-y-6 max-w-5xl">
      <div>
        <div className="flex items-center gap-2 text-xs font-bold text-suka-orange uppercase tracking-wider mb-1">
          <span>Sistem</span>
          <span>&bull;</span>
          <span>Identitas Brand</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          Pengaturan Brand & Logo
        </h1>
        <p className="text-gray-500 mt-1 text-sm sm:text-base font-medium">
          Atur identitas nama brand serta pisahkan logo untuk aplikasi operasional internal dan aplikasi pelanggan (seperti Form Order Online).
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Nama Brand Utama */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-3">
          <label htmlFor="brandNameInput" className="block text-sm font-bold text-gray-900">
            Nama Brand Utama
          </label>
          <input
            id="brandNameInput"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full max-w-xl bg-gray-50 border border-gray-200 focus:border-amber-500 focus:bg-white rounded-xl px-4 py-3 outline-none transition-colors font-semibold text-gray-900"
            placeholder="Misal: SUKA SHAWARMA"
          />
          <p className="text-xs text-gray-500 font-medium">
            Nama brand ini tampil pada header aplikasi, Form Order, serta struk cetak.
          </p>
        </div>

        {/* Dua Opsi Pengaturan Logo: Internal vs User */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LogoOptionCard
            title="Logo Aplikasi Internal"
            subtitle="Khusus sistem operasional tim & manajemen"
            badgeText="Internal"
            targets={['Admin Dashboard', 'Superapp Portal', 'POS Kasir', 'Struk Dapur']}
            icon={<Building2 className="w-5 h-5" />}
            targetIcon={<Monitor className="w-3 h-3 text-gray-400" />}
            preview={internalPreview}
            emptyHint="Belum ada logo internal (menggunakan logo bawaan sistem)"
            onSelectFile={(file) => handleSelectLogo('internal', file)}
            onRemove={() => setInternalPreview(null)}
            disabled={isSubmitting}
          />

          <LogoOptionCard
            title="Logo Aplikasi User"
            subtitle="Khusus halaman & perangkat yang dilihat pelanggan"
            badgeText="Pelanggan"
            targets={['Form Order Online', 'Layar Kiosk Outlet', 'Struk Pelanggan']}
            icon={<ShoppingBag className="w-5 h-5" />}
            targetIcon={<Globe className="w-3 h-3 text-gray-400" />}
            preview={userPreview}
            emptyHint="Belum ada logo user (menggunakan logo bawaan pelanggan)"
            onSelectFile={(file) => handleSelectLogo('user', file)}
            onRemove={() => setUserPreview(null)}
            disabled={isSubmitting}
          />
        </div>

        {/* Save Bar */}
        <div className="bg-white rounded-2xl border border-gray-200 px-6 py-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-xs text-gray-500 font-medium">
            Perubahan akan langsung tersinkronisasi ke aplikasi internal dan Form Order Online setelah disimpan.
          </p>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto px-7 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer shrink-0"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Simpan Pengaturan</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[999] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg font-semibold text-sm animate-fade-up ${
            toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  )
}
