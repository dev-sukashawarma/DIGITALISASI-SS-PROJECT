'use client'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { rupiah, pct } from '@/lib/format'

type CategorySlice = { name: string; value: number; color: string; categoryKey: string }

export function ExpenseDistributionChart({ byCategory, totalOutlet }: { byCategory: CategorySlice[]; totalOutlet: number }) {
  if (byCategory.length === 0) {
    return <div className="h-64 flex items-center justify-center text-suka-gray-400 text-sm">Tidak ada transaksi</div>
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="w-full h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={byCategory}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
            >
              {byCategory.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => rupiah(Number(value))} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="w-full mt-4 grid grid-cols-2 gap-2 text-xs">
        {byCategory.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2 font-medium">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="truncate text-suka-ink">{entry.name}</span>
            <span className="ml-auto text-suka-gray-500 font-bold">
              {pct(entry.value, totalOutlet)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
