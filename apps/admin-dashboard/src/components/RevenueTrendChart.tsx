'use client'
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid 
} from 'recharts'
import { rupiah, rupiahCompact } from '@/lib/format'

export function RevenueTrendChart({ 
  rows, 
  isHourly = false,
  className
}: { 
  rows: any[], 
  isHourly?: boolean,
  className?: string
}) {
  let data: any[] = []

  if (isHourly) {
    // rows are SalesHourlyRow (filter jam 13.00 - 23.00)
    data = rows
      .filter((r) => r.sales_hour >= 13 && r.sales_hour <= 23)
      .map((r) => {
        const hourStr = r.sales_hour.toString().padStart(2, '0') + ':00'
        return {
          date: hourStr,
          fullDate: `Jam ${hourStr}`,
          omzet: r.omzet
        }
      })
  } else {
    // rows are SalesSummaryRow
    const byDate = new Map<string, number>()
    for (const r of rows) {
      byDate.set(r.sales_date, (byDate.get(r.sales_date) ?? 0) + r.omzet)
    }
    
    data = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, omzet]) => ({
        date: new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
        fullDate: new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
        omzet
      }))
  }

  const hasData = data.length > 0
  const totalOmzet = data.reduce((s, r) => s + r.omzet, 0)
  
  // If hourly but total omzet is 0 across all hours, we can consider it "No Data" or just show a flat line.
  // Actually showing a flat line for 24h is fine, but if it's completely empty, maybe say no data.
  const actuallyHasData = hasData && (!isHourly || totalOmzet > 0)

  return (
    <div className={className || "bg-white/80 backdrop-blur-xl p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4"}>
      {!className && (
        <div>
          <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase">
            {isHourly ? 'Tren Omzet per Jam' : 'Tren Omzet Harian'}
          </h3>
          <p className="text-xs text-suka-gray-400 font-semibold mt-0.5">
            {isHourly ? 'Distribusi omzet sepanjang hari' : 'Grafik penjualan completed orders'}
          </p>
        </div>
      )}

      {!actuallyHasData ? (
        <div className="h-64 flex items-center justify-center text-suka-gray-400 text-sm font-semibold">
          Belum ada data transaksi
        </div>
      ) : (
        <div className="w-full h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="omzetGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f29744" stopOpacity={0.8}/>
                  <stop offset="100%" stopColor="#f29744" stopOpacity={0.0}/>
                </linearGradient>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" strokeOpacity={0.5} />
              <XAxis 
                dataKey="date" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
                dy={8}
                className="font-bold text-suka-gray-500"
                minTickGap={20}
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
