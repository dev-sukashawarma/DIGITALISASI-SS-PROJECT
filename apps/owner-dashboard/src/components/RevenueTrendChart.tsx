'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { SalesSummaryRow } from '@/lib/types'
import { rupiah } from '@/lib/format'

export function RevenueTrendChart({ rows }: { rows: SalesSummaryRow[] }) {
  const byDate = new Map<string, number>()
  for (const r of rows) byDate.set(r.sales_date, (byDate.get(r.sales_date) ?? 0) + r.omzet)
  const data = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([date, omzet]) => ({ date, omzet }))
  return (
    <div className="p-4 bg-white rounded-lg border border-gray-200">
      <h2 className="font-semibold text-suka-brown mb-3">Tren Omzet Harian</h2>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" fontSize={11} />
          <YAxis tickFormatter={(v) => rupiah(Number(v))} fontSize={11} width={90} />
          <Tooltip formatter={(v) => rupiah(Number(v))} />
          <Line type="monotone" dataKey="omzet" stroke="#C2410C" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
