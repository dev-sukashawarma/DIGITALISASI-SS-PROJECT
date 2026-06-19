'use client'
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid 
} from 'recharts'
import type { SalesSummaryRow } from '@/lib/types'
import { rupiah, rupiahCompact } from '@/lib/format'

export function RevenueTrendChart({ rows }: { rows: SalesSummaryRow[] }) {
  const byDate = new Map<string, number>()
  for (const r of rows) {
    byDate.set(r.sales_date, (byDate.get(r.sales_date) ?? 0) + r.omzet)
  }
  
  const data = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, omzet]) => ({
      // Format tanggal ke 'DD MMM' (misal: 19 Jun) agar tidak terlalu panjang
      date: new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      fullDate: new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
      omzet
    }))

  const hasData = data.length > 0

  return (
    <div className="bg-white p-6 rounded-2xl border border-suka-gray-200 shadow-sm space-y-4">
      <div>
        <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase">Tren Omzet Harian</h3>
        <p className="text-xs text-suka-gray-400 font-semibold mt-0.5">Grafik grafik penjualan completed orders</p>
      </div>

      {!hasData ? (
        <div className="h-64 flex items-center justify-center text-suka-gray-400 text-sm">
          Tidak ada data transaksi
        </div>
      ) : (
        <div className="w-full h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="omzetGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f29744" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#f29744" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis 
                dataKey="date" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
                dy={8}
                className="font-bold text-suka-gray-500"
              />
              <YAxis 
                tickFormatter={(v) => rupiahCompact(Number(v))} 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
                dx={-8}
                width={80}
                className="font-bold text-suka-gray-500"
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const dataRow = payload[0].payload
                    return (
                      <div className="bg-white p-3 rounded-xl border border-suka-gray-200 shadow-lg text-xs font-bold text-suka-ink">
                        <p className="text-suka-gray-500 font-semibold mb-1">{dataRow.fullDate}</p>
                        <p className="text-suka-orange text-sm font-extrabold">{rupiah(dataRow.omzet)}</p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Area 
                type="monotone" 
                dataKey="omzet" 
                stroke="#f29744" 
                strokeWidth={3} 
                fillOpacity={1} 
                fill="url(#omzetGradient)"
                activeDot={{ r: 6, stroke: '#white', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
