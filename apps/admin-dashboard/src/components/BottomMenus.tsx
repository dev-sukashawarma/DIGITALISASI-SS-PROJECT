import type { MenuSalesRow } from '@/lib/types'
import { rupiah } from '@/lib/format'
import { AlertCircle } from 'lucide-react'

export function BottomMenus({ rows }: { rows: MenuSalesRow[] }) {
  // Clean name helper
  const cleanName = (name: string) => name.split('|')[0].trim()

  // Aggregate menu sales
  const byMenu = new Map<string, { qty: number; revenue: number }>()
  for (const r of rows) {
    const name = cleanName(r.menu_name)
    const cur = byMenu.get(name) ?? { qty: 0, revenue: 0 }
    cur.qty += r.qty
    cur.revenue += r.revenue
    byMenu.set(name, cur)
  }

  // Sort ascending by qty, then by revenue
  const data = [...byMenu.entries()]
    .map(([name, val]) => ({ name, ...val }))
    .sort((a, b) => a.qty - b.qty || a.revenue - b.revenue)
    .slice(0, 5)

  if (data.length === 0) return null

  return (
    <div className="bg-white p-6 rounded-2xl border border-suka-gray-200 shadow-sm space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-600 shrink-0 mt-0.5">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase">Menu Kurang Diminati</h3>
          <p className="text-xs text-suka-gray-400 font-semibold mt-0.5">5 menu dengan pendapatan terendah. Evaluasi promo atau resep.</p>
        </div>
      </div>

      <div className="space-y-3 pt-2">
        {data.map((item, i) => (
          <div key={item.name} className="flex items-center gap-3">
            <span className="text-xs font-bold text-suka-gray-400 w-4 text-center">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-suka-ink truncate">{item.name}</h4>
              <p className="text-xs text-suka-gray-500 font-medium">{item.qty} terjual</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-extrabold text-suka-brown">{rupiah(item.revenue)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
