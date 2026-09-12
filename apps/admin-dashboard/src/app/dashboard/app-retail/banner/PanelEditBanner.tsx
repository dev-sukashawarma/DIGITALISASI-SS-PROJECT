'use client'

import { useState } from 'react'
import Image from 'next/image'
import { X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { simpanBanner } from '../actions'
import { periksaBanner, type InputBanner, type AksiBanner } from '@/lib/appRetail/bannerForm'

// Nama bucket hasil verifikasi Task 4 Langkah 1. JANGAN diketik dari ingatan.
const BUCKET = 'app-banners'

export default function PanelEditBanner(props: {
  awal: InputBanner
  id: string | null
  menuPilihan: { id: string; name: string }[]
  galatMenu: string | null
  onSelesai: () => void
}) {
  const [form, setForm] = useState<InputBanner>(props.awal)
  const [galat, setGalat] = useState<string | null>(null)
  const [sibuk, setSibuk] = useState(false)
  const [mengunggah, setMengunggah] = useState(false)

  // (1) Mengganti aksi WAJIB mengosongkan target. Tanpa ini, admin yang
  // sempat memilih menu lalu berpindah ke "buka Menu" akan ditolak
  // `periksaBanner` dengan pesan tentang kolom yang tak lagi terlihat.
  function ubahAksi(aksi: AksiBanner) {
    setForm((s) => ({ ...s, aksi, targetMenuItemId: aksi === 'menu_item' ? s.targetMenuItemId : null }))
  }

  // (2) Kegagalan unggah WAJIB terlihat. Di Tahap 1 blok ini tanpa catch,
  // jadi nama bucket yang salah membuat foto hilang tanpa satu pun pesan.
  async function unggah(file: File) {
    setGalat(null)
    setMengunggah(true)
    try {
      const supabase = createClient()
      const nama = `${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`
      const { error } = await supabase.storage.from(BUCKET).upload(nama, file)
      if (error) throw error
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(nama)
      setForm((s) => ({ ...s, gambarUrl: data.publicUrl }))
    } catch (e) {
      setGalat(`Gambar gagal diunggah: ${e instanceof Error ? e.message : 'sebab tidak diketahui'}`)
    } finally {
      setMengunggah(false)
    }
  }

  // (3) Validasi lokal dulu, lalu (4) galat server ditampilkan apa adanya --
  // pesan penolakan RLS dari `pastikanTerubah` harus sampai ke mata admin,
  // bukan ditelan dan diganti "Tersimpan".
  async function simpan() {
    const pesan = periksaBanner(form)
    if (pesan) { setGalat(pesan); return }
    setSibuk(true)
    try {
      await simpanBanner(props.id, form)
      props.onSelesai()
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal menyimpan banner.')
    } finally {
      setSibuk(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 sticky top-0 bg-white">
          <div className="min-w-0">
            <p className="font-bold text-slate-900 truncate">
              {props.id ? 'Ubah banner' : 'Banner baru'}
            </p>
            <p className="text-xs text-slate-500">
              {form.slot === 'carousel' ? 'Carousel Beranda' : 'Popup Beranda'}
            </p>
          </div>
          <button type="button" onClick={props.onSelesai} className="p-2 rounded-lg hover:bg-slate-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Judul</label>
            <input
              value={form.judul}
              onChange={(e) => setForm((s) => ({ ...s, judul: e.target.value }))}
              placeholder="Judul banner"
              className="input w-full text-sm py-2 border border-slate-200 rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Badge</label>
              <input
                value={form.badge}
                onChange={(e) => setForm((s) => ({ ...s, badge: e.target.value }))}
                placeholder="Contoh: Baru"
                className="input w-full text-sm py-2 border border-slate-200 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Urutan</label>
              <input
                type="number"
                value={form.urutan}
                onChange={(e) => setForm((s) => ({ ...s, urutan: Number(e.target.value) }))}
                className="input w-full text-sm py-2 border border-slate-200 rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Subjudul</label>
            <input
              value={form.subjudul}
              onChange={(e) => setForm((s) => ({ ...s, subjudul: e.target.value }))}
              placeholder="Kalimat pendek di bawah judul"
              className="input w-full text-sm py-2 border border-slate-200 rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Teks tombol</label>
            <input
              value={form.teksTombol}
              onChange={(e) => setForm((s) => ({ ...s, teksTombol: e.target.value }))}
              placeholder="Contoh: Lihat menu"
              className="input w-full text-sm py-2 border border-slate-200 rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Aksi saat banner ditekan</label>
            <select
              value={form.aksi}
              onChange={(e) => ubahAksi(e.target.value as AksiBanner)}
              className="input w-full text-sm py-2 border border-slate-200 rounded-xl bg-white"
            >
              <option value="tidak_ada">Tanpa aksi</option>
              <option value="menu">Buka menu</option>
              <option value="menu_item">Buka menu tertentu</option>
            </select>
          </div>

          {form.aksi === 'menu_item' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Menu tujuan</label>
              {props.galatMenu ? (
                // Beda dengan daftar menu yang memang kosong (belum ada menu
                // tampil di aplikasi): ini gagal MEMUAT -- admin harus tahu
                // dropdown kosong bukan berarti "tidak ada menu tersedia".
                <p className="text-xs text-red-600">
                  Gagal memuat daftar menu: {props.galatMenu}
                </p>
              ) : (
                <select
                  value={form.targetMenuItemId ?? ''}
                  onChange={(e) => setForm((s) => ({ ...s, targetMenuItemId: e.target.value || null }))}
                  className="input w-full text-sm py-2 border border-slate-200 rounded-xl bg-white"
                >
                  <option value="">Pilih menu…</option>
                  {props.menuPilihan.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Gambar</label>
            {form.gambarUrl && (
              <Image src={form.gambarUrl} alt="" width={200} height={100} className="w-full max-w-[200px] h-auto rounded-xl object-cover" unoptimized />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) unggah(f) }}
              className="block w-full text-xs"
            />
            {mengunggah && (
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Mengunggah…
              </p>
            )}
          </div>

          {galat && <p className="text-sm text-red-600">{galat}</p>}
        </div>

        <div className="p-4 border-t border-slate-200 sticky bottom-0 bg-white flex gap-2">
          <button type="button" onClick={props.onSelesai} className="flex-1 py-2 rounded-xl border border-slate-200 font-bold text-sm cursor-pointer">
            Batal
          </button>
          <button
            type="button"
            onClick={simpan}
            disabled={sibuk || mengunggah}
            className="flex-1 py-2 rounded-xl bg-amber-500 text-white font-bold text-sm disabled:opacity-60 cursor-pointer"
          >
            {sibuk ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}
