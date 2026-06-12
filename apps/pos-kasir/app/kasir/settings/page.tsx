'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { UploadCloud, Loader2, CheckCircle2, AlertCircle, ImagePlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useMyOutlet } from '@/lib/useMyOutlet'

const BUCKET = 'kiosk-assets'
const COVER_KEY = 'cover_image_url'

export default function KasirSettingsPage() {
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const { outletId, loaded } = useMyOutlet()

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
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tampilan Layar Kiosk</h1>
        <p className="text-gray-500 text-sm mt-1">Kelola gambar yang tampil saat kiosk sedang istirahat (attract screen)</p>
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
