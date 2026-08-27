'use client'

import { Fragment, useMemo, useState } from 'react'
import { useOutlets } from '@/hooks/useOutlets'
import { useSalesDaily } from '@/hooks/useSalesDaily'
import { useExpenses } from '@/hooks/useExpenses'
import { useHppByChannel } from '@/hooks/useHppByChannel'
import { usePcsByChannel } from '@/hooks/usePcsByChannel'
import { buildBusinessReportRows, type BusinessReportRow, type ChannelMetrics } from '@/lib/businessReport'
import { monthRange } from '@/lib/period'
import { PageHeader } from '@/components/ui'
import { rupiah } from '@/lib/format'

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

const CHANNEL_COLUMNS: { key: 'offline' | 'online' | 'foodapps' | 'tiktok'; label: string; headerClass: string }[] = [
  { key: 'offline', label: 'Offline', headerClass: 'bg-emerald-700 text-white' },
  { key: 'online', label: 'Online', headerClass: 'bg-suka-orange text-white' },
  { key: 'foodapps', label: 'Food Apps', headerClass: 'bg-rose-700 text-white' },
  { key: 'tiktok', label: 'TikTok Go', headerClass: 'bg-gray-900 text-white' },
]

// 1 (Outlet) + 4*3 (channel) + 3 (Total Performance) + 3 (Opex) + 1 (Total GP)
const TOTAL_COLUMN_COUNT = 1 + CHANNEL_COLUMNS.length * 3 + 3 + 3 + 1

export default function RekapBulananPage() {
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const { from, to } = useMemo(() => monthRange(year, month), [year, month])
  const filter = useMemo(() => ({ from, to, outletId: 'all' as const, source: 'all' as const }), [from, to])

  const { data: outlets = [] } = useOutlets()
  const sales = useSalesDaily(filter, outlets)
  const expenses = useExpenses(filter)
  const hppByChannel = useHppByChannel(from, to)
  const pcsByChannel = usePcsByChannel(from, to)

  const loading = sales.loading || expenses.loading || hppByChannel.loading || pcsByChannel.loading
  const error = sales.error || expenses.error || hppByChannel.error || pcsByChannel.error

  const { rows, total } = useMemo(
    () => buildBusinessReportRows(outlets, sales.rows, hppByChannel.rows, pcsByChannel.rows, expenses.rows),
    [outlets, sales.rows, hppByChannel.rows, pcsByChannel.rows, expenses.rows],
  )

  const sortedRows = useMemo(
    () =>
      [...rows]
        .filter((r) => r.totalPerformance.revenue > 0 || r.opexTotal > 0)
        .sort((a, b) => b.totalGrossProfit - a.totalGrossProfit),
    [rows],
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Rekap Bulanan" description="Performa penjualan per channel & profitabilitas per outlet">
        <div className="flex items-center gap-3">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-xl border border-suka-gray-200 px-3 py-2 text-xs font-bold bg-white text-suka-brown outline-none focus:border-suka-orange"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-24 rounded-xl border border-suka-gray-200 px-3 py-2 text-xs font-bold bg-white text-suka-brown outline-none focus:border-suka-orange"
          />
        </div>
      </PageHeader>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm">
          Gagal memuat data rekap: {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-16 bg-white/50 rounded-2xl animate-pulse border border-suka-orange/20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-suka-orange border-t-transparent rounded-full animate-spin" />
            <p className="text-suka-brown font-bold text-sm">Memuat data rekap...</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th rowSpan={2} className="py-3 px-4 bg-suka-brown text-white text-left align-bottom sticky left-0 z-10 font-bold">
                    Outlet
                  </th>
                  {CHANNEL_COLUMNS.map((c) => (
                    <th key={c.key} colSpan={3} className={`py-2 px-3 text-center font-extrabold uppercase tracking-wide ${c.headerClass}`}>
                      {c.label}
                    </th>
                  ))}
                  <th colSpan={3} className="py-2 px-3 text-center font-extrabold uppercase tracking-wide bg-teal-700 text-white">
                    Total Performance
                  </th>
                  <th colSpan={3} className="py-2 px-3 text-center font-extrabold uppercase tracking-wide bg-red-700 text-white">
                    Opex
                  </th>
                  <th rowSpan={2} className="py-3 px-4 bg-emerald-700 text-white text-right align-bottom font-bold">
                    Total Gross Profit
                  </th>
                </tr>
                <tr className="text-[10px] uppercase text-gray-500 bg-amber-50/50">
                  {CHANNEL_COLUMNS.map((c) => (
                    <Fragment key={c.key}>
                      <th className="py-2 px-3 text-right font-bold">Revenue</th>
                      <th className="py-2 px-3 text-right font-bold">GP</th>
                      <th className="py-2 px-3 text-right font-bold">PCS</th>
                    </Fragment>
                  ))}
                  <th className="py-2 px-3 text-right font-bold">Revenue</th>
                  <th className="py-2 px-3 text-right font-bold">GP</th>
                  <th className="py-2 px-3 text-right font-bold">PCS</th>
                  <th className="py-2 px-3 text-right font-bold">Outlet</th>
                  <th className="py-2 px-3 text-right font-bold">Gaji</th>
                  <th className="py-2 px-3 text-right font-bold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-suka-gray-100 font-medium">
                {sortedRows.length === 0 ? (
                  <tr>
                    <td colSpan={TOTAL_COLUMN_COUNT} className="py-8 text-center text-gray-400">
                      Belum ada aktivitas bisnis pada bulan ini
                    </td>
                  </tr>
                ) : (
                  sortedRows.map((r) => <ReportRow key={r.outletId} row={r} />)
                )}
              </tbody>
              {sortedRows.length > 0 && (
                <tfoot>
                  <ReportRow row={total} isTotal />
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function ChannelCells({ m }: { m: ChannelMetrics }) {
  return (
    <>
      <td className="py-3 px-3 text-right text-gray-600 font-semibold">{rupiah(m.revenue)}</td>
      <td className={`py-3 px-3 text-right font-bold ${m.gp >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{rupiah(m.gp)}</td>
      <td className="py-3 px-3 text-right text-gray-500">{m.pcs.toLocaleString('id-ID')}</td>
    </>
  )
}

function ReportRow({ row, isTotal = false }: { row: BusinessReportRow; isTotal?: boolean }) {
  return (
    <tr className={isTotal ? 'bg-amber-50 font-extrabold border-t-2 border-suka-brown' : 'hover:bg-amber-50/20 transition-colors'}>
      <td className={`py-3 px-4 text-suka-brown font-bold sticky left-0 z-10 ${isTotal ? 'bg-amber-50' : 'bg-white'}`}>
        {row.outletName.replace('SUKA SHAWARMA ', '')}
      </td>
      <ChannelCells m={row.offline} />
      <ChannelCells m={row.online} />
      <ChannelCells m={row.foodapps} />
      <ChannelCells m={row.tiktok} />
      <ChannelCells m={row.totalPerformance} />
      <td className="py-3 px-3 text-right text-gray-600 font-semibold">{rupiah(row.opexOutlet)}</td>
      <td className="py-3 px-3 text-right text-gray-600 font-semibold">{rupiah(row.opexSalary)}</td>
      <td className="py-3 px-3 text-right text-gray-800 font-bold">{rupiah(row.opexTotal)}</td>
      <td className={`py-3 px-4 text-right font-extrabold text-sm ${row.totalGrossProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
        {rupiah(row.totalGrossProfit)}
      </td>
    </tr>
  )
}
