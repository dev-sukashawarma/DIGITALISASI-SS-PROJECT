'use client'

import { useState } from 'react'
import { Check, X, Pencil } from 'lucide-react'
import { validasiBarisKatalog, type VendorSetara } from '@/lib/katalogGroup'

const rupiah = (n: number) =>
  'Rp ' + Math.round(n).toLocaleString('id-ID')

export function BarisVendor({
  v,
  satuanKecil,
  menyimpan,
  onSimpan,
}: {
  v: VendorSetara
  satuanKecil: string
  menyimpan: boolean
  onSimpan: (input: { id: string; harga: number; satuan_beli: string; isi_satuan_kecil: number }) => Promise<void>
}) {
  const [sunting, setSunting] = useState(false)
  const [harga, setHarga] = useState(String(v.harga))
  const [satuanBeli, setSatuanBeli] = useState(v.satuan_beli)
  const [isi, setIsi] = useState(String(v.isi_satuan_kecil))
  const [galat, setGalat] = useState<string | null>(null)

  const belumAdaHarga = v.harga <= 0

  async function simpan() {
    const input = {
      harga: Number(harga),
      satuan_beli: satuanBeli,
      isi_satuan_kecil: Number(isi),
    }
    const pesan = validasiBarisKatalog(input)
    if (pesan) {
      setGalat(pesan)
      return
    }
    setGalat(null)
    await onSimpan({ id: v.id, ...input })
    setSunting(false)
  }

  function batal() {
    setHarga(String(v.harga))
    setSatuanBeli(v.satuan_beli)
    setIsi(String(v.isi_satuan_kecil))
    setGalat(null)
    setSunting(false)
  }

  if (sunting) {
    return (
      <tr className="border-t border-stone-100 bg-amber-50/40">
        <td className="py-2 px-3 font-medium text-stone-700">{v.supplier_nama}</td>
        <td className="py-2 px-3">
          <input
            value={satuanBeli}
            onChange={(e) => setSatuanBeli(e.target.value)}
            className="w-24 rounded-lg border border-stone-300 px-2 py-1 text-sm"
            aria-label="Satuan beli"
          />
        </td>
        <td className="py-2 px-3">
          <input
            value={isi}
            onChange={(e) => setIsi(e.target.value)}
            inputMode="decimal"
            className="w-28 rounded-lg border border-stone-300 px-2 py-1 text-sm text-right"
            aria-label={`Isi dalam ${satuanKecil}`}
          />
        </td>
        <td className="py-2 px-3">
          <input
            value={harga}
            onChange={(e) => setHarga(e.target.value)}
            inputMode="decimal"
            className="w-32 rounded-lg border border-stone-300 px-2 py-1 text-sm text-right"
            aria-label="Harga per satuan beli"
          />
        </td>
        <td className="py-2 px-3 text-right text-stone-400">—</td>
        <td className="py-2 px-3 text-right text-stone-400">—</td>
        <td className="py-2 px-3">
          {galat && <span className="text-xs text-red-600">{galat}</span>}
        </td>
        <td className="py-2 px-3 text-right whitespace-nowrap">
          <button
            onClick={simpan}
            disabled={menyimpan}
            className="mr-1 rounded-lg bg-emerald-600 px-2 py-1 text-white disabled:opacity-50"
            aria-label="Simpan"
          >
            <Check size={14} />
          </button>
          <button onClick={batal} className="rounded-lg bg-stone-200 px-2 py-1" aria-label="Batal">
            <X size={14} />
          </button>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-t border-stone-100">
      <td className="py-2 px-3 font-medium text-stone-700">
        {v.supplier_nama}
        {v.termin_hari ? <span className="ml-2 text-xs text-stone-400">tempo {v.termin_hari} hr</span> : null}
      </td>
      <td className="py-2 px-3 text-stone-600">{v.satuan_beli}</td>
      <td className="py-2 px-3 text-right text-stone-600">
        {v.isi_satuan_kecil.toLocaleString('id-ID')} {satuanKecil}
      </td>
      <td className="py-2 px-3 text-right">
        {belumAdaHarga ? (
          <span className="text-xs italic text-stone-400">belum ada harga</span>
        ) : (
          <span className="font-semibold text-stone-800">{rupiah(v.harga)}</span>
        )}
      </td>
      <td className="py-2 px-3 text-right">
        {belumAdaHarga || v.hargaPerSatuanKecil === null ? (
          <span className="text-stone-300">—</span>
        ) : (
          <span className="text-stone-600">
            {v.hargaPerSatuanKecil.toLocaleString('id-ID', { maximumFractionDigits: 4 })}
          </span>
        )}
      </td>
      <td className="py-2 px-3 text-right text-xs text-stone-400">
        {v.harga_updated_at
          ? new Date(v.harga_updated_at).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })
          : '—'}
      </td>
      <td className="py-2 px-3 text-right">
        {v.perlu_ditinjau ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
            perlu ditinjau
          </span>
        ) : v.selisihPersen === null ? (
          <span className="text-stone-300">—</span>
        ) : v.selisihPersen === 0 ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
            termurah
          </span>
        ) : (
          <span className="text-[11px] font-semibold text-stone-500">
            +{v.selisihPersen.toFixed(1)}%
          </span>
        )}
      </td>
      <td className="py-2 px-3 text-right">
        <button
          onClick={() => setSunting(true)}
          className="rounded-lg border border-stone-200 px-2 py-1 text-stone-500 hover:bg-stone-50"
          aria-label={`Sunting ${v.supplier_nama}`}
        >
          <Pencil size={14} />
        </button>
      </td>
    </tr>
  )
}
