'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { X, Loader2, Smartphone } from 'lucide-react'
import { CurrencyInput, compressImageToWebP } from '@suka/design-system'
import { createClient } from '@/lib/supabase'
import { toggleTayangDiApp, simpanDetailMenuApp } from '../actions'
import { hargaAplikasiTampil, type MenuApp } from '@/lib/appRetail/tampilanMenu'

/**
 * Bucket yang sudah dipakai POS. Bucket baru berarti kebijakan akses baru untuk untung nol.
 * Id-nya bertanda hubung (`menu-images`), sesuai `20260612000500_create_menu_images_bucket.sql`
 * dan semua policy storage-nya. Ejaan bergaris bawah membuat setiap unggahan gagal
 * "Bucket not found".
 */
const BUCKET = 'menu-images'

export default function PanelEditMenuApp({ item, onTutup }: { item: MenuApp; onTutup: () => void }) {
  const hargaAwal = hargaAplikasiTampil(item.channel_prices)
  const [deskripsi, setDeskripsi] = useState(item.deskripsi_app ?? '')
  const [foto, setFoto] = useState(item.foto_app ?? '')
  const [harga, setHarga] = useState(hargaAwal === null ? '' : String(hargaAwal))
  const [tayang, setTayang] = useState(item.tampil_di_app)
  const [galat, setGalat] = useState('')
  const [mengunggah, setMengunggah] = useState(false)
  const [menyimpan, mulaiSimpan] = useTransition()

  async function unggahFoto(file: File) {
    setMengunggah(true)
    setGalat('')
    try {
      const supabase = createClient()
      const kecil = await compressImageToWebP(file, 800, 800, 0.8)
      const nama = `app-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.webp`
      const { error } = await supabase.storage.from(BUCKET).upload(nama, kecil, { contentType: 'image/webp' })
      if (error) { setGalat(`Unggah gagal: ${error.message}`); return }
      setFoto(supabase.storage.from(BUCKET).getPublicUrl(nama).data.publicUrl)
    } catch (e) {
      setGalat(e instanceof Error ? `Unggah gagal: ${e.message}` : 'Unggah foto gagal, coba lagi')
    } finally {
      setMengunggah(false)
    }
  }

  function simpan() {
    setGalat('')
    mulaiSimpan(async () => {
      try {
        await simpanDetailMenuApp({
          id: item.id,
          deskripsiApp: deskripsi.trim() || null,
          fotoApp: foto.trim() || null,
          hargaAplikasi: harga,
        })
        onTutup()
      } catch (e) {
        setGalat(e instanceof Error ? e.message : 'Gagal menyimpan')
      }
    })
  }

  function ubahTayang() {
    setGalat('')
    mulaiSimpan(async () => {
      try {
        await toggleTayangDiApp(item.id, tayang)
        setTayang((v) => !v)
      } catch (e) {
        setGalat(e instanceof Error ? e.message : 'Gagal mengubah status tayang')
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 sticky top-0 bg-white">
          <div className="min-w-0">
            <p className="font-bold text-slate-900 truncate">{item.name}</p>
            <p className="text-xs text-slate-500">Tampilan di SukaShawarma APP</p>
          </div>
          <button type="button" onClick={onTutup} className="p-2 rounded-lg hover:bg-slate-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div
            onClick={ubahTayang}
            className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer select-none ${
              tayang ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200 bg-slate-50/60'
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Smartphone className={`w-4 h-4 ${tayang ? 'text-amber-600' : 'text-slate-400'}`} />
              {tayang ? 'Tayang di aplikasi' : 'Tidak tayang di aplikasi'}
            </span>
            <div className={`w-11 h-6 rounded-full relative ${tayang ? 'bg-amber-500' : 'bg-slate-300'}`}>
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full ${tayang ? 'left-6' : 'left-1'}`} />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 -mt-2.5">
            Tombol ini langsung tersimpan begitu ditekan — tidak menunggu <strong>Simpan</strong> dan tidak
            dibatalkan oleh <strong>Batal</strong>. Harga, deskripsi, dan foto baru tersimpan saat menekan Simpan.
          </p>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Harga di aplikasi</label>
            <CurrencyInput
              value={harga}
              onChange={(v) => setHarga(v > 0 ? String(v) : '')}
              placeholder={String(item.price)}
              className="input w-full bg-white font-bold text-slate-900 text-sm py-2 border border-slate-200 rounded-xl"
            />
            <p className="text-[11px] text-slate-500">
              Kosongkan untuk memakai harga kasir ({item.price.toLocaleString('id-ID')}). Kosong berarti ikut harga
              kasir, <strong>bukan gratis</strong>.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Deskripsi di aplikasi</label>
            <textarea
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              rows={3}
              placeholder="Kosongkan untuk memakai deskripsi kasir"
              className="input w-full text-sm py-2 border border-slate-200 rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Foto di aplikasi</label>
            {foto && <Image src={foto} alt="" width={96} height={96} className="w-24 h-24 rounded-xl object-cover" unoptimized />}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) unggahFoto(f) }}
              className="block w-full text-xs"
            />
            {mengunggah && <p className="text-xs text-slate-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Mengunggah…</p>}
            {foto && (
              <button type="button" onClick={() => setFoto('')} className="text-xs text-red-600 underline cursor-pointer">
                Hapus foto aplikasi (kembali memakai foto kasir)
              </button>
            )}
          </div>

          {galat && <p className="text-sm text-red-600">{galat}</p>}
        </div>

        <div className="p-4 border-t border-slate-200 sticky bottom-0 bg-white flex gap-2">
          <button type="button" onClick={onTutup} className="flex-1 py-2 rounded-xl border border-slate-200 font-bold text-sm cursor-pointer">
            Batal
          </button>
          <button
            type="button"
            onClick={simpan}
            disabled={menyimpan || mengunggah}
            className="flex-1 py-2 rounded-xl bg-amber-500 text-white font-bold text-sm disabled:opacity-60 cursor-pointer"
          >
            {menyimpan ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}
