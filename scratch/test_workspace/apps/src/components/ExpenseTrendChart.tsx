'use client'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { rupiah, rupiahCompact } from '@/lib/format'
import { CATEGORY_META, OUTLET_CATEGORIES } from '@/lib/expenseCategories'

export function ExpenseTrendChart({ byDate }: { byDate: Record<string, number | string>[] }) {
  if (byDate.length === 0) {
    return <div className="h-64 flex items-center justify-center text-suka-gray-400 text-sm">Tidak ada transaksi</div>
  }

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={byDate} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
          <XAxis dataKey="date" fontSize={10} tickLine={false} />
          <YAxis tickFormatter={(v) => rupiahCompact(Number(v))} fontSize={10} tickLine={false} axisLine={false} width={80} />
          <Tooltip formatter={(value) => rupiah(Number(value))} />
          <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
          {OUTLET_CATEGORIES.map(c => (
            <Bar key={c} dataKey={c} name={CATEGORY_META[c].label} stackId="a" fill={CATEGORY_META[c].color} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
