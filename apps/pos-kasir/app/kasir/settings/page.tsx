'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { UploadCloud, Loader2, CheckCircle2, AlertCircle, ImagePlus, Printer } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useMyOutlet } from '@/lib/useMyOutlet'
import OfflineGuardOverlay from '@/components/OfflineGuardOverlay'

const BUCKET = 'kiosk-assets'
const COVER_KEY = 'cover_image_url'

export default function KasirSettingsPage() {
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const { outletId, loaded } = useMyOutlet()

  const [btFilter, setBtFilter] = useState('')
  const [savedBtFilterMsg, setSavedBtFilterMsg] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const val = localStorage.getItem('bluetooth_name_filter') || ''
      setBtFilter(val)
    }
  }, [])

  const handleSaveBtFilter = (val: string) => {
    setBtFilter(val)
    if (typeof window !== 'undefined') {
      if (val.trim()) {
        localStorage.setItem('bluetooth_name_filter', val.trim())
      } else {
        localStorage.removeItem('bluetooth_name_filter')
      }
    }
    setSavedBtFilterMsg(true)
    setTimeout(() => setSavedBtFilterMsg(false), 2500)
  }

  useEffect(() => {
    async function load() {
      if (!loaded || !outletId) return

      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('kiosk_settings')
          .select('key, value')
          .eq('outlet_id', outletId)
          .in('key', [COVER_KEY])
        
        if (error) throw error
        
        const coverObj = data?.find(d => d.key === COVER_KEY)
        if (coverObj) setCoverUrl(coverObj.value)
      } catch (err: unknown) {
        console.warn('Gagal memuat pengaturan:', err)
        setCoverUrl(null)
      }
    }
    load()
  }, [outletId, loaded])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !outletId) return

    setUploading(true)
    setError(null)
    setSuccess(false)

    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (!ext || !['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
        setError('Format file tidak didukung. Gunakan JPG, PNG, atau WebP.')
        setUploading(false)
        return
      }
      const path = `cover_${outletId}_${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(path)

      if (!publicUrl) {
        throw new Error('Gagal mendapatkan URL publik dari storage')
      }

      const { error: dbError } = await supabase
        .from('kiosk_settings')
        .upsert({ outlet_id: outletId, key: COVER_KEY, value: publicUrl }, { onConflict: 'outlet_id, key' })

      if (dbError) throw dbError

      setCoverUrl(publicUrl)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload gagal')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  if (!loaded) return <div className="p-6"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>
  if (!outletId) return <div className="p-6 text-red-500 font-bold">Outlet tidak ditemukan</div>

  return (
    <div className="max-w-xl space-y-6 relative min-h-[60vh] pb-20">
      <OfflineGuardOverlay message="Upload & pengaturan gambar kiosk butuh internet. Sambungkan ke internet untuk mengubah tampilan layar." />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pengaturan Device & Tampilan</h1>
        <p className="text-gray-500 text-sm mt-1">Kelola filter Bluetooth printer kasir dan gambar cover kiosk cabang ini</p>
      </div>

      {/* Pengaturan Filter Bluetooth Printer */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Printer className="w-5 h-5 text-amber-600" />
          <h2 className="font-semibold text-gray-700">Filter Bluetooth Printer (Pajajaran / Outlet)</h2>
        </div>
        <p className="text-xs text-gray-500">
          Atur prefiks nama printer (misal: <code className="bg-gray-100 px-1 py-0.5 rounded font-mono text-amber-700">PT</code>, <code className="bg-gray-100 px-1 py-0.5 rounded font-mono text-amber-700">POS</code>, <code className="bg-gray-100 px-1 py-0.5 rounded font-mono text-amber-700">PANDA</code>, <code className="bg-gray-100 px-1 py-0.5 rounded font-mono text-amber-700">RPP</code>) untuk menyaring pencarian perangkat Bluetooth agar HP/TWS/TV di sekitar tidak muncul.
        </p>

        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-600 uppercase">Prefiks Nama Printer</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={btFilter}
              onChange={(e) => setBtFilter(e.target.value)}
              placeholder="Contoh: PT, PANDA, POS-58"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
            <button
              onClick={() => handleSaveBtFilter(btFilter)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl transition-colors shadow-sm"
            >
              Simpan
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 pt-1 items-center">
          <span className="text-xs text-gray-400 font-medium">Preset Cepat:</span>
          {['PT', 'PANDA', 'POS', 'RPP', 'EP'].map((preset) => (
            <button
              key={preset}
              onClick={() => handleSaveBtFilter(preset)}
              className={`text-xs px-2.5 py-1 rounded-lg font-bold border transition-colors ${
                btFilter.toUpperCase() === preset 
                  ? 'bg-amber-100 text-amber-800 border-amber-300' 
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
              }`}
            >
              {preset}
            </button>
          ))}
          <button
            onClick={() => handleSaveBtFilter('')}
            className="text-xs px-2.5 py-1 rounded-lg font-bold border bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200"
          >
            Reset (Semua Printer Thermal)
          </button>
        </div>

        {savedBtFilterMsg && (
          <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Filter Bluetooth berhasil disimpan!
          </div>
        )}

        <hr className="my-2 border-gray-100" />

        {/* Mode Cetak Logo Struk Thermal */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-600">Mode Cetak Header / Logo Struk</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                localStorage.setItem('disable_raster_logo', 'true');
                setSavedBtFilterMsg(true);
                setTimeout(() => setSavedBtFilterMsg(false), 3000);
              }}
              className="px-3 py-2 text-xs font-medium rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 transition text-left"
            >
              <span className="font-bold block">⚡ Logo Teks Murni (Rekomendasi)</span>
              <span>Cetak kilat 0.1s & anti-karakter aneh/garbled.</span>
            </button>
            <button
              onClick={() => {
                localStorage.removeItem('disable_raster_logo');
                setSavedBtFilterMsg(true);
                setTimeout(() => setSavedBtFilterMsg(false), 3000);
              }}
              className="px-3 py-2 text-xs font-medium rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 transition text-left"
            >
              <span className="font-bold block">🖼️ Logo Gambar Bitmap</span>
              <span>Model logo grafik raster (butuh printer buffer tinggi).</span>
            </button>
          </div>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-gray-700">Gambar Cover Cabang Ini</h2>

        {/* Preview */}
        <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-gray-100 border border-gray-200">
          {coverUrl ? (
            <Image
              src={coverUrl}
              alt="Cover saat ini"
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
              <ImagePlus className="w-8 h-8" />
              <p className="text-sm">Belum ada gambar cover</p>
            </div>
          )}
        </div>

        {/* Upload */}
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="btn-primary w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Mengupload...
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4" />
                Upload Gambar Cover
              </>
            )}
          </button>
        </div>

        {success && (
          <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Gambar berhasil diupload!
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-500 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <p className="text-xs text-gray-400">
          Format yang didukung: JPG, PNG, WebP. Gambar akan ditampilkan fullscreen di kiosk cabang ini.
          Rekomendasi rasio 16:9.
        </p>
      </div>

    </div>
  )
}
