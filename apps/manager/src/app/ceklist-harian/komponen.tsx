'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ImageOff, Loader2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { muatHari, urlFotoBanyak, type DataHari, type Nilai, NILAI } from '@/lib/ceklist-harian'

const KOSONG: DataHari = { outlets: [], laporan: {} }

/** Satu klien browser per halaman — bukan per render. */
export function useDb(): SupabaseClient {
  return useMemo(() => createClient(), [])
}

/**
 * Outlet + laporan satu hari, dengan realtime pada header `ceklist_harian`
 * (item & foto selalu ditulis dalam transaksi yang sama). Event di-debounce
 * supaya satu kiriman AM tidak memicu beberapa muat ulang.
 */
export function useCeklistHari(db: SupabaseClient, staffId: string, role: string, tanggal: string) {
  // Data & galat disimpan bersama tanggalnya: isi hari lain tidak pernah tampil
  // sesaat setelah tanggal digeser, dan "memuat" cukup diturunkan dari situ.
  const [simpanan, setData] = useState<DataHari & { tanggal: string | null }>({ tanggal: null, outlets: [], laporan: {} })
  const [galatSimpan, setGalat] = useState<{ tanggal: string; pesan: string } | null>(null)
  const permintaan = useRef(0)

  // Tidak ada setState sinkron di sini (hanya setelah await), jadi aman dipanggil dari effect.
  const muat = useCallback(async () => {
    const nomor = ++permintaan.current
    try {
      const hasil = await muatHari(db, staffId, role, tanggal)
      // Tanggal bisa sudah digeser lagi selagi permintaan berjalan.
      if (nomor !== permintaan.current) return
      setData({ ...hasil, tanggal })
      setGalat(null)
    } catch (e) {
      console.error('muatHari gagal', e)
      // Muat ulang realtime yang gagal tidak menimpa data yang sudah tampil.
      if (nomor === permintaan.current) {
        setGalat({ tanggal, pesan: 'Gagal memuat ceklist harian. Periksa koneksi lalu coba lagi.' })
      }
    }
  }, [db, staffId, role, tanggal])

  useEffect(() => {
    // Semua setState di `muat` terjadi setelah await, bukan sinkron — aturan ini
    // tidak bisa melihat batas await di dalam fungsi yang dipanggil.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void muat()
  }, [muat])

  useEffect(() => {
    let timer: number | undefined
    const channel = db
      .channel(`ceklist-harian:${tanggal}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ceklist_harian', filter: `tanggal=eq.${tanggal}` }, () => {
        window.clearTimeout(timer)
        timer = window.setTimeout(() => void muat(), 400)
      })
      .subscribe()
    return () => { window.clearTimeout(timer); void db.removeChannel(channel) }
  }, [db, tanggal, muat])

  const siap = simpanan.tanggal === tanggal
  const data: DataHari = siap ? simpanan : KOSONG
  const galat = galatSimpan?.tanggal === tanggal ? galatSimpan.pesan : null
  const memuat = !siap && !galat
  /** Tombol "Coba lagi": galat lama disembunyikan selama memuat ulang. */
  const ulang = useCallback(() => { setGalat(null); void muat() }, [muat])
  return { data, memuat, galat, muat, ulang }
}

/**
 * Cache URL bertanda tangan per path. Path yang belum punya URL dikumpulkan lalu
 * diminta sekaligus (satu request `createSignedUrls`), bukan satu request per foto.
 */
export function useUrlFoto(db: SupabaseClient, paths: string[]) {
  const [url, setUrl] = useState<Record<string, string>>({})
  const diminta = useRef(new Set<string>())
  const kunci = paths.join('|')

  useEffect(() => {
    const baru = paths.filter((p) => !diminta.current.has(p))
    if (!baru.length) return
    baru.forEach((p) => diminta.current.add(p))
    urlFotoBanyak(db, baru)
      .then((hasil) => setUrl((u) => ({ ...u, ...hasil })))
      .catch((e) => {
        console.error('urlFoto gagal', e)
        baru.forEach((p) => diminta.current.delete(p))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, kunci])

  return url
}

export const WARNA_NILAI: Record<Nilai, string> = {
  baik: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  perhatian: 'bg-amber-50 text-amber-700 border-amber-200',
  buruk: 'bg-red-50 text-red-700 border-red-200',
}
export const WARNA_NILAI_AKTIF: Record<Nilai, string> = {
  baik: 'bg-emerald-600 text-white border-emerald-600',
  perhatian: 'bg-amber-500 text-white border-amber-500',
  buruk: 'bg-red-600 text-white border-red-600',
}

export function LencanaNilai({ nilai, kecil }: { nilai: Nilai | null; kecil?: boolean }) {
  if (!nilai) return <span className="text-[11px] font-bold text-suka-gray-400">Belum dinilai</span>
  const n = NILAI.find((x) => x.nilai === nilai)!
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-black ${kecil ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'} ${WARNA_NILAI[nilai]}`}>
      <span>{n.emoji}</span>{n.label}
    </span>
  )
}

export function Thumbnail({ src, onClick, onHapus }: { src?: string; onClick?: () => void; onHapus?: () => void }) {
  return (
    <div className="relative w-20 h-20 shrink-0 rounded-xl overflow-hidden border border-suka-brown/10 bg-suka-gray-50">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" onClick={onClick} className="w-full h-full object-cover cursor-zoom-in" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-suka-gray-300"><Loader2 className="w-4 h-4 animate-spin" /></div>
      )}
      {onHapus && (
        <button type="button" onClick={onHapus} aria-label="Hapus foto"
          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 cursor-pointer">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

export function Lightbox({ src, onTutup }: { src: string | null; onTutup: () => void }) {
  useEffect(() => {
    if (!src) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onTutup() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [src, onTutup])
  if (!src) return null
  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4" onClick={onTutup}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="max-h-full max-w-full rounded-xl object-contain" />
      <button type="button" onClick={onTutup} aria-label="Tutup" className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center cursor-pointer">
        <X className="w-5 h-5" />
      </button>
    </div>
  )
}

export function GalatMuat({ pesan, onUlang }: { pesan: string; onUlang: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
      <ImageOff className="w-6 h-6 text-red-400 mx-auto mb-2" />
      <p className="text-sm font-bold text-red-700">{pesan}</p>
      <button type="button" onClick={onUlang} className="mt-3 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-black cursor-pointer">Coba lagi</button>
    </div>
  )
}
