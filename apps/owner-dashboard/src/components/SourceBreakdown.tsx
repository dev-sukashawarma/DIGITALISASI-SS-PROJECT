import type { SalesSummaryRow, SalesSource } from '@/lib/types'
import { rupiah } from '@/lib/format'

const LABEL: Record<SalesSource, string> = {
  pos: 'POS Outlet', online: 'Order Online', gofood: 'GoFood',
  grabfood: 'GrabFood', shopeefood: 'ShopeeFood', tiktok: 'TikTok',
}

export function SourceBreakdown({ rows }: { rows: SalesSummaryRow[] }) {
  const bySource = new Map<SalesSource, number>()
  for (const r of rows) bySource.set(r.sales_source, (bySource.get(r.sales_source) ?? 0) + r.omzet)
  const sources = Object.keys(LABEL) as SalesSource[]
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {sources.map((s) => {
        const v = bySource.get(s) ?? 0
        return (
          <div key={s} className="p-3 bg-white rounded-lg border border-gray-200">
            <p className="text-xs text-gray-500">{LABEL[s]}</p>
            <p className="text-lg font-semibold text-suka-brown">
              {v > 0 ? rupiah(v) : <span className="text-gray-400">belum ada transaksi</span>}
            </p>
          </div>
        )
      })}
    </div>
  )
}
