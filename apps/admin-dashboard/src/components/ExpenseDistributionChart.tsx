'use client'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { rupiah, pct } from '@/lib/format'

type CategorySlice = { name: string; value: number; color: string; categoryKey: string }

export function ExpenseDistributionChart({ byCategory, totalOutlet }: { byCategory: CategorySlice[]; totalOutlet: number }) {
  if (byCategory.length === 0) {
    return <div className="h-64 flex items-center justify-center text-suka-gray-400 text-sm">Tidak ada transaksi</div>
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center p-2">
      {/* Area Pie Chart */}
      <div className="w-full h-64 lg:col-span-1 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={byCategory}
              cx="50%"
              cy="50%"
              innerRadius={70}
<<<<<<< HEAD
              outerRadius={90}
              paddingAngle={4}
              dataKey="value"
              stroke="none"
=======
              outerRadius={100}
              paddingAngle={4}
              dataKey="value"
              stroke="none"
              cornerRadius={6}
>>>>>>> feat/role-purchase-pengadaan
            >
              {byCategory.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
<<<<<<< HEAD
            <Tooltip
              formatter={(value) => rupiah(Number(value))}
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[10px] font-extrabold text-suka-gray-400 uppercase tracking-widest">Total</span>
          <span className="text-sm font-black text-suka-brown">{(totalOutlet/1000000).toFixed(1)}Jt</span>
        </div>
      </div>

      {/* Area Progress Bar Legend */}
      <div className="w-full lg:col-span-2 space-y-4">
        {byCategory.map((entry) => {
          const percentage = pct(entry.value, totalOutlet)
          return (
            <div key={entry.name} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-bold text-suka-ink">
                  <span className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: entry.color }} />
                  {entry.name}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-extrabold text-suka-brown">{rupiah(entry.value)}</span>
                  <span className="text-suka-gray-400 font-bold bg-suka-gray-50 px-2 py-0.5 rounded-md min-w-[50px] text-right">
=======
            <Tooltip 
              formatter={(value) => rupiah(Number(value))} 
              contentStyle={{ borderRadius: '16px', border: '1px solid #f3f4f6', boxShadow: '0 10px 40px rgba(0,0,0,0.08)' }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Teks di tengah Donut */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-suka-gray-400 text-[10px] font-bold tracking-widest uppercase">Total</span>
          <span className="text-suka-ink font-extrabold text-sm mt-0.5">{rupiah(totalOutlet, true)}</span>
        </div>
      </div>

      {/* Area Legend dengan Progress Bar */}
      <div className="w-full lg:col-span-2 space-y-5">
        {byCategory.map((entry) => {
          const percentage = pct(entry.value, totalOutlet)
          return (
            <div key={entry.name} className="flex flex-col gap-2 group">
              <div className="flex justify-between items-end text-sm">
                <div className="flex items-center gap-2.5">
                  <span 
                    className="w-3.5 h-3.5 rounded flex-shrink-0 shadow-sm transition-transform group-hover:scale-110" 
                    style={{ backgroundColor: entry.color }} 
                  />
                  <span className="font-semibold text-suka-ink tracking-tight">{entry.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-suka-gray-500 font-medium">{rupiah(entry.value)}</span>
                  <span className="font-black w-12 text-right" style={{ color: entry.color }}>
>>>>>>> feat/role-purchase-pengadaan
                    {percentage}%
                  </span>
                </div>
              </div>
<<<<<<< HEAD
              <div className="w-full h-2.5 bg-suka-gray-100 rounded-full overflow-hidden flex">
                <div 
                  className="h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden" 
                  style={{ width: `${percentage}%`, backgroundColor: entry.color }}
                >
                  <div className="absolute inset-0 bg-white/20 w-full h-full skew-x-12 translate-x-[-100%] animate-[shimmer_2s_infinite]" />
                </div>
=======
              
              {/* Progress Bar Premium */}
              <div className="h-2.5 w-full bg-suka-gray-100/80 rounded-full overflow-hidden shadow-inner">
                <div 
                  className="h-full rounded-full transition-all duration-1000 ease-out" 
                  style={{ width: `${percentage}%`, backgroundColor: entry.color, boxShadow: `0 0 10px ${entry.color}40` }} 
                />
>>>>>>> feat/role-purchase-pengadaan
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
