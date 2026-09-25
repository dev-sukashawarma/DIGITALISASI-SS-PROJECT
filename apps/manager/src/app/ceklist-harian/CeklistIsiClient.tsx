'use client'

import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, Camera, CheckCircle2, ChevronRight, ClipboardList, ImagePlus, Loader2, Plus, Sparkles, Store, Trash2 } from 'lucide-react'
import {
  BAGIAN_BEBAS, FOTO_MAKS, KATEGORI_CEKLIST, NILAI, SEMUA_BUTIR,
  adaMasalah, formatTanggal, halanganCeklist, hariIni, jamJakarta, jumlahKategoriLengkap, kategoriLengkap,
  keWebp, kirimCeklist, nilaiKategori, perluPerhatian, pesanKirimGagal, pilihNilai, sudahDitinjau, teksBagian, unggahFoto,
  type Butir, type KunciBebas, type Laporan, type MapFoto, type MapIsian, type Nilai,
} from '@/lib/ceklist-harian'
import { GalatMuat, LencanaNilai, Lightbox, Thumbnail, WARNA_NILAI_AKTIF, useCeklistHari, useDb, useUrlFoto } from './komponen'

type Props = { staffId: string; role: string }

/**
 * Pengisian ceklist harian oleh area manager — port `CeklistHarianScreen` native.
 * Dua keadaan: daftar outlet binaan hari ini, lalu form satu outlet.
 */
