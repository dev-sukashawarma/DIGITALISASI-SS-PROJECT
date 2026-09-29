'use client'

/*
 * Pemantauan ceklist harian Area Manager untuk HR — disalin dari
 * apps/manager/src/app/ceklist-harian/CeklistPantauClient.tsx supaya tampilannya
 * sama. Versi HR BACA-SAJA: menyetujui tetap wewenang regional manager.
 *
 * Push notifikasi HR membuka `/ceklist-harian?tanggal=YYYY-MM-DD&outlet=<id>`
 * dan langsung menampilkan laporan outlet tersebut.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Store } from 'lucide-react'
import { useRole } from '@/components/layout/RoleContext'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  BAGIAN_BEBAS, FILTER_CEKLIST, KATEGORI_CEKLIST,
  formatTanggal, geserTanggal, hariIni, jamJakarta, keteranganTampil, nilaiKategori, nilaiKeseluruhan,
  perluPerhatian, sudahDitinjau, teksBagian,
  type FilterCeklist, type Laporan, type OutletPilihan,
} from '@/lib/ceklistHarian'
import { GalatMuat, LencanaNilai, Lightbox, Thumbnail, useCeklistHari, useDb, useUrlFoto } from './komponen'

const TANGGAL_SAH = /^\d{4}-\d{2}-\d{2}$/

export default function CeklistPantauView({ tanggalAwal, outletAwal }: { tanggalAwal?: string; outletAwal?: string }) {
  const db = useDb()
  const router = useRouter()
  const { role } = useRole()
  const [tanggal, setTanggal] = useState(() =>
    tanggalAwal && TANGGAL_SAH.test(tanggalAwal) && tanggalAwal <= hariIni() ? tanggalAwal : hariIni()
  )
  const [filter, setFilter] = useState<FilterCeklist>('semua')
  const [dibuka, setDibuka] = useState<string | null>(outletAwal ?? null)
  // staffId hanya dipakai untuk membatasi outlet binaan area manager; HR melihat semua outlet.
  const { data, memuat, galat, ulang } = useCeklistHari(db, '', role.toLowerCase(), tanggal)
  const { outlets, laporan } = data

  // Buang query string setelah deep link dipakai, supaya muat ulang tidak membuka ulang detail.
  useEffect(() => {
    if (tanggalAwal || outletAwal) router.replace('/ceklist-harian', { scroll: false })
  }, [tanggalAwal, outletAwal, router])

  const laporanList = Object.values(laporan)
  const jumlah = {
    dicek: laporanList.length,
    perhatian: laporanList.filter(perluPerhatian).length,
    belumDitinjau: laporanList.filter((l) => !sudahDitinjau(l)).length,
    belumDicek: outlets.filter((o) => !laporan[o.id]).length,
  }

  /** Yang butuh perhatian paling atas: bermasalah & belum ditinjau, lalu belum ditinjau, lalu sudah, lalu belum dicek. */
  const terlihat = useMemo(() => {
    const peringkat = (o: OutletPilihan) => {
      const l = laporan[o.id]
      if (!l) return 3
      if (!sudahDitinjau(l) && perluPerhatian(l)) return 0
      if (!sudahDitinjau(l)) return 1
      return 2
    }
    return outlets
      .filter((o) => {
        const l = laporan[o.id]
        if (filter === 'perhatian') return Boolean(l && perluPerhatian(l))
        if (filter === 'belum_dicek') return !l
        if (filter === 'belum_ditinjau') return Boolean(l && !sudahDitinjau(l))
        return true
      })
      .sort((a, b) => peringkat(a) - peringkat(b) || a.nama.localeCompare(b.nama))
  }, [outlets, laporan, filter])

  const laporanDibuka = dibuka ? laporan[dibuka] : undefined
  if (dibuka && laporanDibuka) {
    return (
      <DetailLaporan
        key={dibuka}
        laporan={laporanDibuka}
        namaOutlet={outlets.find((o) => o.id === dibuka)?.nama ?? 'Outlet'}
        onTutup={() => setDibuka(null)}
      />
    )
  }

  const geser = (hari: number) => {
    const baru = geserTanggal(tanggal, hari)
    if (baru > hariIni()) return
    setDibuka(null)
    setTanggal(baru)
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <PageHeader title="Ceklist Harian AM" description="Pantau hasil ceklist harian Area Manager di setiap outlet. Persetujuan dilakukan oleh Regional Manager." />
      <div className="rounded-2xl bg-white border border-suka-brown/10 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => geser(-1)} aria-label="Hari sebelumnya"
            className="w-9 h-9 rounded-full border border-suka-brown/15 flex items-center justify-center hover:bg-suka-gray-50 cursor-pointer">
            <ChevronLeft className="w-4 h-4 text-suka-brown" />
          </button>
          <div className="text-center">
            <p className="text-sm font-black text-suka-brown">{formatTanggal(tanggal)}</p>
            {tanggal === hariIni() && <p className="text-[11px] font-bold text-suka-orange">Hari ini</p>}
          </div>
          <button type="button" onClick={() => geser(1)} disabled={tanggal >= hariIni()} aria-label="Hari berikutnya"
            className="w-9 h-9 rounded-full border border-suka-brown/15 flex items-center justify-center hover:bg-suka-gray-50 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed">
            <ChevronRight className="w-4 h-4 text-suka-brown" />
          </button>
        </div>
        <div className="flex items-end gap-1 mt-4">
          <span className="text-4xl font-black text-suka-brown leading-none">{jumlah.dicek}</span>
          <span className="text-sm font-bold text-suka-gray-500 pb-1">/ {outlets.length} outlet sudah dicek</span>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4">
          <Stat label="Perlu tindakan" nilai={jumlah.perhatian} nada="amber" />
          <Stat label="Belum disetujui RM" nilai={jumlah.belumDitinjau} nada="orange" />
          <Stat label="Belum dicek" nilai={jumlah.belumDicek} nada="red" />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTER_CEKLIST.map((f) => (
          <button key={f.kunci} type="button" onClick={() => setFilter(f.kunci)}
            className={`px-3 py-1.5 rounded-full text-xs font-black whitespace-nowrap border cursor-pointer ${filter === f.kunci ? 'bg-suka-orange text-white border-suka-orange' : 'bg-white text-suka-brown/70 border-suka-brown/15'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {memuat && !outlets.length ? (
        <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-suka-orange" /></div>
      ) : galat && !outlets.length ? (
        <GalatMuat pesan={galat} onUlang={ulang} />
      ) : !terlihat.length ? (
        <div className="rounded-2xl border border-dashed border-suka-brown/20 p-10 text-center text-sm font-bold text-suka-gray-500">Tidak ada outlet pada filter ini.</div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {terlihat.map((o) => {
            const l = laporan[o.id]
            if (!l) {
              return (
                <div key={o.id} className="rounded-2xl bg-white/60 border border-dashed border-suka-brown/15 p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-suka-gray-100 text-suka-gray-400 flex items-center justify-center shrink-0"><Store className="w-5 h-5" /></div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-suka-brown/70 truncate">{o.nama}</p>
                    <p className="text-[11px] font-semibold text-red-500">Belum dicek AM</p>
                  </div>
                </div>
              )
            }
            return (
              <button key={o.id} type="button" onClick={() => setDibuka(o.id)}
                className="text-left rounded-2xl bg-white border border-suka-brown/10 p-4 flex items-center gap-3 hover:border-suka-orange/40 hover:shadow-sm transition cursor-pointer">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-black text-suka-brown truncate">{o.nama}</p>
                    {sudahDitinjau(l) && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                  </div>
                  <p className="text-[11px] font-semibold text-suka-gray-500 truncate">
                    {l.namaAm} · {jamJakarta(l.diperbaruiPada)}{l.temuan.length ? ` · ${l.temuan.length} temuan` : ''}
                  </p>
                  <p className={`text-[11px] font-bold mt-0.5 ${sudahDitinjau(l) ? 'text-emerald-600' : 'text-suka-orange'}`}>
                    {sudahDitinjau(l) ? `Disetujui ${l.namaPeninjau ?? ''}` : 'Menunggu persetujuan RM'}
                  </p>
                </div>
                <LencanaNilai nilai={nilaiKeseluruhan(l)} kecil />
                <ChevronRight className="w-4 h-4 text-suka-gray-300 shrink-0" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Stat({ label, nilai, nada }: { label: string; nilai: number; nada: 'amber' | 'orange' | 'red' }) {
  const warna = nilai === 0 ? 'text-suka-gray-300' : nada === 'amber' ? 'text-amber-600' : nada === 'red' ? 'text-red-600' : 'text-suka-orange'
  return (
    <div className="rounded-xl bg-suka-cream/50 border border-suka-brown/5 p-2.5 text-center">
      <p className={`text-xl font-black ${warna}`}>{nilai}</p>
      <p className="text-[10px] font-bold text-suka-gray-500">{label}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------

function DetailLaporan({ laporan: l, namaOutlet, onTutup }: { laporan: Laporan; namaOutlet: string; onTutup: () => void }) {
  const db = useDb()
  const [lightbox, setLightbox] = useState<string | null>(null)
  const paths = useMemo(() => Object.values(l.foto).flat().map((f) => f.path), [l.foto])
  const url = useUrlFoto(db, paths)

  const fotoBaris = (kunci: string) => {
    const daftar = l.foto[kunci] ?? []
    if (!daftar.length) return null
    return (
      <div className="flex gap-2 overflow-x-auto pb-1">
        {daftar.map((f) => <Thumbnail key={f.path} src={url[f.path]} onClick={() => url[f.path] && setLightbox(url[f.path])} />)}
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onTutup} aria-label="Kembali"
          className="w-9 h-9 rounded-full bg-white border border-suka-brown/15 flex items-center justify-center cursor-pointer hover:bg-suka-gray-50">
          <ArrowLeft className="w-4 h-4 text-suka-brown" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-base font-black text-suka-brown truncate">{namaOutlet}</p>
          <p className="text-[11px] font-semibold text-suka-gray-500">
            {l.namaAm} · {formatTanggal(l.tanggal)} · dikirim {jamJakarta(l.dibuatPada)}{l.diperbaruiPada !== l.dibuatPada ? `, diperbarui ${jamJakarta(l.diperbaruiPada)}` : ''}
          </p>
        </div>
        <LencanaNilai nilai={nilaiKeseluruhan(l)} />
      </div>

      {KATEGORI_CEKLIST.map((kat) => (
        <section key={kat.kunci} className="rounded-2xl bg-white border border-suka-brown/10 p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-suka-brown">{kat.label}</h3>
            <LencanaNilai nilai={nilaiKategori(kat, l.isian)} kecil />
          </div>
          {kat.butir.map((b) => (
            <div key={b.kunci} className="flex items-start gap-2 text-sm">
              {kat.punyaSubItem && <span className="w-16 shrink-0 font-bold text-suka-brown/80">{b.label}</span>}
              <span className="text-suka-brown/90 flex-1">{keteranganTampil(l.isian[b.kunci]) || '—'}</span>
              {kat.punyaSubItem && <LencanaNilai nilai={l.isian[b.kunci]?.nilai ?? null} kecil />}
            </div>
          ))}
          {fotoBaris(kat.kunci)}
        </section>
      ))}

      {BAGIAN_BEBAS.map((bag) => {
        const teks = teksBagian(l, bag.kunci)
        if (!teks.length && !(l.foto[bag.kunci]?.length)) return null
        return (
          <section key={bag.kunci} className="rounded-2xl bg-white border border-suka-brown/10 p-4 shadow-sm space-y-2">
            <h3 className="text-sm font-black text-suka-brown">{bag.label}</h3>
            <ul className="space-y-1">
              {teks.map((t, i) => <li key={i} className="text-sm text-suka-brown/90 flex gap-2"><span>•</span><span>{t}</span></li>)}
            </ul>
            {fotoBaris(bag.kunci)}
          </section>
        )
      })}

      {l.catatan && (
        <section className="rounded-2xl bg-white border border-suka-brown/10 p-4 shadow-sm">
          <h3 className="text-sm font-black text-suka-brown mb-1">Catatan</h3>
          <p className="text-sm text-suka-brown/90 whitespace-pre-line">{l.catatan}</p>
        </section>
      )}

      {sudahDitinjau(l) ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-black text-emerald-800 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Sudah disetujui</p>
          <p className="text-xs text-emerald-700 mt-0.5">{l.namaPeninjau} · {jamJakarta(l.ditinjauPada)}</p>
          {l.tanggapanRm && <p className="text-sm text-emerald-900 mt-2">💬 {l.tanggapanRm}</p>}
        </section>
      ) : (
        <section className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm font-bold text-orange-800">
          Menunggu persetujuan Regional Manager.
        </section>
      )}

      <Lightbox src={lightbox} onTutup={() => setLightbox(null)} />
    </div>
  )
}
