'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts'
import { rupiah, rupiahCompact } from '@/lib/format'
import type { DateAgg } from '@/lib/wasteBreakdown'

export function WasteTrendChart({ data }: { data: DateAgg[] }) {
  if (data.length === 0) {
    return <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Tidak ada waste pada periode ini</div>
  }

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
          <YAxis tickFormatter={(v) => rupiahCompact(Number(v))} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip formatter={(value) => rupiah(Number(value))} />
          <Line type="monotone" dataKey="nilai" stroke="#701604" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
