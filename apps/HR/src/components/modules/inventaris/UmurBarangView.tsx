'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { AlertCircle, ArrowLeft, Info, Search } from 'lucide-react'
import { Spinner } from '@suka/design-system'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { useSimpanUmurBarang, useUmurBarang, type JenisBarang } from '@/hooks/usePengingatAset'
import { formatUmur } from '@/lib/pengingatAset'

const PILIHAN_BULAN = [6, 12, 18, 24, 36, 48, 60, 72, 84, 96, 120]
const TIDAK_DILACAK = 'none'

export default function UmurBarangView() {
  const { data = [], isLoading, error } = useUmurBarang()
  const simpan = useSimpanUmurBarang()
  const [query, setQuery] = useState('')
  const [hanyaDilacak, setHanyaDilacak] = useState(false)

  const grup = useMemo(() => {
    const q = query.trim().toLowerCase()
    const map = new Map<string, JenisBarang[]>()
    for (const row of data) {
      if (hanyaDilacak && !row.umur_ekonomis_bulan) continue
      if (q && !`${row.name} ${row.subsection}`.toLowerCase().includes(q)) continue
      map.set(row.subsection, [...(map.get(row.subsection) ?? []), row])
    }
    return [...map]
  }, [data, query, hanyaDilacak])

  const jumlahDilacak = data.filter((r) => r.umur_ekonomis_bulan).length

  const opsi = (nilai: number | null) => {
    const list = [{ label: 'Tidak dilacak', value: TIDAK_DILACAK }, ...PILIHAN_BULAN.map((b) => ({ label: formatUmur(b), value: String(b) }))]
    // Nilai lama di luar daftar tetap tampil.
    if (nilai && !PILIHAN_BULAN.includes(nilai)) list.push({ label: formatUmur(nilai), value: String(nilai) })
    return list
  }

  const ubah = (row: JenisBarang, value: string) => {
    const bulan = value === TIDAK_DILACAK ? null : Number(value)
    if (bulan === row.umur_ekonomis_bulan) return
    simpan.mutate({ id: row.id, bulan }, {
      onSuccess: () => toast.success(bulan ? `${row.name}: umur pakai ${formatUmur(bulan)}` : `${row.name} tidak dilacak lagi`),
      onError: (e: any) => toast.error(e.message || 'Gagal menyimpan umur barang'),
    })
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href="/inventaris/pengingat" className="inline-flex items-center gap-1.5 text-sm font-bold text-suka-brown hover:text-suka-orange">
        <ArrowLeft size={15} /> Kembali ke pengingat aset
      </Link>
      <PageHeader
        title="Umur Pakai Barang"
        description={`Atur perkiraan umur pakai tiap jenis barang. ${jumlahDilacak} jenis barang sedang dilacak.`}
      />

      <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <Info className="mt-0.5 h-5 w-5 shrink-0" />
        <p>
          Sistem mengingatkan <b>3 bulan sebelum</b> umur pakai habis (atau seperempat umurnya untuk barang berumur pendek).
          Pilih <b>Tidak dilacak</b> untuk barang habis pakai atau milik pihak lain (mis. mesin EDC milik bank).
          Barang yang dilaporkan rusak tetap muncul di pengingat walau tidak dilacak umurnya.
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-suka-gray-200 bg-white p-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block sm:w-72">
          <span className="sr-only">Cari barang</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-suka-gray-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari jenis barang..." className="w-full rounded-xl border border-suka-gray-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange" />
        </label>
        <div className="flex gap-1.5 rounded-xl border border-suka-brown/10 bg-[#FDF9F3] p-1">
          <button type="button" onClick={() => setHanyaDilacak(false)} className={`rounded-lg px-3.5 py-1.5 text-xs font-bold ${!hanyaDilacak ? 'bg-suka-brown text-white' : 'text-suka-brown hover:bg-amber-100'}`}>Semua ({data.length})</button>
          <button type="button" onClick={() => setHanyaDilacak(true)} className={`rounded-lg px-3.5 py-1.5 text-xs font-bold ${hanyaDilacak ? 'bg-suka-brown text-white' : 'text-suka-brown hover:bg-amber-100'}`}>Dilacak ({jumlahDilacak})</button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Spinner /></div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-700">
          <AlertCircle className="mx-auto mb-2" />
          <b>Gagal memuat jenis barang</b>
          <p className="mt-1 text-sm">{(error as Error).message}</p>
        </div>
      ) : grup.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-suka-gray-300 bg-white p-10 text-center text-sm text-suka-gray-500">Jenis barang tidak ditemukan.</p>
      ) : (
        grup.map(([subsection, rows]) => (
          <section key={subsection} className="rounded-2xl border border-suka-gray-200 bg-white shadow-sm">
            <h2 className="border-b border-suka-gray-100 bg-[#FDF9F3] px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-suka-brown rounded-t-2xl">{subsection}</h2>
            <ul className="divide-y divide-suka-gray-100">
              {rows.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className={`text-sm font-bold ${row.umur_ekonomis_bulan ? 'text-suka-ink' : 'text-suka-gray-400'}`}>{row.name}</span>
                  <Select
                    size="sm"
                    align="right"
                    searchable={false}
                    options={opsi(row.umur_ekonomis_bulan)}
                    value={row.umur_ekonomis_bulan ? String(row.umur_ekonomis_bulan) : TIDAK_DILACAK}
                    onChange={(v) => ubah(row, v)}
                    disabled={simpan.isPending}
                    className="w-40 shrink-0"
                    aria-label={`Umur pakai ${row.name}`}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
