'use client'
import { useState } from 'react'
import type { MenuSalesRow } from '@/lib/types'
import { rupiah } from '@/lib/format'

export function TopMenus({ rows }: { rows: MenuSalesRow[] }) {
  const [mode, setMode] = useState<'qty' | 'revenue'>('qty')
  const agg = new Map<string, { name: string; qty: number; revenue: number }>()
  for (const r of rows) {
    const cur = agg.get(r.menu_key) ?? { name: r.menu_name, qty: 0, revenue: 0 }
    cur.qty += r.qty; cur.revenue += r.revenue
    agg.set(r.menu_key, cur)
  }
  const list = [...agg.values()].sort((a, b) => b[mode] - a[mode]).slice(0, 10)
  return (
    <div className="p-4 bg-white rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-suka-brown">Menu Terlaris</h2>
        <div className="text-xs">
          <button onClick={() => setMode('qty')} className={mode === 'qty' ? 'font-bold' : 'text-gray-400'}>Qty</button>
          <span className="mx-1 text-gray-300">|</span>
          <button onClick={() => setMode('revenue')} className={mode === 'revenue' ? 'font-bold' : 'text-gray-400'}>Revenue</button>
        </div>
      </div>
      <ol className="space-y-1 text-sm">
        {list.length === 0 && <li className="text-gray-400">Belum ada data</li>}
        {list.map((m, i) => (
          <li key={m.name} className="flex justify-between">
            <span>{i + 1}. {m.name}</span>
            <span className="font-medium">{mode === 'qty' ? `${m.qty} porsi` : rupiah(m.revenue)}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
