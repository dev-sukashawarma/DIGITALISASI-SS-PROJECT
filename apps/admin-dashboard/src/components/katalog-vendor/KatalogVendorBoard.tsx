'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { kelompokkanKatalog, ringkasKatalog } from '@/lib/katalogGroup'
import { useKatalogVendor, useKatalogVendorMutations } from '@/hooks/useKatalogVendor'
import { BarisVendor } from './BarisVendor'

export function KatalogVendorBoard() {
  const { rows, loading, error } = useKatalogVendor()
  const { simpanBaris } = useKatalogVendorMutations()
  const [hanyaPerluDiisi, setHanyaPerluDiisi] = useState(false)
  const [cari, setCari] = useState('')

  const kelompok = useMemo(() => kelompokkanKatalog(rows), [rows])
  const ringkas = useMemo(() => ringkasKatalog(kelompok), [kelompok])

  const tampil = useMemo(() => {
    const kata = cari.trim().toLowerCase()
    return kelompok.filter((k) => {
      if (hanyaPerluDiisi && k.jumlahBerharga === k.jumlahVendor) return false
      if (!kata) return true
      if (k.bahan.toLowerCase().includes(kata)) return true
      return k.vendors.some((v) => v.supplier_nama.toLowerCase().includes(kata))
    })
  }, [kelompok, hanyaPerluDiisi, cari])

  async function simpan(input: { id: string; harga: number; satuan_beli: string; isi_satuan_kecil: number }) {
    try {
      await simpanBaris.mutateAsync(input)
      toast.success('Harga vendor tersimpan')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan')
      throw e
    }
  }

  if (loading) return <p className="p-6 text-stone-500">Memuat katalog…</p>
  if (error) return <p className="p-6 text-red-600">Gagal memuat katalog: {String(error)}</p>

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kartu label="Baris katalog" nilai={ringkas.totalBaris} />
        <Kartu label="Sudah berharga" nilai={ringkas.terpercaya} nada="emerald" />
        <Kartu label="Perlu diisi" nilai={ringkas.perluDiisi} nada="amber" />
        <Kartu
          label="Bisa dibandingkan"
          nilai={`${ringkas.bisaDibandingkan} / ${ringkas.bahanMultivendor}`}
          catatan="bahan dengan ≥2 harga"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          placeholder="Cari bahan atau vendor…"
          className="flex-1 min-w-[200px] rounded-xl border border-stone-200 px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-stone-600">
          <input
            type="checkbox"
            checked={hanyaPerluDiisi}
            onChange={(e) => setHanyaPerluDiisi(e.target.checked)}
          />
          Hanya yang perlu diisi
        </label>
      </div>

      {tampil.length === 0 ? (
        <p className="rounded-xl border border-stone-200 p-6 text-center text-stone-500">
          Tidak ada baris yang cocok.
        </p>
      ) : (
        tampil.map((k) => {
          const satuanKecil = k.satuan_kecil ?? 'satuan kecil'
          return (
            <section key={k.bahan_baku_id} className="rounded-2xl border border-stone-200 bg-white">
              <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-stone-100 px-4 py-3">
                <h2 className="font-bold text-stone-800">{k.bahan}</h2>
                <p className="text-xs text-stone-500">
                  satuan besar <b>{k.satuan ?? '—'}</b> · satuan PO <b>{k.satuan_po ?? '—'}</b>
                  {k.faktor_po ? <> · 1 {k.satuan_po} = <b>{k.faktor_po.toLocaleString('id-ID')}</b> satuan kecil</> : null}
                  {' · harga master '}
                  {k.hargaMasterPerKecil === null ? (
                    <b className="text-stone-400">belum diisi</b>
                  ) : (
                    <b>
                      {k.hargaMasterPerKecil.toLocaleString('id-ID', { maximumFractionDigits: 4 })}
                      /satuan kecil
                    </b>
                  )}
                  {' · '}
                  {k.bisaDibandingkan
                    ? `${k.jumlahBerharga} harga bisa dibandingkan`
                    : `${k.jumlahBerharga} dari ${k.jumlahVendor} vendor berharga`}
                </p>
              </header>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-stone-400">
                    <tr>
                      <th className="py-2 px-3">Vendor</th>
                      <th className="py-2 px-3">Satuan beli</th>
                      <th className="py-2 px-3 text-right">Isi</th>
                      <th className="py-2 px-3 text-right">Harga</th>
                      <th className="py-2 px-3 text-right">Per satuan kecil</th>
                      <th className="py-2 px-3 text-right">Terakhir</th>
                      <th className="py-2 px-3 text-right">Status</th>
                      <th className="py-2 px-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {k.vendors.map((v) => (
                      <BarisVendor
                        key={v.id}
                        v={v}
                        satuanKecil={satuanKecil}
                        hargaMasterPerKecil={k.hargaMasterPerKecil}
                        menyimpan={simpanBaris.isPending}
                        onSimpan={simpan}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}

function Kartu({
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
    nada === 'emerald' ? 'text-emerald-700' : nada === 'amber' ? 'text-amber-700' : 'text-stone-800'
  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${warna}`}>{nilai}</p>
      {catatan && <p className="text-[11px] text-stone-400">{catatan}</p>}
    </div>
  )
}
