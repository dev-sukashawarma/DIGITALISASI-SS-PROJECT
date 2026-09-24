'use client'

import { useState } from 'react'
import { Check, X, Pencil } from 'lucide-react'
import { validasiBarisKatalog, parseAngkaId, type VendorSetara } from '@/lib/katalogGroup'
import { kapital } from '@/lib/masterBahan/tampilan'
import { BarisTabel, Kosong, Lencana, Td } from '@/components/master-bahan/Tabel'

const rupiah = (n: number) =>
  'Rp ' + Math.round(n).toLocaleString('id-ID')

const perKecilFmt = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 4 })

/** Rasio antara hitungan hidup & harga master di luar [1/5, 5] dianggap kemungkinan salah skala. */
function pesanRasioMenyimpang(hidup: number, master: number | null): string | null {
  if (master === null || master <= 0) return null
  const rasio = hidup / master
  if (rasio >= 5) return `⚠ ${rasio.toFixed(1)}× harga master`
  if (rasio <= 1 / 5) return `⚠ ${(1 / rasio).toFixed(1)}× lebih rendah dari harga master`
  return null
}

const kelasInput = 'w-full rounded-lg border border-stone-300 px-2 py-1 text-sm outline-none focus:border-suka-orange'

export function BarisVendor({
  v,
  satuanKecil,
  hargaMasterPerKecil,
  menyimpan,
  onSimpan,
}: {
  v: VendorSetara
  satuanKecil: string
  hargaMasterPerKecil: number | null
  menyimpan: boolean
  onSimpan: (input: { id: string; harga: number; satuan_beli: string; isi_satuan_kecil: number }) => Promise<void>
}) {
  const [sunting, setSunting] = useState(false)
  const [harga, setHarga] = useState(String(v.harga))
  const [satuanBeli, setSatuanBeli] = useState(v.satuan_beli)
  const [isi, setIsi] = useState(String(v.isi_satuan_kecil))
  const [galat, setGalat] = useState<string | null>(null)

  const belumAdaHarga = v.harga <= 0

  function mulaiSunting() {
    setHarga(String(v.harga))
    setSatuanBeli(v.satuan_beli)
    setIsi(String(v.isi_satuan_kecil))
    setGalat(null)
    setSunting(true)
  }

  async function simpan() {
    const hargaAngka = parseAngkaId(harga)
    if (hargaAngka === null) {
      setGalat('Harga wajib diisi.')
      return
    }
    const isiAngka = parseAngkaId(isi)
    if (isiAngka === null) {
      setGalat('Isi satuan kecil wajib diisi.')
      return
    }
    const input = {
      harga: hargaAngka,
      satuan_beli: satuanBeli,
      isi_satuan_kecil: isiAngka,
    }
    const pesan = validasiBarisKatalog(input)
    if (pesan) {
      setGalat(pesan)
      return
    }
    setGalat(null)
    try {
      await onSimpan({ id: v.id, ...input })
      setSunting(false)
    } catch {
      // Penyimpanan gagal (parent sudah menampilkan toast.error).
      // Tetap di mode sunting, biarkan nilai yang sudah diketik apa adanya.
    }
  }

  function batal() {
    setHarga(String(v.harga))
    setSatuanBeli(v.satuan_beli)
    setIsi(String(v.isi_satuan_kecil))
    setGalat(null)
    setSunting(false)
  }

  if (sunting) {
    const hargaHidup = parseAngkaId(harga)
    const isiHidup = parseAngkaId(isi)
    const perKecil = hargaHidup !== null && isiHidup !== null && isiHidup > 0 ? hargaHidup / isiHidup : null
    const peringatan = perKecil !== null ? pesanRasioMenyimpang(perKecil, hargaMasterPerKecil) : null
    return (
      <BarisTabel sorot>
        <Td><span className="font-medium text-stone-800">{v.supplier_nama}</span></Td>
        <Td>
          <input value={satuanBeli} onChange={(e) => setSatuanBeli(e.target.value)} className={kelasInput} aria-label="Satuan beli" />
        </Td>
        <Td>
          <input value={isi} onChange={(e) => setIsi(e.target.value)} inputMode="decimal"
            className={`${kelasInput} text-right tabular-nums`} aria-label={`Isi dalam ${satuanKecil}`} />
        </Td>
        <Td>
          <input value={harga} onChange={(e) => setHarga(e.target.value)} inputMode="decimal"
            className={`${kelasInput} text-right tabular-nums`} aria-label="Harga per satuan beli" />
        </Td>
        <Td angka>
          {perKecil === null ? <Kosong /> : (
            <div className="flex flex-col items-end">
              <span className="text-stone-700">{perKecilFmt(perKecil)}</span>
              {peringatan && <span className="whitespace-normal text-[11px] font-semibold text-red-600">{peringatan}</span>}
            </div>
          )}
        </Td>
        <Td angka><Kosong /></Td>
        <Td>{galat && <span className="text-xs text-red-600">{galat}</span>}</Td>
        <Td rata="kanan">
          <div className="flex justify-end gap-1">
            <button onClick={simpan} disabled={menyimpan} aria-label="Simpan"
              className="rounded-lg bg-emerald-600 p-1.5 text-white hover:bg-emerald-700 disabled:opacity-50">
              <Check size={14} />
            </button>
            <button onClick={batal} aria-label="Batal" className="rounded-lg bg-stone-200 p-1.5 text-stone-700 hover:bg-stone-300">
              <X size={14} />
            </button>
          </div>
        </Td>
      </BarisTabel>
    )
  }

  return (
    <BarisTabel>
      <Td>
        <p className="truncate font-medium text-stone-800" title={v.supplier_nama}>{v.supplier_nama}</p>
        {v.termin_hari ? <p className="text-xs text-stone-500">tempo {v.termin_hari} hari</p> : null}
      </Td>
      <Td className="text-stone-700">{kapital(v.satuan_beli)}</Td>
      <Td angka className="text-stone-700">
        {v.isi_satuan_kecil.toLocaleString('id-ID')} <span className="text-stone-500">{satuanKecil}</span>
      </Td>
      <Td angka>
        {belumAdaHarga
          ? <span className="text-xs italic text-stone-500">belum ada harga</span>
          : <span className="font-semibold text-stone-800">{rupiah(v.harga)}</span>}
      </Td>
      <Td angka className="text-stone-700">
        {belumAdaHarga || v.hargaPerSatuanKecil === null ? <Kosong /> : perKecilFmt(v.hargaPerSatuanKecil)}
      </Td>
      <Td angka className="text-xs text-stone-500">
        {v.harga_updated_at
          ? new Date(v.harga_updated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
          : <Kosong />}
      </Td>
      <Td>
        {v.perlu_ditinjau ? (
          <Lencana nada="kuning">perlu ditinjau</Lencana>
        ) : v.selisihPersen === null ? (
          <Kosong />
        ) : v.selisihPersen === 0 ? (
          <Lencana nada="hijau">termurah</Lencana>
        ) : (
          <span className="text-xs font-semibold tabular-nums text-stone-600">+{v.selisihPersen.toFixed(1)}%</span>
        )}
      </Td>
      <Td rata="kanan">
        <button
          onClick={mulaiSunting}
          className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-suka-orange"
          aria-label={`Sunting ${v.supplier_nama}`}
        >
          <Pencil size={14} />
        </button>
      </Td>
    </BarisTabel>
  )
}
