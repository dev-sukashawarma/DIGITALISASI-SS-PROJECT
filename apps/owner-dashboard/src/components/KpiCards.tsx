import type { SalesSummaryRow } from '@/lib/types'
import { rupiah, aov, pct } from '@/lib/format'

export function KpiCards({ rows }: { rows: SalesSummaryRow[] }) {
  const omzet = rows.reduce((s, r) => s + r.omzet, 0)
  const completed = rows.reduce((s, r) => s + r.jumlah_order_completed, 0)
  const all = rows.reduce((s, r) => s + r.jumlah_order_all, 0)
  const cards = [
    { label: 'Omzet', value: rupiah(omzet) },
    { label: 'Jumlah Order', value: completed.toLocaleString('id-ID') },
    { label: 'AOV', value: rupiah(aov(omzet, completed)) },
    { label: '% Order Completed', value: `${pct(completed, all)}%` },
  ]
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="p-4 bg-white rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500">{c.label}</p>
          <p className="text-2xl font-bold text-suka-brown">{c.value}</p>
        </div>
      ))}
    </div>
  )
}
