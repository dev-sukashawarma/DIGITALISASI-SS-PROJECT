'use client'

import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Store } from 'lucide-react'
import {
  BAGIAN_BEBAS, FILTER_CEKLIST, KATEGORI_CEKLIST, PESAN_VERSI_BERUBAH,
  formatTanggal, geserTanggal, hariIni, jamJakarta, keteranganTampil, meninjauCeklist, nilaiKategori, nilaiKeseluruhan,
  perluPerhatian, sudahDitinjau, teksBagian, tinjauCeklist,
  type FilterCeklist, type Laporan, type OutletPilihan,
} from '@/lib/ceklist-harian'
import { GalatMuat, LencanaNilai, Lightbox, Thumbnail, useCeklistHari, useDb, useUrlFoto } from './komponen'

type Props = { staffId: string; role: string }

/**
 * Pemantauan ceklist harian oleh regional manager — port `PantauCeklistScreen`.
 * Outlet yang belum dicek ikut tampil: bagi RM, outlet yang TIDAK dikunjungi sama
 * pentingnya dengan temuan di outlet yang dikunjungi.
 */
export default function CeklistPantauClient({ staffId, role }: Props) {
  const db = useDb()
  const [tanggal, setTanggal] = useState(hariIni)
  const [filter, setFilter] = useState<FilterCeklist>('semua')
  const [dibuka, setDibuka] = useState<string | null>(null)
  const { data, memuat, galat, muat, ulang } = useCeklistHari(db, staffId, role, tanggal)
  const { outlets, laporan } = data

  const laporanList = Object.values(laporan)
  const jumlah = {
    dicek: laporanList.length,
    perhatian: laporanList.filter(perluPerhatian).length,
    belumDitinjau: laporanList.filter((l) => !sudahDitinjau(l)).length,
    belumDicek: outlets.filter((o) => !laporan[o.id]).length,
  }

  /** Yang butuh tindakan paling atas: bermasalah & belum ditinjau, lalu belum ditinjau, lalu sudah, lalu belum dicek. */
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
        bolehMeninjau={meninjauCeklist(role)}
        onTutup={() => setDibuka(null)}
        onDisetujui={() => { setDibuka(null); void muat() }}
        onBasi={() => void muat()}
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
          <Stat label="Belum disetujui" nilai={jumlah.belumDitinjau} nada="orange" />
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
                    {sudahDitinjau(l) ? `Disetujui ${l.namaPeninjau ?? ''}` : 'Menunggu persetujuan'}
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

function DetailLaporan({ laporan: l, namaOutlet, bolehMeninjau, onTutup, onDisetujui, onBasi }: {
  laporan: Laporan; namaOutlet: string; bolehMeninjau: boolean
  onTutup: () => void; onDisetujui: () => void; onBasi: () => void
}) {
  const db = useDb()
  const [tanggapan, setTanggapan] = useState(l.tanggapanRm ?? '')
  const [meninjau, setMeninjau] = useState(false)
  const meninjauRef = useRef(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  // Versi yang sudah dilihat RM. Realtime bisa mengganti isi laporan selagi detail
  // terbuka; tanpa ini token versi ikut berganti diam-diam dan persetujuan jatuh
  // ke isi yang belum sempat diperhatikan.
  const versi = `${l.diperbaruiPada}|${l.ditinjauPada ?? ''}`
  const [versiDilihat, setVersiDilihat] = useState(versi)
  const berubah = versiDilihat !== versi
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

  const setujui = async () => {
    if (meninjauRef.current || berubah) return
    meninjauRef.current = true
    setMeninjau(true)
    try {
      await tinjauCeklist(db, l, tanggapan)
      toast.success('Laporan disetujui. AM sudah diberi tahu.')
      onDisetujui()
    } catch (e) {
      console.error('tinjau gagal', e)
      const pesan = (e as { message?: string })?.message ?? ''
      if (pesan.includes(PESAN_VERSI_BERUBAH)) {
        // AM mengirim ulang atau peninjau lain baru saja menanggapi: tampilkan
        // versi terbaru dulu, jangan setujui isi yang belum dilihat.
        toast.error('Laporan ini baru saja diperbarui. Periksa lagi isinya sebelum menyetujui.')
        onBasi()
      } else {
        toast.error('Gagal menyetujui laporan. Coba lagi.')
      }
      meninjauRef.current = false
      setMeninjau(false)
    }
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
            {l.namaAm} · dikirim {jamJakarta(l.dibuatPada)}{l.diperbaruiPada !== l.dibuatPada ? `, diperbarui ${jamJakarta(l.diperbaruiPada)}` : ''}
          </p>
        </div>
        <LencanaNilai nilai={nilaiKeseluruhan(l)} />
      </div>

      {berubah && (
        <div className="sticky top-0 z-10 rounded-2xl border border-amber-300 bg-amber-50 p-3 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="flex-1 text-xs font-bold text-amber-800">
            Laporan ini baru saja diperbarui{l.ditinjauPada ? ' atau ditanggapi peninjau lain' : ' oleh AM'}. Periksa lagi isinya sebelum menyetujui.
          </p>
          <button type="button" onClick={() => setVersiDilihat(versi)} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-black cursor-pointer">
            Sudah saya periksa
          </button>
        </div>
      )}

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

      {sudahDitinjau(l) && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-black text-emerald-800 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Sudah disetujui</p>
          <p className="text-xs text-emerald-700 mt-0.5">{l.namaPeninjau} · {jamJakarta(l.ditinjauPada)}</p>
          {l.tanggapanRm && <p className="text-sm text-emerald-900 mt-2">💬 {l.tanggapanRm}</p>}
        </section>
      )}

      {bolehMeninjau && (
        <section className="rounded-2xl bg-white border border-suka-brown/10 p-4 shadow-sm space-y-2">
          <h3 className="text-sm font-black text-suka-brown">{sudahDitinjau(l) ? 'Perbarui tanggapan' : 'Setujui laporan'}</h3>
          <p className="text-xs text-suka-gray-500">AM langsung mendapat notifikasi beserta tanggapan Anda.</p>
          <textarea value={tanggapan} onChange={(e) => setTanggapan(e.target.value)} rows={3} placeholder="Tanggapan untuk AM (opsional)"
            className="w-full rounded-xl border border-suka-brown/15 px-3 py-2 text-sm text-suka-brown focus:outline-none focus:border-suka-orange" />
          <button type="button" onClick={setujui} disabled={meninjau || berubah}
            className="w-full py-3 rounded-xl bg-emerald-600 text-white text-sm font-black flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
            {meninjau ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {sudahDitinjau(l) ? 'Simpan tanggapan' : 'Setujui'}
          </button>
        </section>
      )}

      <Lightbox src={lightbox} onTutup={() => setLightbox(null)} />
    </div>
  )
}
