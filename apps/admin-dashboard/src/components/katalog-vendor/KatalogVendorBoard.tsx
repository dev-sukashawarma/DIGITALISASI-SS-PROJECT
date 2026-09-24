'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { kelompokkanKatalog, ringkasKatalog } from '@/lib/katalogGroup'
import { useKatalogVendor } from '@/hooks/useKatalogVendor'
import { useMutasiMasterBahan } from '@/hooks/masterBahan/useMutasiMasterBahan'
import { bacaGalatRpc, type GalatRpc } from '@/lib/masterBahan/galatRpc'
import { DialogAlasan } from '@/components/master-bahan/DialogAlasan'
import { FilterCepat, InfoJumlah, KepalaTabel, KolomCari, LebarKolom, Pilih, Tabel, Th } from '@/components/master-bahan/Tabel'
import { KELOMPOK_KATEGORI, kapital, kelompokKategori, type KunciKelompok } from '@/lib/masterBahan/tampilan'
import { BarisVendor } from './BarisVendor'

/** Lebar kolom sama di setiap kelompok bahan, supaya kolom sejajar dari atas sampai bawah. */
const LEBAR_KOLOM_VENDOR = ['24%', '10%', '12%', '13%', '12%', '11%', '12%', '3rem']

export function KatalogVendorBoard() {
  const { rows, loading, error } = useKatalogVendor()
  const { simpanHargaVendor } = useMutasiMasterBahan()
  const [hanyaPerluDiisi, setHanyaPerluDiisi] = useState(false)
  const [cari, setCari] = useState('')

  const kelompok = useMemo(() => kelompokkanKatalog(rows), [rows])
  const ringkas = useMemo(() => ringkasKatalog(kelompok), [kelompok])

  const [kategoriPilih, setKategoriPilih] = useState<KunciKelompok | ''>('')

  const menurutSaringan = useMemo(() => {
    const kata = cari.trim().toLowerCase()
    return kelompok.filter((k) => {
      if (hanyaPerluDiisi && k.jumlahBerharga === k.jumlahVendor) return false
      if (!kata) return true
      if (k.bahan.toLowerCase().includes(kata)) return true
      return k.vendors.some((v) => v.supplier_nama.toLowerCase().includes(kata))
    })
  }, [kelompok, hanyaPerluDiisi, cari])
  const tampil = useMemo(
    () => kategoriPilih ? menurutSaringan.filter((k) => kelompokKategori(k.kategori) === kategoriPilih) : menurutSaringan,
    [menurutSaringan, kategoriPilih],
  )
  // Lima kategori besar, urutan tetap (sama dengan tab Data Bahan); kelompok kosong disembunyikan.
  const grup = useMemo(
    () => KELOMPOK_KATEGORI
      .map((g) => ({ ...g, bahan: tampil.filter((k) => kelompokKategori(k.kategori) === g.kunci) }))
      .filter((g) => g.bahan.length > 0),
    [tampil],
  )
  const jumlahPerKategori = useMemo(() => {
    const m = new Map<KunciKelompok, number>()
    for (const k of menurutSaringan) {
      const g = kelompokKategori(k.kategori)
      m.set(g, (m.get(g) ?? 0) + 1)
    }
    return m
  }, [menurutSaringan])

  type InputSimpan = { id: string; harga: number; satuan_beli: string; isi_satuan_kecil: number }
  const [tertunda, setTertunda] = useState<{ input: InputSimpan; selesai: (ok: boolean) => void } | null>(null)
  const [galatDialog, setGalatDialog] = useState<GalatRpc | null>(null)

  function simpan(input: InputSimpan): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      setGalatDialog(null)
      setTertunda({ input, selesai: (ok) => (ok ? resolve() : reject(new Error('Dibatalkan'))) })
    })
  }

  async function kirim({ alasan, paksa }: { alasan: string; paksa: boolean }) {
    if (!tertunda) return
    const baris = rows.find((r) => r.id === tertunda.input.id)
    if (!baris) { setGalatDialog({ pesan: 'Baris katalog tidak ditemukan', kode: null, bisaDipaksa: false }); return }
    try {
      await simpanHargaVendor.mutateAsync({
        bahanId: baris.bahan_baku_id, supplierId: baris.supplier_id, harga: tertunda.input.harga,
        satuanBeli: tertunda.input.satuan_beli.trim(), isi: tertunda.input.isi_satuan_kecil, alasan, paksa,
      })
      toast.success('Harga vendor tersimpan')
      tertunda.selesai(true)
      setTertunda(null)
    } catch (e) {
      setGalatDialog(bacaGalatRpc(e))
    }
  }

  if (loading) return <p className="p-6 text-stone-500">Memuat katalog…</p>
  if (error) return <p className="p-6 text-red-600">Gagal memuat katalog: {String(error)}</p>

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 divide-stone-200 overflow-hidden rounded-lg border border-stone-200 bg-white sm:grid-cols-4 sm:divide-x">
        <Statistik label="Baris katalog" nilai={ringkas.totalBaris} />
        <Statistik label="Sudah berharga" nilai={ringkas.terpercaya} nada="emerald" />
        <Statistik label="Perlu diisi" nilai={ringkas.perluDiisi} nada="amber" />
        <Statistik
          label="Bisa dibandingkan"
          nilai={`${ringkas.bisaDibandingkan} / ${ringkas.bahanMultivendor}`}
          catatan="bahan ≥2 harga"
        />
      </dl>

      <div className="flex flex-wrap items-center gap-2">
        <FilterCepat<'semua' | 'perlu'>
          label="Saring katalog"
          nilai={hanyaPerluDiisi ? 'perlu' : 'semua'}
          onUbah={(v) => setHanyaPerluDiisi(v === 'perlu')}
          pilihan={[
            { id: 'semua', label: 'Semua', jumlah: kelompok.length },
            { id: 'perlu', label: 'Perlu diisi', jumlah: kelompok.filter((k) => k.jumlahBerharga !== k.jumlahVendor).length, nada: 'kuning' },
          ]}
        />
        <KolomCari nilai={cari} onUbah={setCari} placeholder="Cari bahan atau vendor…" />
        <Pilih nilai={kategoriPilih} onUbah={(v) => setKategoriPilih(v as KunciKelompok | '')} label="Saring kategori">
          <option value="">Semua kategori</option>
          {KELOMPOK_KATEGORI.map((g) => (
            <option key={g.kunci} value={g.kunci}>{g.label} ({jumlahPerKategori.get(g.kunci) ?? 0})</option>
          ))}
        </Pilih>
        <div className="ml-auto"><InfoJumlah tampil={tampil.length} total={kelompok.length} satuan="bahan" /></div>
      </div>

      {tampil.length === 0 ? (
        <p className="rounded-lg border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">
          Tidak ada bahan atau vendor yang cocok.
        </p>
      ) : (
        grup.map((g) => (
          <div key={g.kunci} className="space-y-3">
            <h2 className="flex items-baseline gap-2 rounded-lg border border-orange-100 bg-orange-50/60 px-3 py-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-suka-brown">{g.label}</span>
              <span className="font-mono text-[11px] tabular-nums text-stone-600">{g.bahan.length} bahan</span>
            </h2>
            {g.bahan.map((k) => {
              const satuanKecil = k.satuan_kecil ?? 'satuan kecil'
              return (
                <section key={k.bahan_baku_id} className="space-y-1.5">
                  <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-0.5">
                    <h3 className="text-[14px] font-bold text-suka-brown">{k.bahan}</h3>
                    <dl className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-stone-500">
                      <div className="flex gap-1"><dt>Satuan</dt><dd className="font-semibold text-stone-700">{k.satuan ?? '—'}</dd></div>
                      <div className="flex gap-1">
                        <dt>PO</dt>
                        <dd className="font-semibold text-stone-700">
                          {k.satuan_po ? kapital(k.satuan_po) : '—'}
                          {k.faktor_po ? ` = ${k.faktor_po.toLocaleString('id-ID')} ${satuanKecil}` : ''}
                        </dd>
                      </div>
                      <div className="flex gap-1">
                        <dt>Master</dt>
                        <dd className="font-semibold tabular-nums text-stone-700">
                          {k.hargaMasterPerKecil === null
                            ? <span className="font-normal text-stone-500">belum diisi</span>
                            : `${k.hargaMasterPerKecil.toLocaleString('id-ID', { maximumFractionDigits: 4 })}/${satuanKecil}`}
                        </dd>
                      </div>
                      <div className="text-stone-500">
                        {k.bisaDibandingkan
                          ? `${k.jumlahBerharga} harga bisa dibandingkan`
                          : `${k.jumlahBerharga} dari ${k.jumlahVendor} vendor berharga`}
                      </div>
                    </dl>
                  </header>
                  <Tabel lebarMin={860} bergulir={false}>
                    <LebarKolom lebar={LEBAR_KOLOM_VENDOR} />
                    <KepalaTabel>
                      <Th>Vendor</Th>
                      <Th>Satuan beli</Th>
                      <Th rata="kanan">Isi</Th>
                      <Th rata="kanan">Harga</Th>
                      <Th rata="kanan">Per {satuanKecil}</Th>
                      <Th rata="kanan">Terakhir</Th>
                      <Th>Status</Th>
                      <Th><span className="sr-only">Sunting</span></Th>
                    </KepalaTabel>
                    <tbody>
                      {k.vendors.map((v) => (
                        <BarisVendor
                          key={v.id}
                          v={v}
                          satuanKecil={satuanKecil}
                          hargaMasterPerKecil={k.hargaMasterPerKecil}
                          menyimpan={simpanHargaVendor.isPending}
                          onSimpan={simpan}
                        />
                      ))}
                    </tbody>
                  </Tabel>
                </section>
              )
            })}
          </div>
        ))
      )}
      {tertunda && (
        <DialogAlasan judul="Simpan harga vendor" wajib galat={galatDialog} memproses={simpanHargaVendor.isPending}
          onBatal={() => { tertunda.selesai(false); setTertunda(null) }} onKirim={kirim} />
      )}
    </div>
  )
}

function Statistik({
  label,
  nilai,
  nada,
  catatan,
}: {
  label: string
  nilai: number | string
  nada?: 'emerald' | 'amber'
  catatan?: string
}) {
  const warna =
    nada === 'emerald' ? 'text-emerald-700' : nada === 'amber' ? 'text-amber-700' : 'text-stone-900'
  return (
    <div className="border-b border-stone-200 px-3.5 py-2 sm:border-b-0">
      <dt className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-stone-500">{label}</dt>
      <dd className="flex items-baseline gap-1.5">
        <span className={`font-mono text-lg font-bold tabular-nums ${warna}`}>{nilai}</span>
        {catatan && <span className="text-[11px] text-stone-500">{catatan}</span>}
      </dd>
    </div>
  )
}
