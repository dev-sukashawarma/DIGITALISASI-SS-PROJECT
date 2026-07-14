// apps/admin-dashboard/src/components/WasteTrendChart.tsx
'use client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts'
import { rupiah } from '@/lib/format'
import type { DateAgg } from '@/lib/wasteBreakdown'

export function WasteTrendChart({ data }: { data: DateAgg[] }) {
  if (data.length === 0) {
    return <div className="h-64 flex items-center justify-center text-suka-gray-400 text-sm">Tidak ada waste pada periode ini</div>
  }

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toLocaleString('id-ID')}k`} />
          <Tooltip formatter={(value) => rupiah(Number(value))} />
          <Line type="monotone" dataKey="nilai" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
