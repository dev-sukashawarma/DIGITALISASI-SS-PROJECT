'use client'

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { BlokGrafik } from '@/lib/botHrd/uraiPesan'

const fmt = (v: unknown) => (typeof v === 'number' ? v.toLocaleString('id-ID') : String(v ?? ''))

export function GrafikBatangBot({ judul, satuan, data }: Pick<BlokGrafik, 'judul' | 'satuan' | 'data'>) {
  const tinggi = Math.min(560, Math.max(120, data.length * 28 + 30))
  const labelPanjang = Math.max(0, ...data.map((d) => d.label.length))
  const lebarLabel = Math.min(120, Math.max(60, labelPanjang * 6))
  return (
    <div className="w-full min-w-0 space-y-1">
      {judul && (
        <p className="text-xs font-semibold text-[#4A1713]">
          {judul}
          {satuan ? <span className="font-normal text-[#8a7a70]"> ({satuan})</span> : null}
        </p>
      )}
      <div className="w-full rounded-lg border border-[#E8DCCB] bg-white p-1" style={{ height: tinggi }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 36, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8DCCB" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: '#6b5a50' }} tickFormatter={fmt} />
            <YAxis
              type="category"
              dataKey="label"
              width={lebarLabel}
              interval={0}
              tick={{ fontSize: 10, fill: '#2B1B17' }}
            />
            <Tooltip
              formatter={(v) => [fmt(v) + (satuan ? ` ${satuan}` : ''), '']}
              separator=""
              contentStyle={{ fontSize: 11, borderRadius: 8, borderColor: '#E8DCCB' }}
            />
            <Bar dataKey="nilai" fill="#f29744" radius={[0, 4, 4, 0]} isAnimationActive={false}>
              <LabelList dataKey="nilai" position="right" formatter={fmt} style={{ fontSize: 10, fill: '#4A1713' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