export default function CeklistIsiClient({ staffId, role }: Props) {
  const db = useDb()
  // "Hari ini" dikunci saat halaman dibuka; muat ulang halaman bila hari berganti.
  const [tanggal] = useState(hariIni)
  const { data, memuat, galat, muat, ulang } = useCeklistHari(db, staffId, role, tanggal)
  const [outletDiisi, setOutletDiisi] = useState<string | null>(null)
  const [terkirim, setTerkirim] = useState<string | null>(null)

  const selesai = data.outlets.filter((o) => data.laporan[o.id]).length

  if (outletDiisi) {
    const outlet = data.outlets.find((o) => o.id === outletDiisi)
    return (
      <FormCeklist
        key={outletDiisi}
        staffId={staffId}
        outletId={outletDiisi}
        namaOutlet={outlet?.nama ?? 'Outlet'}
        lama={data.laporan[outletDiisi]}
        onTutup={() => setOutletDiisi(null)}
        onTerkirim={() => { setTerkirim(outlet?.nama ?? 'Outlet'); setOutletDiisi(null); void muat() }}
      />
    )
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {terkirim && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-emerald-800">Ceklist {terkirim} terkirim</p>
            <p className="text-xs text-emerald-700">Regional manager sudah diberi tahu.</p>
          </div>
          <button type="button" onClick={() => setTerkirim(null)} className="text-xs font-bold text-emerald-700 cursor-pointer">Tutup</button>
        </div>
      )}

      <div className="rounded-2xl bg-white border border-suka-brown/10 p-5 shadow-sm">
        <p className="text-xs font-bold text-suka-gray-500">Kunjungan hari ini · {formatTanggal(tanggal)}</p>
        <div className="flex items-end gap-1 mt-1">
          <span className="text-4xl font-black text-suka-brown leading-none">{selesai}</span>
          <span className="text-sm font-bold text-suka-gray-500 pb-1">/ {data.outlets.length} outlet sudah dicek</span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-suka-gray-100 overflow-hidden">
          <div className="h-full bg-suka-orange transition-all" style={{ width: `${data.outlets.length ? (selesai * 100) / data.outlets.length : 0}%` }} />
        </div>
      </div>

      {memuat && !data.outlets.length ? (
        <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-suka-orange" /></div>
      ) : galat && !data.outlets.length ? (
        <GalatMuat pesan={galat} onUlang={ulang} />
      ) : !data.outlets.length ? (
        <div className="rounded-2xl border border-dashed border-suka-brown/20 p-10 text-center text-sm font-bold text-suka-gray-500">
          Belum ada outlet binaan. Hubungi admin untuk memetakan outlet Anda.
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {data.outlets.map((o) => {
            const l = data.laporan[o.id]
            const milikLain = l && l.submittedBy !== staffId
            return (
              <button key={o.id} type="button" disabled={Boolean(milikLain)} onClick={() => { setTerkirim(null); setOutletDiisi(o.id) }}
                className="text-left rounded-2xl bg-white border border-suka-brown/10 p-4 flex items-center gap-3 hover:border-suka-orange/40 hover:shadow-sm transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${l ? 'bg-emerald-50 text-emerald-600' : 'bg-suka-orange/10 text-suka-orange'}`}>
                  {l ? <CheckCircle2 className="w-5 h-5" /> : <Store className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-suka-brown truncate">{o.nama}</p>
                  <p className="text-[11px] font-semibold text-suka-gray-500 truncate">
                    {!l ? 'Belum dicek' : milikLain ? `Sudah diisi oleh ${l.namaAm}` : sudahDitinjau(l)
                      ? `Disetujui ${l.namaPeninjau ?? 'RM'} · ${jamJakarta(l.ditinjauPada)}`
                      : `Terkirim ${jamJakarta(l.diperbaruiPada)} · menunggu RM`}
                  </p>
                  {l && sudahDitinjau(l) && l.tanggapanRm && (
                    <p className="text-[11px] text-suka-brown/80 mt-1 line-clamp-2">💬 {l.tanggapanRm}</p>
                  )}
                </div>
                {l && perluPerhatian(l) && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Perhatian</span>}
                <ChevronRight className="w-4 h-4 text-suka-gray-300 shrink-0" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

type FormProps = {
  staffId: string
  outletId: string
  namaOutlet: string
  lama?: Laporan
  onTutup: () => void
  onTerkirim: () => void
}

function FormCeklist({ staffId, outletId, namaOutlet, lama, onTutup, onTerkirim }: FormProps) {
  const db = useDb()
  const [isian, setIsian] = useState<MapIsian>(() => lama?.isian ?? {})
  const [foto, setFoto] = useState<MapFoto>(() => lama?.foto ?? {})
  const [bebas, setBebas] = useState<Record<KunciBebas, string[]>>(() => ({
    online_review: lama ? teksBagian(lama, 'online_review') : [],
    temuan: lama ? teksBagian(lama, 'temuan') : [],
    perbaikan: lama ? teksBagian(lama, 'perbaikan') : [],
  }))
  const [catatan, setCatatan] = useState(lama?.catatan ?? '')
  const [mengunggah, setMengunggah] = useState<Record<string, number>>({})
  const [mengirim, setMengirim] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  // Ref sinkron untuk batas foto: dua pilihan file beruntun tidak boleh melampaui 3.
  const terpakaiRef = useRef<Record<string, number>>({})
  // Kunci sinkron: dua klik beruntun sebelum React sempat render ulang tidak boleh mengirim dua kali.
  const mengirimRef = useRef(false)

  const semuaPath = useMemo(() => Object.values(foto).flat().map((f) => f.path), [foto])
  const url = useUrlFoto(db, semuaPath)

  const halangan = halanganCeklist(isian, foto)
  const sedangMengunggah = Object.values(mengunggah).some((n) => n > 0)
  const lengkap = jumlahKategoriLengkap(isian, foto)
  const temuanTerisi = bebas.temuan.map((t) => t.trim()).filter(Boolean)
  const perluTemuan = adaMasalah(isian) && temuanTerisi.length === 0

  const nilai = (b: Butir, n: Nilai) => setIsian((s) => ({ ...s, [b.kunci]: pilihNilai(b, s[b.kunci], n) }))
  const keterangan = (b: Butir, teks: string) => setIsian((s) => ({ ...s, [b.kunci]: { nilai: s[b.kunci]?.nilai ?? null, keterangan: teks } }))

  /** Hanya butir yang BELUM dinilai diberi Baik — penilaian yang sudah ada tidak disentuh. */
  const semuaBaik = () => setIsian((s) => {
    const baru = { ...s }
    for (const b of SEMUA_BUTIR) if (baru[b.kunci]?.nilai == null) baru[b.kunci] = pilihNilai(b, baru[b.kunci], 'baik')
    return baru
  })

  /**
   * Foto diunggah segera setelah dipilih, bukan ditumpuk sampai tombol kirim —
   * satu kegagalan jaringan di akhir tidak boleh membuang seluruh kunjungan.
   */
  const tambahFoto = async (kategori: string, files: FileList | null) => {
    if (!files?.length) return
    const sisa = FOTO_MAKS - ((foto[kategori]?.length ?? 0) + (terpakaiRef.current[kategori] ?? 0))
    const dipilih = Array.from(files).slice(0, Math.max(0, sisa))
    if (files.length > dipilih.length) toast.error(`Maksimal ${FOTO_MAKS} foto per bagian.`)
    if (!dipilih.length) return
    terpakaiRef.current[kategori] = (terpakaiRef.current[kategori] ?? 0) + dipilih.length
    setMengunggah((m) => ({ ...m, [kategori]: (m[kategori] ?? 0) + dipilih.length }))
    await Promise.all(dipilih.map(async (file) => {
      try {
        const gambar = await keWebp(file)
        const path = await unggahFoto(db, staffId, outletId, kategori, gambar)
        setFoto((f) => ({ ...f, [kategori]: [...(f[kategori] ?? []), { path }] }))
      } catch (e) {
        console.error('unggah foto gagal', e)
        toast.error('Foto gagal diunggah. Coba lagi.')
      } finally {
        terpakaiRef.current[kategori] = Math.max(0, (terpakaiRef.current[kategori] ?? 1) - 1)
        setMengunggah((m) => ({ ...m, [kategori]: Math.max(0, (m[kategori] ?? 1) - 1) }))
      }
    }))
  }

  const hapusFoto = (kategori: string, path: string) =>
    setFoto((f) => ({ ...f, [kategori]: (f[kategori] ?? []).filter((x) => x.path !== path) }))

  const kirim = async () => {
    if (halangan) { toast.error(halangan); return }
    if (sedangMengunggah) { toast.error('Tunggu foto selesai diunggah.'); return }
    if (mengirimRef.current) return
    mengirimRef.current = true
    setMengirim(true)
    try {
      await kirimCeklist(db, {
        outletId, isian, foto,
        onlineReview: bebas.online_review, temuan: bebas.temuan, perbaikan: bebas.perbaikan, catatan,
      })
      onTerkirim()
    } catch (e) {
      console.error('kirim ceklist gagal', e)
      toast.error(pesanKirimGagal(e))
      mengirimRef.current = false
      setMengirim(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-24">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => { if (!mengirim) onTutup() }} aria-label="Kembali"
          className="w-9 h-9 rounded-full bg-white border border-suka-brown/15 flex items-center justify-center cursor-pointer hover:bg-suka-gray-50">
          <ArrowLeft className="w-4 h-4 text-suka-brown" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-base font-black text-suka-brown truncate">{namaOutlet}</p>
          <p className="text-[11px] font-semibold text-suka-gray-500">
            {lama ? `Menyunting ceklist terkirim ${jamJakarta(lama.diperbaruiPada)}` : 'Ceklist harian baru'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xl font-black text-suka-orange leading-none">{Math.round((lengkap * 100) / KATEGORI_CEKLIST.length)}%</p>
          <p className="text-[10px] font-bold text-suka-gray-400">{lengkap}/{KATEGORI_CEKLIST.length} kategori</p>
        </div>
      </div>

      {lama && sudahDitinjau(lama) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
          Laporan ini sudah disetujui {lama.namaPeninjau ?? 'RM'}. Mengirim ulang akan membatalkan persetujuan dan RM perlu meninjau lagi.
        </div>
      )}

      <button type="button" onClick={semuaBaik}
        className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700 py-3 text-sm font-black flex items-center justify-center gap-2 cursor-pointer hover:bg-emerald-100">
        <Sparkles className="w-4 h-4" /> Semua sesuai (isi yang belum dinilai dengan Baik)
      </button>

      {KATEGORI_CEKLIST.map((kat) => (
        <section key={kat.kunci} className="rounded-2xl bg-white border border-suka-brown/10 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-black text-suka-brown flex items-center gap-2">
              {kategoriLengkap(kat, isian, foto) && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              {kat.label}
            </h3>
            {kat.punyaSubItem && <LencanaNilai nilai={nilaiKategori(kat, isian)} kecil />}
          </div>

          {kat.butir.map((b) => {
            const isi = isian[b.kunci]
            return (
              <div key={b.kunci} className="space-y-2">
                {kat.punyaSubItem && <p className="text-xs font-bold text-suka-brown/80">{b.label}</p>}
                <div className="grid grid-cols-3 gap-2">
                  {NILAI.map((n) => (
                    <button key={n.nilai} type="button" onClick={() => nilai(b, n.nilai)}
                      className={`rounded-xl border py-2 text-xs font-black transition cursor-pointer ${isi?.nilai === n.nilai ? WARNA_NILAI_AKTIF[n.nilai] : 'bg-white text-suka-brown/70 border-suka-brown/15 hover:bg-suka-gray-50'}`}>
                      {n.emoji} {n.label}
                    </button>
                  ))}
                </div>
                <input value={isi?.keterangan ?? ''} onChange={(e) => keterangan(b, e.target.value)} placeholder="Keterangan"
                  className="w-full rounded-xl border border-suka-brown/15 px-3 py-2 text-sm text-suka-brown focus:outline-none focus:border-suka-orange" />
              </div>
            )
          })}

          <BarisFoto
            label={kat.petunjukFoto}
            wajib={!(foto[kat.kunci]?.length)}
            kategori={kat.kunci}
            foto={foto[kat.kunci] ?? []}
            url={url}
            mengunggah={mengunggah[kat.kunci] ?? 0}
            bolehGaleri={false}
            onTambah={tambahFoto}
            onHapus={hapusFoto}
            onLihat={setLightbox}
          />
        </section>
      ))}

      {BAGIAN_BEBAS.map((bag) => (
        <section key={bag.kunci} className="rounded-2xl bg-white border border-suka-brown/10 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-suka-brown">{bag.label}</h3>
            <span className="text-[11px] font-semibold text-suka-gray-400">Opsional</span>
          </div>
          {bag.kunci === 'temuan' && perluTemuan && (
            <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              Ada penilaian yang tidak baik — catat temuannya di sini.
            </p>
          )}
          {bebas[bag.kunci].map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={t} placeholder={bag.contoh}
                onChange={(e) => setBebas((s) => ({ ...s, [bag.kunci]: s[bag.kunci].map((x, j) => (j === i ? e.target.value : x)) }))}
                className="flex-1 rounded-xl border border-suka-brown/15 px-3 py-2 text-sm text-suka-brown focus:outline-none focus:border-suka-orange" />
              <button type="button" aria-label="Hapus baris" onClick={() => setBebas((s) => ({ ...s, [bag.kunci]: s[bag.kunci].filter((_, j) => j !== i) }))}
                className="w-9 h-9 rounded-xl border border-suka-brown/10 flex items-center justify-center text-red-500 hover:bg-red-50 cursor-pointer">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setBebas((s) => ({ ...s, [bag.kunci]: [...s[bag.kunci], ''] }))}
            className="text-xs font-black text-suka-orange flex items-center gap-1 cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> {bag.teksTambah}
          </button>
          <BarisFoto
            label={bag.bolehGaleri ? 'Foto / tangkapan layar (opsional)' : 'Foto (opsional)'}
            wajib={false}
            kategori={bag.kunci}
            foto={foto[bag.kunci] ?? []}
            url={url}
            mengunggah={mengunggah[bag.kunci] ?? 0}
            bolehGaleri={bag.bolehGaleri}
            onTambah={tambahFoto}
            onHapus={hapusFoto}
            onLihat={setLightbox}
          />
        </section>
      ))}

      <section className="rounded-2xl bg-white border border-suka-brown/10 p-4 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-suka-brown">Catatan tambahan</h3>
          <span className="text-[11px] font-semibold text-suka-gray-400">Opsional</span>
        </div>
        <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={3} placeholder="Hal lain yang perlu diketahui RM"
          className="w-full rounded-xl border border-suka-brown/15 px-3 py-2 text-sm text-suka-brown focus:outline-none focus:border-suka-orange" />
      </section>

      <div className="fixed bottom-[88px] md:bottom-0 left-0 md:left-64 right-0 z-30 px-3 sm:px-6 py-3 bg-white/90 backdrop-blur-xl border-t border-suka-brown/10">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <p className="flex-1 text-xs font-semibold text-suka-gray-500 truncate">
            {sedangMengunggah ? 'Mengunggah foto…' : halangan ?? 'Siap dikirim.'}
          </p>
          <button type="button" onClick={kirim} disabled={Boolean(halangan) || mengirim || sedangMengunggah}
            className="px-5 py-2.5 rounded-xl bg-suka-orange text-white text-sm font-black flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
            {mengirim ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
            {lama ? 'Kirim ulang' : 'Kirim ceklist'}
          </button>
        </div>
      </div>

      <Lightbox src={lightbox} onTutup={() => setLightbox(null)} />
    </div>
  )
}

function BarisFoto(p: {
  label: string; wajib: boolean; kategori: string; foto: { path: string }[]; url: Record<string, string>
  mengunggah: number; bolehGaleri: boolean
  onTambah: (kategori: string, files: FileList | null) => void
  onHapus: (kategori: string, path: string) => void
  onLihat: (src: string) => void
}) {
  const kameraRef = useRef<HTMLInputElement>(null)
  const galeriRef = useRef<HTMLInputElement>(null)
  const penuh = p.foto.length + p.mengunggah >= FOTO_MAKS
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold text-suka-gray-500">{p.label} · {p.foto.length}/{FOTO_MAKS}</p>
        {p.wajib && <span className="text-[11px] font-black text-red-600">Foto wajib</span>}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {p.foto.map((f) => (
          <Thumbnail key={f.path} src={p.url[f.path]} onClick={() => p.url[f.path] && p.onLihat(p.url[f.path])} onHapus={() => p.onHapus(p.kategori, f.path)} />
        ))}
        {Array.from({ length: p.mengunggah }).map((_, i) => <Thumbnail key={`u${i}`} />)}
        {!penuh && (
          <>
            <button type="button" onClick={() => kameraRef.current?.click()}
              className="w-20 h-20 shrink-0 rounded-xl border-2 border-dashed border-suka-orange/40 text-suka-orange flex flex-col items-center justify-center gap-1 text-[10px] font-black hover:bg-suka-orange/5 cursor-pointer">
              <Camera className="w-5 h-5" /> Foto
            </button>
            {p.bolehGaleri && (
              <button type="button" onClick={() => galeriRef.current?.click()}
                className="w-20 h-20 shrink-0 rounded-xl border-2 border-dashed border-suka-brown/20 text-suka-brown/70 flex flex-col items-center justify-center gap-1 text-[10px] font-black hover:bg-suka-gray-50 cursor-pointer">
                <ImagePlus className="w-5 h-5" /> Galeri
              </button>
            )}
          </>
        )}
      </div>
      {/* capture="environment" membuka kamera belakang di HP; di desktop jatuh ke pemilih berkas. */}
      <input ref={kameraRef} type="file" accept="image/*" capture="environment" hidden
        onChange={(e) => { p.onTambah(p.kategori, e.target.files); e.target.value = '' }} />
      {p.bolehGaleri && (
        <input ref={galeriRef} type="file" accept="image/*" multiple hidden
          onChange={(e) => { p.onTambah(p.kategori, e.target.files); e.target.value = '' }} />
      )}
    </div>
  )
}
