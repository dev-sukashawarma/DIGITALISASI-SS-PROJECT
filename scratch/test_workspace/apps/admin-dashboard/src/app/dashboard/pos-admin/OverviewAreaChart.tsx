'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { formatRupiah } from '@/lib/validations'

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-100 shadow-xl rounded-xl">
        <p className="text-gray-500 text-xs font-semibold mb-1">{label}</p>
        <p className="text-amber-600 font-bold text-sm">
          {formatRupiah(payload[0].value)}
        </p>
      </div>
    )
  }
  return null
}

export default function OverviewAreaChart({ chartData }: { chartData: any[] }) {
  return (
    <div className="h-72 w-full" style={{ minHeight: 288 }}>
      <ResponsiveContainer width="100%" height={288}>
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#9ca3af', fontSize: 12 }} 
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            tickFormatter={(value) => `Rp${(value / 1000)}k`}
            dx={-10}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area 
            type="monotone" 
            dataKey="revenue" 
            stroke="#f59e0b" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorRevenue)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
