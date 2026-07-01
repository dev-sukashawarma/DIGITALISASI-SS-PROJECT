'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, X, PackageSearch } from 'lucide-react'
import { useMyOutlet } from '@/lib/useMyOutlet'
import { useStockAlerts } from '@/lib/useStockAlerts'
import { getStokUrl } from '@/lib/stokUrl'

const DISMISS_KEY = 'kasir_stock_alert_dismissed_ids'

export default function StockAlertBanner() {
  const { outletId } = useMyOutlet()
  const { criticalItems, warningItems } = useStockAlerts(outletId)
  const [dismissedIds, setDismissedIds] = useState<string[]>([])

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(DISMISS_KEY)
      if (stored) setDismissedIds(JSON.parse(stored))
    } catch {}
  }, [])

  const allLowItems = [...criticalItems, ...warningItems]
  const visibleIds = allLowItems.map((i) => i.bahan_baku_id).join(',')
  const isDismissed = visibleIds.length > 0 && allLowItems.every((i) => dismissedIds.includes(i.bahan_baku_id))

  if (allLowItems.length === 0 || isDismissed) return null

  const dismiss = () => {
    const next = Array.from(new Set([...dismissedIds, ...allLowItems.map((i) => i.bahan_baku_id)]))
    setDismissedIds(next)
    sessionStorage.setItem(DISMISS_KEY, JSON.stringify(next))
  }

  const isCritical = criticalItems.length > 0
  const names = allLowItems.slice(0, 4).map((i) => i.item_name).join(', ')
  const more = allLowItems.length > 4 ? ` +${allLowItems.length - 4} lainnya` : ''

  return (
    <div className="w-full px-4 pt-4 pb-0 print:hidden">
      <div
        className={`w-full rounded-xl flex items-start sm:items-center gap-3 px-4 py-3 shadow-sm border-2 animate-fade-in ${
          isCritical ? 'border-red-500 bg-red-50' : 'border-orange-400 bg-orange-50'
        }`}
      >
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-white shadow-sm ${
            isCritical ? 'text-red-600' : 'text-orange-500'
          }`}
        >
          <AlertTriangle className="w-5 h-5 animate-pulse" />
        </div>

        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-extrabold leading-tight mb-0.5 ${isCritical ? 'text-red-700' : 'text-orange-700'}`}>
            {isCritical ? '🚨 STOK KRITIS DI OUTLET ANDA!' : '⚠️ STOK MENIPIS DI OUTLET ANDA!'}
          </h4>
          <p className="text-xs font-semibold text-gray-700 truncate pr-4">
            {names}{more}
          </p>
        </div>

        <a
          href={`${getStokUrl()}/dashboard`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 hidden sm:flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-white border border-[#d9c2b2] text-[#701604] hover:bg-[#f5ede3] transition-colors"
        >
          <PackageSearch className="w-3.5 h-3.5" />
          Cek Stok
        </a>

        <button
          onClick={dismiss}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 text-[#877365] transition-colors"
          title="Tutup untuk sesi ini"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
