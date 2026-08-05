import type { SalesSummaryRow, SalesSource } from '@/lib/types'
import { rupiah, pct } from '@/lib/format'
import { Store, Globe } from 'lucide-react'

const LABELS: Record<SalesSource, string> = {
  pos: 'POS Kasir', 
  online: 'Order Website', 
  gofood: 'GoFood Delivery',
  grabfood: 'GrabFood Delivery', 
  shopeefood: 'ShopeeFood Delivery', 
  tiktok: 'TikTok Shop / Social',
  tiktok_shop: 'TikTok Shop (Marketplace)',
  shopee_shop: 'Shopee (Marketplace)',
}

const BRAND_COLORS: Record<SalesSource, string> = {
  pos: '#701604',         // Suka Brown
  online: '#f29744',      // Suka Orange
  gofood: '#00aa13',      // GoJek Green
  grabfood: '#00b14f',    // Grab Green
  shopeefood: '#ee4d2d',  // Shopee Red-Orange
  tiktok: '#000000',      // TikTok Black
  tiktok_shop: '#000000',  // TikTok Black
  shopee_shop: '#ee4d2d',  // Shopee Red-Orange
}

import { getChannel } from '@/lib/channels'

const ICONS: Record<SalesSource, any> = {
  pos: Store,
  online: Globe,
  gofood: ({ className, style }: any) => {
    const ch = getChannel('gofood')
    return ch?.logoPath ? (
      <svg viewBox="0 0 24 24" className={className} style={{ fill: style?.color || ch.bg }}>
        <path d={ch.logoPath} />
      </svg>
    ) : <Globe className={className} style={style} />
  },
  grabfood: ({ className, style }: any) => {
    const ch = getChannel('grabfood')
    return ch?.logoPath ? (
      <svg viewBox="0 0 24 24" className={className} style={{ fill: style?.color || ch.bg }}>
        <path d={ch.logoPath} />
      </svg>
    ) : <Globe className={className} style={style} />
  },
  shopeefood: ({ className, style }: any) => {
    const ch = getChannel('shopeefood')
    return ch?.logoPath ? (
      <svg viewBox="0 0 24 24" className={className} style={{ fill: style?.color || ch.bg }}>
        <path d={ch.logoPath} />
      </svg>
    ) : <Globe className={className} style={style} />
  },
  tiktok: ({ className, style }: any) => {
    const ch = getChannel('tiktok')
    return ch?.logoPath ? (
      <svg viewBox="0 0 24 24" className={className} style={{ fill: style?.color || ch.bg }}>
        <path d={ch.logoPath} />
      </svg>
    ) : <Globe className={className} style={style} />
  },
  tiktok_shop: ({ className, style }: any) => {
    const ch = getChannel('tiktok_shop')
    return ch?.logoPath ? (
      <svg viewBox="0 0 24 24" className={className} style={{ fill: style?.color || ch.bg }}>
        <path d={ch.logoPath} />
      </svg>
    ) : <Globe className={className} style={style} />
  },
  shopee_shop: ({ className, style }: any) => {
    const ch = getChannel('shopee_shop')
    return ch?.logoPath ? (
      <svg viewBox="0 0 24 24" className={className} style={{ fill: style?.color || ch.bg }}>
        <path d={ch.logoPath} />
      </svg>
    ) : <Globe className={className} style={style} />
  },
}

export function SourceBreakdown({ rows }: { rows: SalesSummaryRow[] }) {
  // Aggregate sales by source
  const bySource = new Map<SalesSource, { omzet: number; orders: number }>()
  let totalOmzet = 0

  for (const r of rows) {
    const cur = bySource.get(r.sales_source) ?? { omzet: 0, orders: 0 }
    cur.omzet += r.omzet
    cur.orders += r.jumlah_order_completed
    bySource.set(r.sales_source, cur)
    totalOmzet += r.omzet
  }

  const sources = Object.keys(LABELS) as SalesSource[]
  
  // Map and sort sources by revenue volume
  const data = sources.map(s => {
    const val = bySource.get(s) ?? { omzet: 0, orders: 0 }
    const percentage = totalOmzet > 0 ? pct(val.omzet, totalOmzet) : 0
    return {
      source: s,
      label: LABELS[s],
      revenue: val.omzet,
      orders: val.orders,
      percentage,
      color: BRAND_COLORS[s],
      icon: ICONS[s]
    }
  }).sort((a, b) => b.revenue - a.revenue)

  return (
    <div className="bg-white/80 backdrop-blur-xl p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-6">
      <div>
        <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase">Kontribusi Saluran Penjualan</h3>
        <p className="text-xs text-suka-gray-400 font-semibold mt-0.5">Sumber transaksi pemesanan menu makanan</p>
      </div>

      <div className="space-y-4">
        {data.map((item) => {
          const Icon = item.icon
          
          return (
            <div key={item.source} className="space-y-1.5 group">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2 font-bold text-suka-ink">
                  <span 
                    className="p-1 rounded-lg flex items-center justify-center transition-colors group-hover:scale-105 duration-150"
                    style={{ backgroundColor: `${item.color}10` }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: item.color }} />
                  </span>
                  <span>{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-suka-gray-500 font-medium">
                    {item.revenue > 0 ? (
                      <>
                        {rupiah(item.revenue)} <span className="text-[10px] text-suka-gray-400 font-normal">({item.orders} order)</span>
                      </>
                    ) : (
                      'tidak ada transaksi'
                    )}
                  </span>
                  {item.revenue > 0 && (
                    <span className="font-extrabold text-suka-brown text-xs" style={{ color: item.color }}>
                      {item.percentage}%
                    </span>
                  )}
                </div>
              </div>
              
              {/* Progress bar container */}
              <div className="w-full h-2 bg-suka-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{ 
                    width: `${item.percentage}%`,
                    backgroundColor: item.color
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
