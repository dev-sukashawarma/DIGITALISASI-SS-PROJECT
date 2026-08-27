'use client'

import { useState } from 'react'
import { TrendingUp, TrendingDown, BarChart2, AlertCircle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@suka/auth'
import { rupiah } from '@/lib/format'

type BulananRow = {
  bulan: string
  bahan_baku_id: string
  nama_bahan: string
  satuan: string
  supplier_id: string | null
  supplier_nama: string
  total_qty: number
  avg_harga_tertimbang: number
  harga_min: number
  harga_max: number
  total_nilai: number
  jumlah_po: number
}

function useLaporanBulanan(from: string, to: string) {
  const supabase = createSupabaseBrowserClient()
  return useQuery({
    queryKey: ['laporan-pembelian', from, to],
    queryFn: async (): Promise<BulananRow[]> => {
      const { data, error } = await supabase
        .from('pembelian_supplier_bulanan')
        .select('*')
        .gte('bulan', from)
        .lte('bulan', to)
        .order('bulan', { ascending: false })
        .order('total_nilai', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

export default function LaporanPembelianPage() {
  const now = new Date()
  const [from, setFrom] = useState(() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 2, 1)
    return d.toISOString().split('T')[0]
  })
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0])

  const { data: rows = [], isLoading, error } = useLaporanBulanan(from, to)

  // Agregasi per bulan
  const bulanTotals = rows.reduce((acc, r) => {
    const key = r.bulan
    if (!acc[key]) acc[key] = { bulan: key, total: 0, items: 0 }
    acc[key].total += r.total_nilai
    acc[key].items++
    return acc
  }, {} as Record<string, { bulan: string; total: number; items: number }>)

  const bulanList = Object.values(bulanTotals).sort((a, b) => b.bulan.localeCompare(a.bulan))

  // Agregasi per bahan (semua periode)
  const bahanTotals = rows.reduce((acc, r) => {
    const key = r.bahan_baku_id
    if (!acc[key]) acc[key] = { nama: r.nama_bahan, satuan: r.satuan, total_nilai: 0, total_qty: 0, avg: 0, count: 0 }
    acc[key].total_nilai += r.total_nilai
    acc[key].total_qty += r.total_qty
    acc[key].count++
    return acc
  }, {} as Record<string, { nama: string; satuan: string; total_nilai: number; total_qty: number; avg: number; count: number }>)

  const topBahan = Object.values(bahanTotals)
    .sort((a, b) => b.total_nilai - a.total_nilai)
    .slice(0, 10)

  const grandTotal = bulanList.reduce((s, b) => s + b.total, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-suka-brown tracking-tight">Laporan Pembelian Bahan Baku</h1>
        <p className="text-xs text-gray-500 mt-0.5">Realisasi pembelian dari supplier ke Kitchen Pusat.</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <span className="text-xs font-bold text-gray-500">Periode:</span>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          className="border border-suka-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-suka-brown focus:outline-none focus:ring-2 focus:ring-suka-orange/20" />
        <span className="text-gray-400 text-xs">—</span>
        <input type="date" value={to} onChange={e => setTo(e.target.value)}
          className="border border-suka-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-suka-brown focus:outline-none focus:ring-2 focus:ring-suka-orange/20" />
        <div className="ml-auto font-extrabold text-suka-brown text-base">{rupiah(grandTotal)}</div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-suka-orange border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex items-center gap-3">
          <AlertCircle size={18} /><span className="text-sm">{(error as Error).message}</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-suka-gray-200">
          <BarChart2 size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium text-sm">Belum ada data pembelian</p>
          <p className="text-xs text-gray-400 mt-1">Data muncul setelah PO diverifikasi penerimaan</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Total per Bulan */}
          <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-suka-gray-100">
              <h2 className="font-bold text-suka-brown text-xs uppercase tracking-wide">Total per Bulan</h2>
            </div>
            <div className="divide-y divide-suka-gray-100">
              {bulanList.map(b => (
                <div key={b.bulan} className="px-5 py-3 flex justify-between items-center text-xs">
                  <div>
                    <div className="font-bold text-suka-brown text-xs">
                      {new Date(b.bulan + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                    </div>
                    <div className="text-[10px] text-gray-400">{b.items} bahan baku</div>
                  </div>
                  <div className="font-extrabold text-suka-brown text-sm">{rupiah(b.total)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Bahan by Spending */}
          <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-suka-gray-100">
              <h2 className="font-bold text-suka-brown text-xs uppercase tracking-wide">Top 10 Bahan by Pengeluaran</h2>
            </div>
            <div className="divide-y divide-suka-gray-100">
              {topBahan.map((b, idx) => (
                <div key={b.nama} className="px-5 py-3 flex items-center gap-3 text-xs">
                  <span className="text-xs font-bold text-gray-300 w-4 text-right">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900 truncate">{b.nama}</div>
                    <div className="text-[10px] text-gray-400">{b.total_qty.toLocaleString('id-ID')} {b.satuan}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold text-suka-brown">{rupiah(b.total_nilai)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tren Harga per Bahan */}
          <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm overflow-hidden lg:col-span-2">
            <div className="px-5 py-4 border-b border-suka-gray-100">
              <h2 className="font-bold text-suka-brown text-xs uppercase tracking-wide">Tren Harga Rata-Rata Tertimbang per Bahan</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-amber-50/50 text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                    <th className="text-left px-5 py-3">Bahan</th>
                    <th className="text-left px-4 py-3">Bulan</th>
                    <th className="text-left px-4 py-3">Supplier</th>
                    <th className="text-right px-4 py-3">Qty</th>
                    <th className="text-right px-4 py-3">Harga Rata-rata</th>
                    <th className="text-right px-4 py-3">Min — Max</th>
                    <th className="text-right px-4 py-3">Total Nilai</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-suka-gray-100 font-medium">
                  {rows.map((r) => {
                    const spread = r.harga_max - r.harga_min
                    const spreadPct = r.harga_min > 0 ? (spread / r.harga_min) * 100 : 0
                    return (
                      <tr key={`${r.bulan}-${r.bahan_baku_id}-${r.supplier_nama}`} className="hover:bg-amber-50/20 transition-colors">
                        <td className="px-5 py-3 font-bold text-gray-900">{r.nama_bahan}
                          <span className="text-[10px] text-gray-400 ml-1 font-normal">/{r.satuan}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {new Date(r.bulan + '-01').toLocaleDateString('id-ID', { month: 'short', year: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{r.supplier_nama}</td>
                        <td className="px-4 py-3 text-right">{r.total_qty.toLocaleString('id-ID')}</td>
                        <td className="px-4 py-3 text-right font-bold text-suka-brown">{rupiah(r.avg_harga_tertimbang)}</td>
                        <td className="px-4 py-3 text-right text-xs text-gray-500">
                          {rupiah(r.harga_min)} — {rupiah(r.harga_max)}
                          {spreadPct > 5 && (
                            <span className="ml-1 text-amber-500 font-bold">
                              {spreadPct > 0 ? <TrendingUp size={10} className="inline" /> : <TrendingDown size={10} className="inline" />}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-extrabold text-suka-brown">{rupiah(r.total_nilai)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
