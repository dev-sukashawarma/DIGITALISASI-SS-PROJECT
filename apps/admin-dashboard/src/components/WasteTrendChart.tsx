// apps/admin-dashboard/src/components/WasteTrendChart.tsx
'use client'

import React, { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { Calendar, AlertCircle, Sparkles, TrendingUp, Store, Package } from 'lucide-react'
import { rupiah, rupiahCompact } from '@/lib/format'
import type { DateAgg, WasteBreakdownRow } from '@/lib/wasteBreakdown'

interface WasteTrendChartProps {
  data: DateAgg[]
  summaryRows?: WasteBreakdownRow[] | any[]
  totalNilai?: number
  totalInsiden?: number
}

function formatIndoDate(dateStr: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) {
  try {
    const d = new Date(dateStr)
    return new Intl.DateTimeFormat('id-ID', { ...options, timeZone: 'Asia/Jakarta' }).format(d)
  } catch {
    return dateStr
  }
}

export function WasteTrendChart({
  data = [],
  summaryRows = [],
  totalNilai = 0,
  totalInsiden = 0,
}: WasteTrendChartProps) {
  // Hitung metrik agregat untuk header chart atau rangkuman harian
  const calculatedTotal = useMemo(() => {
    if (totalNilai > 0) return totalNilai
    return data.reduce((s, r) => s + r.nilai, 0)
  }, [data, totalNilai])

  // Kasus 0: Tidak ada data sama sekali
  if (data.length === 0) {
    return (
      <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl border border-suka-brown/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col items-center justify-center text-center py-12">
        <div className="w-12 h-12 rounded-2xl bg-suka-cream flex items-center justify-center text-suka-gray-400 mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <p className="font-bold text-suka-ink text-sm">Tidak ada catatan kerugian waste</p>
        <p className="text-xs text-suka-gray-400 mt-1">
          Tidak ditemukan laporan waste yang sudah disetujui pada periode dan filter terpilih.
        </p>
      </div>
    )
  }

  // Kasus 1: Single-day view (misal "Kemarin" atau "Hari Ini" atau custom 1 hari)
  // Recharts Line/AreaChart tidak bisa menggambar garis jika hanya 1 titik (tampil sebagai 1 titik melayang canggung).
  // Sebagai solusinya, kita tampilkan Kartu Rangkuman Harian yang informatif dan estetik!
  if (data.length === 1) {
    const single = data[0]
    const dateFormatted = formatIndoDate(single.date, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

    // Temukan outlet tertinggi dan bahan tertinggi dari summaryRows hari ini jika ada
    let topOutlet = { name: '—', nilai: 0 }
    let topBahan = { name: '—', nilai: 0, qtyStr: '' }

    if (summaryRows && summaryRows.length > 0) {
      const outletMap = new Map<string, { name: string; nilai: number }>()
      const bahanMap = new Map<string, { name: string; nilai: number; qty: number; unit: string }>()

      for (const r of summaryRows) {
        // Outlet
        const oKey = r.outlet_id || r.outlet_name
        const oCur = outletMap.get(oKey) ?? {
          name: (r.outlet_name || 'Outlet').replace('SUKA SHAWARMA ', ''),
          nilai: 0,
        }
        oCur.nilai += r.nilai || 0
        outletMap.set(oKey, oCur)

        // Bahan
        const bKey = r.bahan_baku_id || r.bahan_nama
        const bCur = bahanMap.get(bKey) ?? {
          name: r.bahan_nama || 'Bahan',
          nilai: 0,
          qty: 0,
          unit: r.satuan_kecil || '',
        }
        bCur.nilai += r.nilai || 0
        bCur.qty += r.qty_kecil || 0
        bahanMap.set(bKey, bCur)
      }

      const sortedOutlets = [...outletMap.values()].sort((a, b) => b.nilai - a.nilai)
      if (sortedOutlets.length > 0) topOutlet = sortedOutlets[0]

      const sortedBahan = [...bahanMap.values()].sort((a, b) => b.nilai - a.nilai)
      if (sortedBahan.length > 0) {
        topBahan = {
          name: sortedBahan[0].name,
          nilai: sortedBahan[0].nilai,
          qtyStr: `${sortedBahan[0].qty.toLocaleString('id-ID', { maximumFractionDigits: 1 })} ${sortedBahan[0].unit}`,
        }
      }
    }

    const avgPerInsiden = totalInsiden > 0 ? Math.round(single.nilai / totalInsiden) : single.nilai

    return (
      <div className="bg-white/80 backdrop-blur-xl p-6 rounded-3xl border border-suka-brown/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-suka-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-700">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase">
                  Rangkuman Waste Harian
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/60">
                  Mode 1 Hari
                </span>
              </div>
              <p className="text-xs text-suka-gray-500 font-medium mt-0.5">{dateFormatted}</p>
            </div>
          </div>

          <div className="text-xs text-suka-gray-400 bg-suka-cream/80 px-3 py-1.5 rounded-xl border border-suka-brown/10 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-suka-orange" />
            <span>Pilih rentang &gt; 1 hari untuk menampilkan grafik tren kronologis</span>
          </div>
        </div>

        {/* 3 Kotak Sorotan Harian */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-50/70 to-rose-100/30 border border-rose-200/50">
            <div className="flex items-center justify-between text-rose-800">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Kerugian Hari Ini</span>
              <TrendingUp className="w-4 h-4 text-rose-600" />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-rose-700 tracking-tight">
              {rupiah(single.nilai)}
            </p>
            <p className="mt-1 text-[11px] text-rose-600 font-medium">
              {totalInsiden > 0
                ? `${totalInsiden} laporan disetujui · Rata-rata ${rupiah(avgPerInsiden)}/insiden`
                : '1 tanggal tercatat'}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50/70 to-amber-100/30 border border-amber-200/50">
            <div className="flex items-center justify-between text-amber-900">
              <span className="text-[11px] font-bold uppercase tracking-wider">Outlet Tertinggi Hari Ini</span>
              <Store className="w-4 h-4 text-amber-600" />
            </div>
            <p className="mt-2 text-lg font-extrabold text-suka-brown truncate" title={topOutlet.name}>
              {topOutlet.name}
            </p>
            <p className="mt-1 text-[11px] text-amber-800 font-semibold">
              {topOutlet.nilai > 0 ? (
                <>
                  {rupiah(topOutlet.nilai)}{' '}
                  <span className="text-amber-600 font-normal">
                    ({((topOutlet.nilai / Math.max(1, single.nilai)) * 100).toFixed(1)}% total)
                  </span>
                </>
              ) : (
                'Tidak ada data outlet'
              )}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/70 to-blue-100/30 border border-blue-200/50">
            <div className="flex items-center justify-between text-blue-900">
              <span className="text-[11px] font-bold uppercase tracking-wider">Bahan Paling Banyak Terbuang</span>
              <Package className="w-4 h-4 text-blue-600" />
            </div>
            <p className="mt-2 text-lg font-extrabold text-blue-950 truncate" title={topBahan.name}>
              {topBahan.name}
            </p>
            <p className="mt-1 text-[11px] text-blue-800 font-semibold">
              {topBahan.nilai > 0 ? (
                <>
                  {rupiah(topBahan.nilai)}
                  {topBahan.qtyStr ? ` · ${topBahan.qtyStr}` : ''}
                </>
              ) : (
                'Tidak ada data bahan'
              )}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Kasus 2: Multi-day period (>= 2 titik tanggal)
  // Tampilkan AreaChart yang anggun dan interaktif
  const avgPerDay = calculatedTotal / Math.max(1, data.length)
  const maxEntry = [...data].sort((a, b) => b.nilai - a.nilai)[0]

  const chartData = data.map((d) => ({
    dateRaw: d.date,
    dateDisplay: formatIndoDate(d.date, { day: 'numeric', month: 'short' }),
    fullDate: formatIndoDate(d.date, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    nilai: d.nilai,
  }))

  return (
    <div className="bg-white/80 backdrop-blur-xl p-6 rounded-3xl border border-suka-brown/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase">
            Tren Kerugian Waste Harian
          </h3>
          <p className="text-xs text-suka-gray-400 font-semibold mt-0.5">
            Pergerakan akumulasi nilai bahan baku terbuang per tanggal
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3 py-1 rounded-xl bg-suka-cream border border-suka-brown/10 text-xs font-semibold text-suka-gray-600 flex items-center gap-1.5">
            <span className="text-suka-gray-400">Rata-rata:</span>
            <strong className="text-suka-brown">{rupiahCompact(Math.round(avgPerDay))}/hari</strong>
          </div>
          {maxEntry && (
            <div className="px-3 py-1 rounded-xl bg-rose-50 border border-rose-200/60 text-xs font-semibold text-rose-700 flex items-center gap-1.5">
              <span className="text-rose-500">Puncak:</span>
              <strong className="text-rose-800">
                {rupiahCompact(maxEntry.nilai)} ({formatIndoDate(maxEntry.date)})
              </strong>
            </div>
          )}
        </div>
      </div>

      <div className="w-full h-64 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 12, right: 12, left: -4, bottom: 0 }}>
            <defs>
              <linearGradient id="wasteRedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" strokeOpacity={0.6} />
            <XAxis
              dataKey="dateDisplay"
              tick={{ fontSize: 10, fill: '#6b7280', fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
              dy={8}
              minTickGap={16}
            />
            <YAxis
              tickFormatter={(v) => rupiahCompact(Number(v))}
              tick={{ fontSize: 10, fill: '#6b7280', fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
              dx={-6}
              width={65}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload
                  const share = calculatedTotal > 0 ? (item.nilai / calculatedTotal) * 100 : 0
                  return (
                    <div className="bg-white/95 backdrop-blur-md p-3.5 rounded-2xl border border-suka-gray-200 shadow-xl text-xs font-bold text-suka-ink space-y-1">
                      <p className="text-suka-gray-500 font-semibold">{item.fullDate}</p>
                      <p className="text-rose-700 text-sm font-extrabold">{rupiah(item.nilai)}</p>
                      <p className="text-[11px] text-suka-gray-400 font-medium">
                        {share.toFixed(1)}% dari total waste periode
                      </p>
                    </div>
                  )
                }
                return null
              }}
            />
            <Area
              type="monotone"
              dataKey="nilai"
              stroke="#dc2626"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#wasteRedGradient)"
              activeDot={{ r: 6, fill: '#dc2626', stroke: '#ffffff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
