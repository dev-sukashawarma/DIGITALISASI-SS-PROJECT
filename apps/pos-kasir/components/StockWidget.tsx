'use client'

import { ExternalLink, PackageCheck, PackageX, PackageMinus } from 'lucide-react'
import { useMyOutlet } from '@/lib/useMyOutlet'
import { useStockAlerts } from '@/lib/useStockAlerts'
import { getStokUrl } from '@/lib/stokUrl'

export default function StockWidget() {
  const { outletId } = useMyOutlet()
  const { items, criticalItems, warningItems, isLoading } = useStockAlerts(outletId)

  if (!outletId) return null

  const allOk = !isLoading && items.length === 0

  return (
    <div className="bg-white border border-[#d9c2b2] suka-shadow rounded-2xl p-5 flex flex-col w-full lg:w-80 shrink-0">
      <div className="flex items-center justify-between pb-3 border-b border-[#d9c2b2] mb-3">
        <div className="flex items-center gap-2">
          <PackageCheck className="w-5 h-5 text-[#701604]" />
          <h2 className="font-bold text-[#701604] text-base">Stok Outlet</h2>
        </div>
        <a
          href={`${getStokUrl()}/dashboard`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-bold text-[#877365] hover:text-[#701604] flex items-center gap-1"
        >
          Detail <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {isLoading ? (
        <div className="h-16 animate-pulse bg-gray-50 rounded-xl" />
      ) : allOk ? (
        <div className="flex flex-col items-center justify-center text-center py-4">
          <PackageCheck className="w-8 h-8 text-[#0a7d2c]/40 mb-2" strokeWidth={1.5} />
          <p className="text-sm font-bold text-[#544437]/60">Stok aman semua</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {criticalItems.map((item) => (
            <div key={item.bahan_baku_id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
              <div className="flex items-center gap-2 min-w-0">
                <PackageX className="w-4 h-4 text-red-600 shrink-0" />
                <span className="text-xs font-bold text-[#1e1b15] truncate">{item.item_name}</span>
              </div>
              <span className="text-xs font-bold text-red-600 shrink-0 flex items-center gap-1.5">
                <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded animate-pulse border border-red-200">Kritis!</span>
                {item.current_qty} {item.satuan}
              </span>
            </div>
          ))}
          {warningItems.map((item) => (
            <div key={item.bahan_baku_id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#fff3e6] border border-[#f2974430]">
              <div className="flex items-center gap-2 min-w-0">
                <PackageMinus className="w-4 h-4 text-[#f29744] shrink-0" />
                <span className="text-xs font-bold text-[#1e1b15] truncate">{item.item_name}</span>
              </div>
              <span className="text-xs font-bold text-[#f29744] shrink-0 flex items-center gap-1.5">
                <span className="bg-orange-100 text-[#f29744] px-1.5 py-0.5 rounded animate-pulse border border-[#f2974430]">Menipis</span>
                {item.current_qty} {item.satuan}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
