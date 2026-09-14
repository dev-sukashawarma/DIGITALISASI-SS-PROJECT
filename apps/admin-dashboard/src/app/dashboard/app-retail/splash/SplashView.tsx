'use client'

import { useState } from 'react'
import Image from 'next/image'
import { AlertTriangle, Loader2, Smartphone } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { simpanSplash } from '../actions'
import { kompresGambarBanner } from '@/lib/appRetail/kompresGambar'
import {
  PILIHAN_DURASI_MS,
  periksaSplash,
  type InputSplash,
} from '@/lib/appRetail/splashForm'

// Bucket yang sama dengan banner: baca publik, tulis role admin persis.
const BUCKET = 'app-banners'

function kb(byte: number): string {
  return byte >= 1024 * 1024
    ? `${(byte / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(byte / 1024))} KB`
}

export default function SplashView(props: {
  awal: InputSplash
  diubahPada: string | null
  galat: string | null
}) {
  const [form, setForm] = useState<InputSplash>(props.awal)
  const [tersimpan, setTersimpan] = useState<InputSplash>(props.awal)
  const [galat, setGalat] = useState<string | null>(null)
  const [pesan, setPesan] = useState<string | null>(null)
  const [mengunggah, setMengunggah] = useState(false)
  const [sibuk, setSibuk] = useState(false)

  const berubah = form.gambarUrl !== tersimpan.gambarUrl || form.durasiMs !== tersimpan.durasiMs

  async function unggah(file: File) {
    setGalat(null)
    setPesan(null)
    setMengunggah(true)
    try {
      const berkas = await kompresGambarBanner(file)
      const supabase = createClient()
      const nama = `splash/${Date.now()}-${berkas.name.replace(/[^\w.-]/g, '_')}`
      const { error } = await supabase.storage.from(BUCKET).upload(nama, berkas)
      if (error) throw error
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(nama)
      setForm((s) => ({ ...s, gambarUrl: data.publicUrl }))
      setPesan(
        berkas.size < file.size
          ? `Gambar dikecilkan ${kb(file.size)} → ${kb(berkas.size)}. Belum tersimpan — tekan Simpan.`
          : `Gambar diunggah (${kb(file.size)}). Belum tersimpan — tekan Simpan.`,
      )
    } catch (e) {
      setGalat(`Gambar gagal diunggah: ${e instanceof Error ? e.message : 'sebab tidak diketahui'}`)
    } finally {
      setMengunggah(false)
    }
  }

  async function simpan() {
    const p = periksaSplash(form)
    if (p) { setGalat(p); return }
    setGalat(null)
    setPesan(null)
    setSibuk(true)
    try {
      await simpanSplash(form)
      setTersimpan(form)
      setPesan('Tersimpan. Pelanggan melihat splash baru mulai pembukaan aplikasi BERIKUTNYA.')
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal menyimpan splash.')
    } finally {
      setSibuk(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Splash Aplikasi</h1>
        <p className="text-sm text-slate-500">
          Gambar layar pembuka yang tampil setiap kali aplikasi pelanggan dibuka.
        </p>
      </div>

      {props.galat && (
        <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {props.galat}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        {/* Pratinjau berbentuk layar HP, rasio 9:16 */}
        <div className="mx-auto w-[240px]">
          <div className="relative aspect-[9/16] w-full overflow-hidden rounded-[28px] border-8 border-slate-900 bg-[#701604]">
            {form.gambarUrl ? (
              <Image src={form.gambarUrl} alt="Pratinjau splash" fill className="object-cover" unoptimized />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center text-amber-100 p-4">
                <Smartphone className="w-8 h-8" />
                <p className="text-xs">Gambar bawaan aplikasi</p>
              </div>
            )}
          </div>
          <p className="mt-2 text-center text-xs text-slate-500">
            Tampil {form.durasiMs / 1000} detik
          </p>
        </div>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Gambar</label>
            <input
              type="file"
              accept="image/*"
              disabled={mengunggah || sibuk}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) unggah(f) }}
              className="block w-full text-xs"
            />
            <p className="text-xs text-slate-500">
              Disarankan potret <b>1080×1920</b>. Letakkan logo & tulisan penting di tengah —
              tepi atas dan bawah bisa terpotong di HP yang layarnya lebih pendek.
            </p>
            {mengunggah && (
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Mengecilkan &amp; mengunggah…
              </p>
            )}
            {form.gambarUrl && (
              <button
                type="button"
                onClick={() => { setForm((s) => ({ ...s, gambarUrl: '' })); setPesan(null) }}
                className="text-xs font-bold text-red-600 hover:underline cursor-pointer"
              >
                Pakai gambar bawaan aplikasi
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Durasi tampil</label>
            <select
              value={form.durasiMs}
              onChange={(e) => setForm((s) => ({ ...s, durasiMs: Number(e.target.value) }))}
              className="w-full text-sm py-2 px-3 border border-slate-200 rounded-xl bg-white"
            >
              {PILIHAN_DURASI_MS.map((ms) => (
                <option key={ms} value={ms}>{ms / 1000} detik</option>
              ))}
            </select>
            <p className="text-xs text-slate-500">
              Ditampilkan setiap kali aplikasi dibuka. Makin lama, makin lama pelanggan menunggu.
            </p>
          </div>

          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
            Perubahan <b>tidak langsung</b> terlihat. Aplikasi mengunduh splash baru di balik layar,
            lalu memakainya pada pembukaan <b>berikutnya</b>.
          </div>

          {galat && <p className="text-sm text-red-600">{galat}</p>}
          {pesan && <p className="text-sm text-emerald-700">{pesan}</p>}

          <button
            type="button"
            onClick={simpan}
            disabled={!berubah || sibuk || mengunggah}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-500 text-white font-bold text-sm disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            {sibuk ? 'Menyimpan…' : 'Simpan'}
          </button>

          {props.diubahPada && (
            <p className="text-xs text-slate-400">
              Terakhir diubah {new Date(props.diubahPada).toLocaleString('id-ID')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
