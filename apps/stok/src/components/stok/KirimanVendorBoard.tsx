'use client'
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useBahanBaku } from '@/hooks/useBahanBaku'
import {
  useRincianKirimanVendor, useRekapKirimanVendor, UKURAN_HALAMAN, type FilterKirimanVendor,
} from '@/hooks/useKirimanVendor'
import { kelompokkanRekap, labelVendor, rentangDefault } from '@/lib/stok/kirimanVendor'

const rupiah = (n: number | null | undefined) =>
  n == null ? '—' : 'Rp ' + Math.round(Number(n)).toLocaleString('id-ID')
const angka = (n: number | null | undefined) =>
  Number(n ?? 0).toLocaleString('id-ID', { maximumFractionDigits: 2 })

const kotak = 'bg-white rounded-2xl border border-[#d9c2b2]/45 shadow-[0px_4px_12px_rgba(144,77,0,0.03)]'
const pilih = 'w-full border border-[#d9c2b2]/40 rounded-xl px-3 py-2 bg-white text-xs text-[#1e1b15] font-medium focus:outline-none focus:ring-1 focus:ring-[#f29744]'

export function KirimanVendorBoard() {
  // Rentang default dihitung setelah mount (new Date() saat render bisa beda
  // antara server & client).
  const [filter, setFilter] = useState<FilterKirimanVendor | null>(null)
  useEffect(() => {
    setFilter({ ...rentangDefault(new Date()), outlet: null, bahan: null, vendor: null })
  }, [])
  const [tab, setTab] = useState<'rincian' | 'rekap'>('rincian')
  const [page, setPage] = useState(0)

  const aktif = filter !== null
  const filterAman: FilterKirimanVendor = filter ?? { dari: '', sampai: '', outlet: null, bahan: null, vendor: null }

  const rincian = useRincianKirimanVendor(filterAman, page, aktif && tab === 'rincian')
  const rekap = useRekapKirimanVendor(filterAman, aktif && tab === 'rekap')
  // Pilihan vendor: dari rekap tanpa filter vendor, supaya daftar tak menyusut
  // ke satu vendor begitu satu dipilih.
  const opsiVendorQ = useRekapKirimanVendor({ ...filterAman, vendor: null }, aktif)

  const { bahanBaku } = useBahanBaku()
  const { data: outlets = [] } = useQuery({
    queryKey: ['outlets-kiriman-vendor'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await createClient().from('outlets').select('id, name').order('name')
      if (error) throw new Error(error.message)
      return (data ?? []) as { id: string; name: string }[]
    },
  })

  const opsiVendor = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of opsiVendorQ.data?.rows ?? []) if (r.vendor_id && r.vendor_nama) m.set(r.vendor_id, r.vendor_nama)
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [opsiVendorQ.data])

  const ringkasan = useMemo(() => kelompokkanRekap(rekap.data?.rows ?? []), [rekap.data])

  const ubah = (patch: Partial<FilterKirimanVendor>) => {
    setFilter((f) => (f ? { ...f, ...patch } : f))
    setPage(0)
  }

  if (!filter) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#701604]" /></div>
  }

  const galat = (tab === 'rincian' ? rincian.error : rekap.error) as Error | null
  const totalBaris = rincian.data?.total ?? 0
  const totalHal = Math.max(1, Math.ceil(totalBaris / UKURAN_HALAMAN))

  return (
    <div className="space-y-4">
      <div className={`${kotak} p-4 space-y-3`}>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] font-bold text-[#544437]/75 uppercase tracking-wide space-y-1">
            <span>Dari</span>
            <input type="date" className={pilih} value={filter.dari} max={filter.sampai}
              onChange={(e) => e.target.value && ubah({ dari: e.target.value })} />
          </label>
          <label className="text-[10px] font-bold text-[#544437]/75 uppercase tracking-wide space-y-1">
            <span>Sampai</span>
            <input type="date" className={pilih} value={filter.sampai} min={filter.dari}
              onChange={(e) => e.target.value && ubah({ sampai: e.target.value })} />
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select className={pilih} value={filter.outlet ?? ''} onChange={(e) => ubah({ outlet: e.target.value || null })}>
            <option value="">Semua outlet</option>
            {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <select className={pilih} value={filter.bahan ?? ''} onChange={(e) => ubah({ bahan: e.target.value || null })}>
            <option value="">Semua bahan</option>
            {bahanBaku.map((b) => <option key={b.id} value={b.id}>{b.nama}</option>)}
          </select>
          <select className={pilih} value={filter.vendor ?? ''} onChange={(e) => ubah({ vendor: e.target.value || null })}>
            <option value="">Semua vendor</option>
            {opsiVendor.map(([id, nama]) => <option key={id} value={id}>{nama}</option>)}
          </select>
        </div>
        <p className="text-[10px] font-semibold text-[#544437]/60">
          Data vendor tercatat mulai 12 September 2026. Rentang maksimal 93 hari.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(['rincian', 'rekap'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`py-2 rounded-xl font-bold text-[10px] uppercase tracking-wider border transition-all ${
              tab === t ? 'bg-[#701604] border-[#701604] text-white' : 'bg-white border-[#d9c2b2]/40 text-[#701604]/80'
            }`}>
            {t === 'rincian' ? 'Rincian' : 'Rekap'}
          </button>
        ))}
      </div>

      {galat && (
        <p className="text-xs font-bold text-[#ba1a1a] bg-[#ffdad6] border border-[#ba1a1a]/20 p-3 rounded-xl">
          Gagal memuat laporan: {galat.message}
        </p>
      )}

      {tab === 'rincian' ? (
        rincian.isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#701604]" /></div>
        ) : (rincian.data?.rows.length ?? 0) === 0 ? (
          !galat && <p className="text-center text-xs font-bold text-gray-500 py-12">Tidak ada kiriman pada filter ini.</p>
        ) : (
          <div className="space-y-2">
            {rincian.data!.rows.map((r) => (
              <div key={r.surat_jalan_item_id} className={`${kotak} p-3 text-xs`}>
                <div className="flex items-center justify-between gap-2 text-[10px] font-semibold text-[#544437]/70">
                  <span className="truncate">
                    {r.tanggal} · {r.document_number ?? '—'} · {r.outlet_nama}
                  </span>
                  {r.outlet_tes && <span className="shrink-0 rounded-md bg-gray-100 px-1.5 py-0.5 font-extrabold text-gray-600">TES</span>}
                </div>
                <div className="mt-1 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-extrabold text-[#1e1b15] truncate">{r.bahan_nama}</p>
                    <p className={`text-[11px] font-semibold ${r.vendor_nama ? 'text-[#701604]' : 'text-amber-700'}`}>
                      {labelVendor(r.vendor_nama, r.vendor_otomatis)}
                    </p>
                    <p className="text-[11px] text-[#544437]/80">
                      {angka(r.qty_acuan)} {r.satuan}
                      {r.belum_diterima
                        ? ' · belum diterima'
                        : Number(r.qty_terima) !== Number(r.qty_dikirim) ? ` · dikirim ${angka(r.qty_dikirim)}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 font-extrabold text-[#1e1b15]">{rupiah(r.nilai)}</span>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 text-[11px] font-bold text-[#544437]">
              <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 rounded-lg border border-[#d9c2b2]/50 disabled:opacity-40">Sebelumnya</button>
              <span>hal {page + 1} dari {totalHal} · {totalBaris} baris</span>
              <button type="button" disabled={page + 1 >= totalHal} onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg border border-[#d9c2b2]/50 disabled:opacity-40">Berikutnya</button>
            </div>
          </div>
        )
      ) : rekap.isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#701604]" /></div>
      ) : (
        <div className="space-y-3">
          {rekap.data?.terpotong && (
            <p className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              Hasil terlalu banyak dan mungkin terpotong. Persempit rentang tanggal atau pilih outlet/bahan.
            </p>
          )}
          <div className={`${kotak} p-4 flex items-center justify-between`}>
            <span className="text-xs font-bold text-[#544437]/75 uppercase tracking-wide">Total nilai kiriman</span>
            <span className="text-base font-extrabold text-[#701604]">{rupiah(ringkasan.total)}</span>
          </div>
          <p className="text-[10px] font-semibold text-[#544437]/60">Outlet tes tidak dihitung di rekap.</p>
          {ringkasan.vendor.length === 0 && !galat && (
            <p className="text-center text-xs font-bold text-gray-500 py-12">Tidak ada kiriman pada filter ini.</p>
          )}
          {ringkasan.vendor.map((v) => (
            <div key={v.vendor_id ?? 'kosong'} className={`${kotak} p-4 space-y-3`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className={`text-sm font-extrabold ${v.vendor_id ? 'text-[#701604]' : 'text-amber-700'}`}>{v.vendor_nama}</h3>
                <span className="text-sm font-extrabold text-[#1e1b15]">{rupiah(v.nilai)}</span>
              </div>
              {v.bahan.map((b) => (
                <div key={b.bahan_baku_id} className="border-t border-[#d9c2b2]/40 pt-2">
                  <div className="flex items-center justify-between gap-2 text-xs font-bold text-[#1e1b15]">
                    <span>{b.bahan_nama} — {angka(b.qty)} {b.satuan}</span>
                    <span>{rupiah(b.nilai)}</span>
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {b.outlet.map((o) => (
                      <li key={o.outlet_id} className="flex items-center justify-between gap-2 text-[11px] text-[#544437]/85">
                        <span className="truncate">
                          {o.outlet_nama} · {angka(o.qty)} {o.satuan} · {o.jumlah_sj} SJ
                          {o.ada_belum_diterima ? ' · ada yang belum diterima' : ''}
                        </span>
                        <span className="shrink-0">{rupiah(o.nilai)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
